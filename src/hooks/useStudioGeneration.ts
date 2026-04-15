/**
 * useStudioGeneration
 *
 * Owns the photoshoot generation pipeline for UnifiedStudio.
 *
 * WHY THIS EXISTS
 * ---------------
 * UnifiedStudio.tsx was 2000+ lines with all state and logic inlined.
 * This hook was extracted (phase 27) to reduce the page file size.
 * It has NO UI — it only manages state and runs the generation loop.
 *
 * WHAT IT MANAGES
 * ---------------
 * - All generation state: isGenerating, progress %, step label, result images,
 *   error string, workflow ID, regeneration count, feedback modal open state
 * - Rotating loading message timer (cycles every 4s while generating)
 * - handleGenerate: the full generation pipeline — credit check, file upload
 *   fallback, API call (startPhotoshoot OR startPdpShot), polling loop,
 *   result extraction, PostHog analytics
 * - resetGeneration: clears all of the above state at once (called by handleStartOver)
 *
 * SNAPSHOT PARAMS PATTERN (important to understand)
 * --------------------------------------------------
 * handleGenerate is a useCallback that closes over the options object passed
 * on every render. This means the hook always uses the LATEST values of
 * jewelryImage, activeModelUrl, etc. without needing to re-create the callback
 * on every state change — the dependency array lists them all explicitly.
 *
 * If you add new state that handleGenerate needs to read at call time, add it
 * to both the UseStudioGenerationOptions interface AND the useCallback dep array.
 *
 * TWO GENERATION MODES
 * ----------------------
 * isProductShot=false  -> calls startPhotoshoot  (model_image_url, input_preset_model_id)
 * isProductShot=true   -> calls startPdpShot     (inspiration_image_url, input_preset_inspiration_id)
 * All other logic (upload fallback, polling, result parsing) is shared.
 *
 * HOW TO USE
 * ----------
 * Call inside UnifiedStudio after ALL input state is declared (jewelryImage,
 * activeModelUrl, jewelryUploadedUrl, jewelryAssetId, etc.) so TypeScript can
 * resolve the option types:
 *
 *   const { isGenerating, resultImages, handleGenerate, resetGeneration, ... } =
 *     useStudioGeneration({ isProductShot, effectiveJewelryType, jewelryImage, ... });
 */
import { useState, useEffect, useCallback } from 'react';
import {
  startPhotoshoot,
  startPdpShot,
  type PhotoshootResultResponse,
  type PhotoshootStatusResponse,
} from '@/lib/photoshoot-api';
import { pollWorkflow } from '@/lib/poll-workflow';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { uploadToAzure } from '@/lib/microservices-api';
import { compressImageBlob, imageSourceToBlob } from '@/lib/image-compression';
import { azureUriToUrl } from '@/lib/azure-utils';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
import { markGenerationStarted, markGenerationCompleted, markGenerationFailed } from '@/lib/generation-lifecycle';
import {
  trackPaywallHit,
  trackGenerationComplete,
  consumeFirstGeneration,
} from '@/lib/posthog-events';
import type { PresetModel } from '@/lib/models-api';
import type { ImageValidationResult } from '@/hooks/use-image-validation';
import type { useToast } from '@/hooks/use-toast';

type StudioStep = 'upload' | 'model' | 'generating' | 'results';

interface UseStudioGenerationOptions {
  isProductShot: boolean;
  effectiveJewelryType: string;
  jewelryImage: string | null;
  activeModelUrl: string | null;
  jewelryUploadedUrl: string | null;
  jewelryAssetId: string | null;
  selectedModel: PresetModel | null;
  customModelImage: string | null;
  modelAssetId: string | null;
  validationResult: ImageValidationResult | null;
  checkCredits: (tool: string) => Promise<boolean>;
  refreshCredits: () => void;
  toast: ReturnType<typeof useToast>['toast'];
  setCurrentStep: (step: StudioStep) => void;
  setJewelryAssetId: (id: string | null) => void;
  clearStudioSession: () => void;
  clearValidation: () => void;
}

function extractResultImages(result: PhotoshootResultResponse): string[] {
  const images: string[] = [];
  for (const key of Object.keys(result)) {
    const items = result[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      for (const k of ['output_url', 'image_url', 'result_url', 'url', 'image_b64', 'output_image']) {
        const val = obj[k];
        if (typeof val === 'string' && val.length > 0) {
          if (val.startsWith('azure://')) {
            images.push(azureUriToUrl(val));
          } else if (val.startsWith('http') || val.startsWith('data:')) {
            images.push(val);
          }
        }
      }
    }
  }
  return images;
}

export function useStudioGeneration({
  isProductShot,
  effectiveJewelryType,
  jewelryImage,
  activeModelUrl,
  jewelryUploadedUrl,
  jewelryAssetId,
  selectedModel,
  customModelImage,
  modelAssetId,
  validationResult,
  checkCredits,
  refreshCredits,
  toast,
  setCurrentStep,
  setJewelryAssetId,
  clearStudioSession,
  clearValidation,
}: UseStudioGenerationOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [rotatingMsgIdx, setRotatingMsgIdx] = useState(0);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [regenerationCount, setRegenerationCount] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Cycle rotating messages every 4s while generating
  useEffect(() => {
    if (!isGenerating) { setRotatingMsgIdx(0); return; }
    const id = setInterval(() => setRotatingMsgIdx(i => i + 1), 4000);
    return () => clearInterval(id);
  }, [isGenerating]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    if (!jewelryImage || !activeModelUrl) {
      toast({ variant: 'destructive', title: 'Missing inputs', description: 'Upload a jewelry image and select a model.' });
      return;
    }

    const hasCredits = await checkCredits(isProductShot ? 'Product_shot_pipeline' : 'jewelry_photoshoots_generator');
    if (!hasCredits) {
      trackPaywallHit({
        category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
        steps_completed: 2,
      });
      return;
    }

    clearStudioSession();
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStep('Preparing...');
    setGenerationError(null);
    setCurrentStep('generating');

    let _genWorkflowId = 'unknown';
    const _genStartTime = Date.now();
    try {
      setGenerationProgress(5);
      let jewelryUrl: string;
      if (jewelryUploadedUrl) {
        jewelryUrl = jewelryUploadedUrl;
        setGenerationProgress(20);
      } else {
        setGenerationStep('Uploading jewelry image...');
        const jewelryBlob = await imageSourceToBlob(jewelryImage);
        const { blob: compressedJewelry } = await compressImageBlob(jewelryBlob);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedJewelry);
        });
        const azResult = await uploadToAzure(base64, 'image/jpeg', 'jewelry_photo', { category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType });
        jewelryUrl = azResult.sas_url || azResult.https_url;
        setJewelryAssetId(azResult.asset_id ?? null);
        setGenerationProgress(20);
      }

      setGenerationProgress(20);
      setGenerationStep('Preparing model image...');
      let modelUrl: string;

      if (selectedModel) {
        modelUrl = selectedModel.url;
      } else if (customModelImage) {
        modelUrl = customModelImage;
      } else {
        throw new Error('No model selected');
      }

      setGenerationProgress(35);
      setGenerationStep('Starting AI photoshoot...');

      if (!jewelryUrl || !modelUrl) {
        toast({ variant: 'destructive', title: 'Missing images', description: 'Please select both a jewelry image and a model before generating.' });
        setIsGenerating(false);
        setCurrentStep('model');
        return;
      }

      const idempotencyKey = `${Date.now()}-${effectiveJewelryType}-${selectedModel?.id || 'custom'}`;
      const category = TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType;

      const startResponse = isProductShot
        ? await startPdpShot({
            jewelry_image_url: jewelryUrl,
            inspiration_image_url: modelUrl,
            category,
            idempotency_key: idempotencyKey,
            ...(jewelryAssetId ? { input_jewelry_asset_id: jewelryAssetId } : {}),
            ...(selectedModel?.id
              ? { input_preset_inspiration_id: selectedModel.id }
              : modelAssetId
              ? { input_inspiration_asset_id: modelAssetId }
              : {}),
          })
        : await startPhotoshoot({
            jewelry_image_url: jewelryUrl,
            model_image_url: modelUrl,
            category,
            idempotency_key: idempotencyKey,
            ...(jewelryAssetId ? { input_jewelry_asset_id: jewelryAssetId } : {}),
            ...(modelAssetId ? { input_model_asset_id: modelAssetId } : {}),
            ...(selectedModel?.id && !modelAssetId ? { input_preset_model_id: selectedModel.id } : {}),
          });
      _genWorkflowId = startResponse.workflow_id;

      setWorkflowId(startResponse.workflow_id);
      markGenerationStarted(startResponse.workflow_id);

      setGenerationStep('Generating photoshoot...');

      const ticker = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) return prev;
          return Math.min(prev + Math.max((90 - prev) * 0.04, 0.1), 90);
        });
      }, 300);

      try {
        const pollResult = await pollWorkflow<PhotoshootResultResponse>({
          mode: 'status-then-result',
          fetchStatus: () => authenticatedFetch(`/api/status/${startResponse.workflow_id}`),
          fetchResult: () => authenticatedFetch(`/api/result/${startResponse.workflow_id}`),
          onStatusData: (statusData: unknown) => {
            const s = statusData as PhotoshootStatusResponse;
            if (s.progress) {
              const total = s.progress.total_nodes || 1;
              const done = s.progress.completed_nodes || 0;
              const realPct = Math.min(35 + Math.round((done / total) * 60), 95);
              setGenerationProgress(prev => Math.max(prev, realPct));
              const visited = s.progress.visited || [];
              if (visited.length > 0) {
                setGenerationStep(visited[visited.length - 1].replace(/_/g, ' '));
              }
            }
          },
          parseResult: (d) => d as PhotoshootResultResponse,
          intervalMs: 3000,
          timeoutMs: 720_000,
          max404s: Number.MAX_SAFE_INTEGER,
          maxPollErrors: 1,
          maxResultRetries: 6,
          resultRetryDelayMs: 1000,
        });

        clearInterval(ticker);

        if (pollResult.status === 'cancelled') return;

        setGenerationProgress(95);
        setGenerationStep('Fetching results...');

        const result = pollResult.result;

        const hasActivityError = Object.values(result).some(
          (items) => Array.isArray(items) && items.some((i: any) => i?.action === 'error' || i?.status === 'failed')
        );
        if (hasActivityError) {
          setGenerationError('workflow-failed');
          setIsGenerating(false);
          return;
        }

        const images = extractResultImages(result);
        setResultImages(images);
        setGenerationProgress(100);
        setCurrentStep('results');
        setIsGenerating(false);
        markGenerationCompleted(_genWorkflowId, _genStartTime);
        trackGenerationComplete({
          source: 'unified-studio',
          category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
          upload_type: validationResult?.category ?? null,
          duration_ms: Date.now() - _genStartTime,
          is_first_ever: consumeFirstGeneration(),
        });
        refreshCredits();
        return;
      } finally {
        clearInterval(ticker);
      }
    } catch (error) {
      markGenerationFailed(
        _genWorkflowId,
        error instanceof Error ? error.message : String(error),
        _genStartTime,
      );
      setGenerationError('unavailable');
      setIsGenerating(false);
    }
  }, [
    isGenerating, jewelryImage, activeModelUrl, isProductShot, effectiveJewelryType,
    jewelryUploadedUrl, jewelryAssetId, selectedModel, customModelImage, modelAssetId,
    validationResult, checkCredits, refreshCredits, toast, setCurrentStep, setJewelryAssetId,
    clearStudioSession,
  ]);

  const resetGeneration = useCallback(() => {
    setResultImages([]);
    setWorkflowId(null);
    setGenerationError(null);
    setGenerationProgress(0);
    setGenerationStep('');
    setRegenerationCount(0);
    setFeedbackOpen(false);
  }, []);

  return {
    isGenerating,
    generationProgress,
    generationStep,
    rotatingMsgIdx,
    workflowId,
    resultImages,
    setResultImages,
    generationError,
    regenerationCount,
    setRegenerationCount,
    feedbackOpen,
    setFeedbackOpen,
    handleGenerate,
    resetGeneration,
  };
}
