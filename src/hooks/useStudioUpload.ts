/**
 * useStudioUpload
 *
 * Owns all jewelry and model upload logic for UnifiedStudio.
 *
 * WHY THIS EXISTS
 * ---------------
 * UnifiedStudio.tsx contained two large async upload handlers
 * (handleJewelryUpload, handleModelUpload) plus their associated state.
 * This hook was extracted (phase 30) to reduce the page file size.
 * It has NO UI -- it only manages upload state and runs upload flows.
 *
 * WHAT IT MANAGES
 * ---------------
 * - Jewelry upload state: jewelryImage, jewelryFile, jewelryUploadedUrl,
 *   jewelrySasUrl, jewelryAssetId, validationResult
 * - handleJewelryUpload: normalise -> preview -> compress -> upload to Azure
 *   -> validate (model-shot) or skip validation (product-shot)
 * - handleModelUpload: normalise -> preview -> compress -> upload to Azure
 *   -> push to My Models optimistic list -> re-fetch
 * - handleSelectLibraryModel: select a preset model, clear custom model state
 *
 * WHAT STAYS IN UnifiedStudio
 * ---------------------------
 * - customModelImage / selectedModel / modelAssetId -- shared with
 *   useStudioModels and useStudioGeneration; passed in as option setters
 * - Paste handler useEffect -- needs currentStep + activeModelUrl from
 *   UnifiedStudio scope
 * - handleStartOver / handleNextStep / handleContinueAnyway -- touch
 *   generation and step state, not upload state
 *
 * HOW TO USE
 * ----------
 * Call after useStudioModels (needs setLocalPendingModels + fetchMyModels)
 * and before useStudioGeneration (returns jewelryAssetId etc. that generation needs):
 *
 *   const { jewelryImage, handleJewelryUpload, ... } = useStudioUpload({
 *     isProductShot, effectiveJewelryType, validateImages, toast,
 *     setCustomModelImage, setCustomModelFile, setModelAssetId, setSelectedModel,
 *     setLocalPendingModels, fetchMyModels,
 *   });
 */
import { useState, useCallback } from 'react';
import { normalizeImageFile } from '@/lib/image-normalize';
import { compressImageBlob } from '@/lib/image-compression';
import { uploadToAzure } from '@/lib/microservices-api';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
import { trackJewelryUploaded, trackValidationFlagged, trackModelSelected } from '@/lib/posthog-events';
import type { ImageValidationResult } from '@/hooks/use-image-validation';
import type { PresetModel } from '@/lib/models-api';
import type { UserModel } from '@/components/studio/ModelCard';
import type { useToast } from '@/hooks/use-toast';

interface UseStudioUploadOptions {
  isProductShot: boolean;
  effectiveJewelryType: string;
  validateImages: (files: File[], category: string, metadata?: Record<string, string>) => Promise<any>;
  toast: ReturnType<typeof useToast>['toast'];
  // jewelry state setters -- owned by UnifiedStudio (needed for resolvedJewelryImage hook ordering)
  setJewelryImage: (url: string | null) => void;
  setJewelryFile: (file: File | null) => void;
  // model state setters -- owned by UnifiedStudio, shared with useStudioModels + useStudioGeneration
  setCustomModelImage: (url: string | null) => void;
  setCustomModelFile: (file: File | null) => void;
  setModelAssetId: (id: string | null) => void;
  setSelectedModel: (model: PresetModel | null) => void;
  // from useStudioModels
  setLocalPendingModels: React.Dispatch<React.SetStateAction<UserModel[]>>;
  fetchMyModels: () => Promise<void>;
}

export function useStudioUpload({
  isProductShot,
  effectiveJewelryType,
  validateImages,
  toast,
  setJewelryImage,
  setJewelryFile,
  setCustomModelImage,
  setCustomModelFile,
  setModelAssetId,
  setSelectedModel,
  setLocalPendingModels,
  fetchMyModels,
}: UseStudioUploadOptions) {
  // jewelryImage + jewelryFile stay in UnifiedStudio so useAuthenticatedImage can reference
  // jewelryImage before this hook is called. Setters are passed in as options above.
  const [validationResult, setValidationResult] = useState<ImageValidationResult | null>(null);
  const [jewelryUploadedUrl, setJewelryUploadedUrl] = useState<string | null>(null);
  const [jewelrySasUrl, setJewelrySasUrl] = useState<string | null>(null);
  const [jewelryAssetId, setJewelryAssetId] = useState<string | null>(null);

  const handleJewelryUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
      return;
    }
    const normalized = await normalizeImageFile(file);
    setJewelryFile(normalized);
    setJewelryUploadedUrl(null);
    setJewelrySasUrl(null);
    setJewelryAssetId(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setJewelryImage(e.target?.result as string);
      setValidationResult(null);
    };
    reader.readAsDataURL(normalized);

    if (isProductShot) {
      // PDP: no classification needed -- product shots are the correct input, upload directly
      try {
        const { blob: compressed } = await compressImageBlob(normalized);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader2 = new FileReader();
          reader2.onload = () => resolve(reader2.result as string);
          reader2.onerror = reject;
          reader2.readAsDataURL(compressed);
        });
        const azResult = await uploadToAzure(base64, 'image/jpeg', 'jewelry_photo', { category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType, intended_use: 'pdp' });
        setJewelryUploadedUrl(azResult.sas_url || azResult.https_url);
        setJewelrySasUrl(azResult.sas_url ?? null);
        setJewelryAssetId(azResult.asset_id ?? null);
        trackJewelryUploaded({ category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType, upload_type: 'product_shot', was_flagged: false });
      } catch (err) {
        console.error('[PDP] jewelry upload failed', err);
      }
      return;
    }

    const result = await validateImages([normalized], effectiveJewelryType, { category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType, intended_use: 'on_model' });
    if (result && result.results.length > 0) {
      const localResult = result.results[0]; // use local variable -- validationResult state is stale here (async setter)
      setValidationResult(localResult);
      if (localResult.uploaded_url) {
        setJewelryUploadedUrl(localResult.uploaded_url);
        setJewelrySasUrl(localResult.sas_url ?? null);
        setJewelryAssetId(localResult.asset_id ?? null);
      }

      if (localResult.is_acceptable) {
        // Path A: worn image accepted -- fire jewelry_uploaded immediately
        trackJewelryUploaded({
          category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
          upload_type: localResult.category,
          was_flagged: false,
        });
      } else {
        // Path B: non-worn image flagged -- fire validation_flagged now;
        // jewelry_uploaded fires in handleContinueAnyway if user proceeds
        trackValidationFlagged({
          category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
          detected_label: localResult.category,
        });
      }
    }
  }, [toast, effectiveJewelryType, validateImages, isProductShot]);

  const handleModelUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
      return;
    }
    const normalized = await normalizeImageFile(file);
    setCustomModelFile(normalized);

    // Show preview immediately via local blob URL while upload runs
    const localPreviewUrl = URL.createObjectURL(normalized);
    setCustomModelImage(localPreviewUrl);
    setSelectedModel(null);

    // Upload to Azure immediately so the model registers in My Models vault
    try {
      const { blob: compressed } = await compressImageBlob(normalized);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader2 = new FileReader();
        reader2.onload = () => resolve(reader2.result as string);
        reader2.onerror = reject;
        reader2.readAsDataURL(compressed);
      });
      const modelName = file.name.replace(/\.[^.]+$/, '');
      const azResult = await uploadToAzure(base64, 'image/jpeg', isProductShot ? 'inspiration_photo' : 'model_photo', { name: modelName });
      const stableUrl = azResult.sas_url || azResult.https_url;
      setCustomModelImage(stableUrl);
      setModelAssetId(azResult.asset_id ?? null);
      setCustomModelFile(null);
      trackModelSelected({
        category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
        model_type: 'custom_upload',
      });

      // Add to My Models list -- use real asset_id so dedup matches backend fetch
      const newModel: UserModel = {
        id: azResult.asset_id ?? `user-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        url: stableUrl,
        uploadedAt: Date.now(),
      };
      setLocalPendingModels(prev => [newModel, ...prev]);
      // Refetch from backend to sync
      fetchMyModels();
    } catch (e) {
      setCustomModelImage(null);
      setCustomModelFile(null);
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Model image could not be uploaded. Please re-select the file.' });
      console.warn('[handleModelUpload] Azure upload failed:', e);
    }
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectLibraryModel = useCallback((model: PresetModel) => {
    setSelectedModel(model);
    setCustomModelImage(null);
    setCustomModelFile(null);
    setModelAssetId(null);
    trackModelSelected({
      category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
      model_type: 'catalog',
    });
  }, [effectiveJewelryType, setSelectedModel, setCustomModelImage, setCustomModelFile, setModelAssetId]);

  return {
    validationResult,
    setValidationResult,
    jewelryUploadedUrl,
    setJewelryUploadedUrl,
    jewelrySasUrl,
    setJewelrySasUrl,
    jewelryAssetId,
    setJewelryAssetId,
    handleJewelryUpload,
    handleModelUpload,
    handleSelectLibraryModel,
  };
}
