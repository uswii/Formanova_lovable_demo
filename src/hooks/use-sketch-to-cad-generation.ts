/**
 * useSketchToCadGeneration
 *
 * Encapsulates the full sketch upload + CAD generation workflow:
 *   1. Credit preflight
 *   2. Image read as base64 data URI
 *   3. POST /api/run/sketch_generate_v1  (base64 sent directly -- backend handles CAS normalization)
 *   4. Poll /api/status -> /api/result
 *   5. Parse GLB artifact
 *
 * Kept separate from the page so SketchToCAD.tsx stays under 500 lines
 * and API/polling concerns are isolated from rendering (AI_RULES Rule 8).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AuthExpiredError, authenticatedFetch } from '@/lib/authenticated-fetch';
import { useCredits } from '@/contexts/CreditsContext';
import { performCreditPreflight, type PreflightResult } from '@/lib/credit-preflight';
import { TOOL_COSTS } from '@/lib/credits-api';
import { pollWorkflow } from '@/lib/poll-workflow';
import {
  resolveCadTerminalNode,
  resolveCadProgressNode,
  parseCadResult,
  type CadGenerationResult,
  type CadGlbArtifact,
} from '@/lib/cad-poll-resolvers';
import {
  SKETCH_TO_CAD_WORKFLOW,
  buildSketchToCadStartBody,
} from '@/lib/sketch-to-cad-workflows';
import { trackPaywallHit } from '@/lib/posthog-events';

export interface SketchGenerationResult {
  glbUrl: string;
  artifact: CadGlbArtifact;
  workflowId: string;
  durationMs: number;
}

interface UseSketchToCadOptions {
  onProgress: (step: string, retry: number) => void;
  onSuccess: (result: SketchGenerationResult) => void;
  onFailed: () => void;
}

interface UseSketchToCadReturn {
  generate: (file: File, description?: string) => Promise<void>;
  isGenerating: boolean;
  creditBlock: PreflightResult | null;
  setCreditBlock: (b: PreflightResult | null) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function useSketchToCadGeneration(
  options: UseSketchToCadOptions,
): UseSketchToCadReturn {
  const { onProgress, onSuccess, onFailed } = options;
  const { refreshCredits } = useCredits();

  const [isGenerating, setIsGenerating] = useState(false);
  const [creditBlock, setCreditBlock] = useState<PreflightResult | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  // Cancel in-flight poll on unmount
  useEffect(() => {
    return () => { pollAbortRef.current?.abort(); };
  }, []);

  const generate = useCallback(async (file: File, description?: string) => {
    if (isGenerating) return;

    const requiredCredits = TOOL_COSTS[SKETCH_TO_CAD_WORKFLOW] ?? 85;
    try {
      const result = await performCreditPreflight(SKETCH_TO_CAD_WORKFLOW, 1);
      const balance = result.currentBalance;
      const cost = result.estimatedCredits > 0 ? result.estimatedCredits : requiredCredits;
      if (balance < cost) {
        setCreditBlock({ approved: false, estimatedCredits: cost, currentBalance: balance });
        trackPaywallHit({ category: 'sketch', steps_completed: 1 });
        return;
      }
      setCreditBlock(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return;
      console.error('[SketchToCAD Preflight] failed, skipping block:', err);
      setCreditBlock(null);
    }

    const startTime = Date.now();
    setIsGenerating(true);
    onProgress('generate_from_sketch', 0);

    try {
      // Read sketch as base64 data URI -- backend accepts up to ~10MB directly
      const referenceImage = await readFileAsDataUrl(file);

      // Start workflow
      const startRes = await authenticatedFetch(`/api/run/${SKETCH_TO_CAD_WORKFLOW}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSketchToCadStartBody(referenceImage, description)),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to start sketch generation (${startRes.status})`);
      }

      const { workflow_id } = await startRes.json();
      if (!workflow_id) throw new Error('No workflow_id returned');
      console.log('[SketchToCAD] Workflow started:', workflow_id);

      // Poll until complete
      pollAbortRef.current?.abort();
      const pollAbort = new AbortController();
      pollAbortRef.current = pollAbort;

      const pollResult = await pollWorkflow<CadGenerationResult>({
        mode: 'status-then-result',
        fetchStatus: () => authenticatedFetch(
          `/api/status/${encodeURIComponent(workflow_id)}`,
          { signal: pollAbort.signal },
        ),
        fetchResult: () => authenticatedFetch(`/api/result/${encodeURIComponent(workflow_id)}`),
        resolveState: (statusData) => {
          const s = statusData as { runtime?: { state?: string }; progress?: { state?: string }; state?: string };
          const state = (s.runtime?.state || s.progress?.state || s.state || 'unknown').toLowerCase();
          return (
            state === 'failed' || state === 'budget_exhausted' || state === 'terminated' ||
            state === 'cancelled' || state === 'timed_out' || state === 'timeout'
          ) ? 'completed' : state;
        },
        resolveTerminalNode: resolveCadTerminalNode,
        resolveProgressNode: resolveCadProgressNode,
        parseResult: (d) => parseCadResult(d, 'generation'),
        onProgress: ({ node, retryCount }) => {
          onProgress(node, retryCount);
        },
        onStatusData: (statusData) => {
          const s = statusData as { runtime?: { state?: string } };
          const state = (s.runtime?.state || '').toLowerCase();
          if (state === 'failed' || state === 'budget_exhausted') {
            onProgress('failed_final', 0);
          }
        },
        intervalMs: 2000,
        timeoutMs: 60 * 60 * 1000,
        max404s: 13,
        maxPollErrors: 10,
        maxResultRetries: 1,
        signal: pollAbort.signal,
      });

      if (pollResult.status === 'cancelled') return;

      const { glb_url, artifact } = pollResult.result;
      refreshCredits().catch(() => {});
      onSuccess({
        glbUrl: glb_url,
        artifact,
        workflowId: workflow_id,
        durationMs: Date.now() - startTime,
      });

    } catch (err) {
      if (err instanceof AuthExpiredError) return;
      console.error('[SketchToCAD] Generation failed:', err);
      toast.error(err instanceof Error ? err.message : 'Sketch generation failed');
      onFailed();
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, onProgress, onSuccess, onFailed, refreshCredits]);

  return { generate, isGenerating, creditBlock, setCreditBlock };
}
