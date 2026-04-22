import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useCredits } from '@/contexts/CreditsContext';
import { AuthExpiredError, authenticatedFetch } from '@/lib/authenticated-fetch';
import { pollWorkflow, type PollWorkflowResult } from '@/lib/poll-workflow';
import {
  resolveCadTerminalNode,
  resolveCadProgressNode,
  parseCadResult,
  type CadGenerationResult,
} from '@/lib/cad-poll-resolvers';
import {
  CAD_EDIT_WORKFLOW,
  CAD_IMAGE_GENERATION_WORKFLOW,
  buildCadEditStartBody,
  buildImageCadStartBody,
  CAD_GENERATION_WORKFLOW,
  buildCadGenerationStartBody,
} from '@/lib/cad-workflows';
import { resolveCadGenerationTier } from '@/lib/cad-tier';
import { performCreditPreflight, type PreflightResult } from '@/lib/credit-preflight';
import { TOOL_COSTS } from '@/lib/credits-api';
import { trackPaywallHit, trackCadGenerationCompleted } from '@/lib/posthog-events';
import { getStoredToken } from '@/lib/auth-api';

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface WorkflowParams {
  model: string;
  prompt: string;
  referenceImage: File | null;
  pushUndo: (label: string) => void;
  userId: string | undefined;
}

export function useImageToCADWorkflow({ model, prompt, referenceImage, pushUndo, userId }: WorkflowParams) {
  const { refreshCredits } = useCredits();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [sourceWorkflowId, setSourceWorkflowId] = useState<string | null>(null);
  const [glbUrl, setGlbUrl] = useState<string | undefined>(undefined);
  const [glbArtifact, setGlbArtifact] = useState<{ uri: string; type: string; bytes: number; sha256: string } | null>(null);
  const [creditBlock, setCreditBlock] = useState<PreflightResult | null>(null);
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');

  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { pollAbortRef.current?.abort(); }, []);

  const simulateGeneration = useCallback(async () => {
    if (isGenerating) return;
    const hasImage = !!referenceImage;
    const hasPrompt = !!prompt.trim();
    if (!hasImage && !hasPrompt) {
      toast.error('Upload an image or describe your ring first');
      return;
    }

    const workflow = hasImage ? CAD_IMAGE_GENERATION_WORKFLOW : CAD_GENERATION_WORKFLOW;
    const modelKey = `${workflow}:${model}`;
    const requiredCredits = TOOL_COSTS[modelKey] ?? TOOL_COSTS.cad_generation ?? 5;

    try {
      const tier = resolveCadGenerationTier(model);
      const result = await performCreditPreflight(workflow, 1, { model, pricingContext: { tier } });
      const balance = result.currentBalance;
      const cost = result.estimatedCredits > 0 ? result.estimatedCredits : requiredCredits;
      if (balance < cost) {
        setCreditBlock({ approved: false, estimatedCredits: cost, currentBalance: balance });
        trackPaywallHit({ category: 'ring', steps_completed: 1 });
        return;
      }
      setCreditBlock(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return;
      console.error('[ImageToCAD Preflight] failed, skipping block:', err);
      setCreditBlock(null);
    }

    const cadGenStartTime = Date.now();
    setWorkspaceActive(true);
    setIsGenerating(true);
    setGenerationFailed(false);
    setRetryAttempt(0);
    setHasModel(false);
    setSourceWorkflowId(null);
    setProgressStep(hasImage ? 'generate_from_sketch' : 'generate_initial');

    try {
      let requestBody: object;
      if (hasImage) {
        const dataUri = await fileToDataUri(referenceImage!);
        requestBody = buildImageCadStartBody(dataUri, prompt, model);
      } else {
        requestBody = buildCadGenerationStartBody(prompt, model);
      }

      const startRes = await authenticatedFetch(`/api/run/${workflow}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to start generation (${startRes.status})`);
      }

      const { workflow_id } = await startRes.json();
      if (!workflow_id) throw new Error('No workflow_id returned');

      pollAbortRef.current?.abort();
      const pollAbort = new AbortController();
      pollAbortRef.current = pollAbort;

      let genPollResult: PollWorkflowResult<CadGenerationResult>;
      try {
        genPollResult = await pollWorkflow<CadGenerationResult>({
          mode: 'status-then-result',
          fetchStatus: () => authenticatedFetch(
            `/api/status/${encodeURIComponent(workflow_id)}`,
            { signal: pollAbort.signal }
          ),
          fetchResult: () => authenticatedFetch(`/api/result/${encodeURIComponent(workflow_id)}`),
          resolveState: (statusData) => {
            const s = statusData as { runtime?: { state?: string }; progress?: { state?: string }; state?: string };
            const state = (s.runtime?.state || s.progress?.state || s.state || 'unknown').toLowerCase();
            return (state === 'failed' || state === 'budget_exhausted' || state === 'terminated' || state === 'cancelled' || state === 'timed_out' || state === 'timeout') ? 'completed' : state;
          },
          resolveProgressNode: resolveCadProgressNode,
          parseResult: (d) => parseCadResult(d, 'generation'),
          onProgress: ({ node, retryCount }) => {
            setProgressStep(node);
            if (retryCount > 0) setRetryAttempt(retryCount);
          },
          onStatusData: (statusData) => {
            const s = statusData as { runtime?: { state?: string } };
            const state = (s.runtime?.state || '').toLowerCase();
            if (state === 'failed' || state === 'budget_exhausted') setProgressStep('failed_final');
          },
          intervalMs: 2000,
          timeoutMs: 60 * 60 * 1000,
          max404s: 13,
          maxPollErrors: 10,
          maxResultRetries: 1,
          signal: pollAbort.signal,
        });
      } catch (err) {
        if (err instanceof AuthExpiredError) return;
        throw err;
      }

      if (genPollResult.status === 'cancelled') return;

      const { glb_url, artifact: genArtifact } = genPollResult.result;
      setGlbArtifact(genArtifact);
      setGlbUrl(glb_url);
      trackCadGenerationCompleted({
        category: 'ring',
        prompt_length: prompt.trim().length,
        duration_ms: Date.now() - cadGenStartTime,
      });
      setProgressStep('_loading');
      setIsModelLoading(true);
      setIsGenerating(false);
      refreshCredits().catch(() => {});
      setHasModel(true);
      setSourceWorkflowId(workflow_id);
    } catch (err) {
      console.error('ImageToCAD generation failed:', err);
      setIsGenerating(false);
      setProgressStep('');
      setGenerationFailed(true);
    }
  }, [prompt, model, referenceImage, isGenerating, refreshCredits]);

  const runEditWithPrompt = useCallback(async (promptText: string, label: string) => {
    if (!promptText.trim()) { toast.error('Please describe the edit'); return; }
    if (isGenerating || isEditing) return;
    if (!sourceWorkflowId) { toast.error('Generate a ring before editing'); return; }

    const modelKey = `${CAD_EDIT_WORKFLOW}:${model}`;
    const requiredCredits = TOOL_COSTS[modelKey] ?? TOOL_COSTS[CAD_EDIT_WORKFLOW] ?? 5;
    try {
      const result = await performCreditPreflight(CAD_EDIT_WORKFLOW, 1, { model });
      const balance = result.currentBalance;
      const cost = result.estimatedCredits > 0 ? result.estimatedCredits : requiredCredits;
      if (balance < cost) {
        setCreditBlock({ approved: false, estimatedCredits: cost, currentBalance: balance });
        return;
      }
      setCreditBlock(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return;
      console.error('[ImageToCAD Edit Preflight] failed:', err);
      setCreditBlock(null);
    }

    pushUndo(label);
    setIsEditing(true);
    setIsGenerating(true);
    setRetryAttempt(0);
    setProgressStep('generate_initial');

    try {
      const startRes = await authenticatedFetch(`/api/run/${CAD_EDIT_WORKFLOW}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCadEditStartBody(promptText, sourceWorkflowId, model, getStoredToken(), userId)),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to start edit (${startRes.status})`);
      }

      const { workflow_id } = await startRes.json();
      if (!workflow_id) throw new Error('No workflow_id returned');

      pollAbortRef.current?.abort();
      const pollAbort = new AbortController();
      pollAbortRef.current = pollAbort;

      let editPollResult: PollWorkflowResult<CadGenerationResult>;
      try {
        editPollResult = await pollWorkflow<CadGenerationResult>({
          mode: 'status-then-result',
          fetchStatus: () => authenticatedFetch(
            `/api/status/${encodeURIComponent(workflow_id)}`,
            { signal: pollAbort.signal }
          ),
          fetchResult: () => authenticatedFetch(`/api/result/${encodeURIComponent(workflow_id)}`),
          resolveState: (statusData) => {
            const s = statusData as { runtime?: { state?: string }; progress?: { state?: string }; state?: string };
            const state = (s.runtime?.state || s.progress?.state || s.state || 'unknown').toLowerCase();
            return (state === 'failed' || state === 'budget_exhausted' || state === 'terminated' || state === 'cancelled' || state === 'timed_out' || state === 'timeout') ? 'completed' : state;
          },
          resolveTerminalNode: resolveCadTerminalNode,
          resolveProgressNode: resolveCadProgressNode,
          parseResult: (d) => parseCadResult(d, 'edit'),
          onProgress: ({ node, retryCount }) => {
            setProgressStep(node);
            if (retryCount > 0) setRetryAttempt(retryCount);
          },
          onStatusData: (statusData) => {
            const s = statusData as { runtime?: { state?: string } };
            const state = (s.runtime?.state || '').toLowerCase();
            if (state === 'failed' || state === 'budget_exhausted') setProgressStep('failed_final');
          },
          intervalMs: 2000,
          timeoutMs: 60 * 60 * 1000,
          max404s: 13,
          maxPollErrors: 10,
          maxResultRetries: 1,
          signal: pollAbort.signal,
        });
      } catch (err) {
        if (err instanceof AuthExpiredError) return;
        throw err;
      }

      if (editPollResult.status === 'cancelled') return;

      const { glb_url, artifact: editArtifact } = editPollResult.result;
      setGlbArtifact(editArtifact);
      setGlbUrl(glb_url);
      setProgressStep('_loading');
      setIsModelLoading(true);
      setIsGenerating(false);
      setIsEditing(false);
      refreshCredits().catch(() => {});
      setHasModel(true);
      setSourceWorkflowId(workflow_id);
      toast.success(`${label} applied`);
    } catch (err) {
      console.error(`Edit "${label}" failed:`, err);
      toast.error(err instanceof Error ? err.message : 'Edit failed');
      setIsGenerating(false);
      setIsEditing(false);
      setProgressStep('');
    }
  }, [model, isGenerating, isEditing, sourceWorkflowId, pushUndo, userId, refreshCredits]);

  const simulateEdit = useCallback(async () => {
    await runEditWithPrompt(editPrompt, 'AI edit');
    setEditPrompt('');
  }, [editPrompt, runEditWithPrompt]);

  const resetWorkflow = useCallback(() => {
    setEditPrompt('');
    setHasModel(false);
    setRetryAttempt(0);
    setProgressStep('');
    setSourceWorkflowId(null);
    setGenerationFailed(false);
    if (glbUrl) URL.revokeObjectURL(glbUrl);
    setGlbUrl(undefined);
    setGlbArtifact(null);
    setCreditBlock(null);
  }, [glbUrl]);

  return {
    isGenerating, isEditing,
    hasModel, setHasModel,
    isModelLoading, setIsModelLoading,
    progressStep, setProgressStep,
    retryAttempt,
    generationFailed, setGenerationFailed,
    creditBlock, setCreditBlock,
    glbUrl, setGlbUrl,
    glbArtifact, setGlbArtifact,
    sourceWorkflowId, setSourceWorkflowId,
    workspaceActive, setWorkspaceActive,
    editPrompt, setEditPrompt,
    simulateGeneration, simulateEdit,
    resetWorkflow,
  };
}
