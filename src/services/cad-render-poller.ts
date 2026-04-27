import type { CameraAngle, RuntimeStateResponse } from './cad-render-api';
import { submitCadRenderAngle, fetchCadRenderState } from './cad-render-api';
import { extractRenderImageUrl } from './cad-render-parser';

// ── AI_RULES.md §5 contract ──────────────────────────────────────────────────
const START_ENDPOINT       = '/api/run/state/cad_render_v1';        // see cad-render-api.ts
const STATUS_ENDPOINT      = (id: string) => `/api/runtime/state/${id}`;  // see cad-render-api.ts
const POLL_INTERVAL_MS     = 3_000;
const POLL_TIMEOUT_MS      = 5 * 60 * 1_000;                        // 5 minutes
const TERMINAL_STATES      = new Set(['completed', 'failed', 'budget_exhausted']);
const TRANSIENT_POLICY     = 'retry up to MAX_CONSECUTIVE_ERRORS ticks, then fail';
const MAX_CONSECUTIVE_ERRORS = 5;
// Cancellation: caller passes `cancelled` callback; checked before each sleep and each tick.
// ─────────────────────────────────────────────────────────────────────────────

// Re-export so consumers can reference the endpoints without importing cad-render-api.
export { START_ENDPOINT, STATUS_ENDPOINT, POLL_INTERVAL_MS, POLL_TIMEOUT_MS };

export type WorkflowFinalState = 'completed' | 'failed' | 'budget_exhausted';

export interface RenderResult {
  angle: CameraAngle;
  imageUrl: string; // /api/artifacts/<sha256> proxy URL — load via useAuthenticatedImage
}

export interface RenderError {
  angle: CameraAngle;
  finalState: WorkflowFinalState;
}

export interface RenderAnglesOptions {
  angles: CameraAngle[];
  onResult:  (result: RenderResult) => void;
  onError:   (error: RenderError)   => void;
  onAllDone: ()                     => void;
  /** Return true to stop polling — set to true on component unmount. */
  cancelled: () => boolean;
}

export async function renderAngles({
  angles,
  onResult,
  onError,
  onAllDone,
  cancelled,
}: RenderAnglesOptions): Promise<void> {
  if (angles.length === 0) { onAllDone(); return; }

  // 1. Submit all angles in parallel — each gets its own workflow_id
  const submissions = await Promise.all(
    angles.map(async (angle) => {
      const workflowId = await submitCadRenderAngle(angle);
      return { angle, workflowId };
    }),
  );

  const pending      = new Map(submissions.map(({ angle, workflowId }) => [workflowId, angle]));
  const errorCounts  = new Map<string, number>();
  const startedAt    = Date.now();

  // 2. Poll until all workflows settle, timeout, or caller cancels
  while (pending.size > 0) {
    if (cancelled()) return;

    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      for (const [, angle] of pending) {
        onError({ angle, finalState: 'failed' });
      }
      break;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    if (cancelled()) return;

    await Promise.all(
      Array.from(pending.entries()).map(async ([workflowId, angle]) => {
        let state: RuntimeStateResponse | null;
        try {
          state = await fetchCadRenderState(workflowId);
        } catch {
          // Unrecoverable HTTP error — count against error limit
          const count = (errorCounts.get(workflowId) ?? 0) + 1;
          errorCounts.set(workflowId, count);
          if (count >= MAX_CONSECUTIVE_ERRORS) {
            onError({ angle, finalState: 'failed' });
            pending.delete(workflowId);
          }
          return;
        }

        if (!state) {
          // Transient (404/502/503/504) — increment error count, keep retrying
          const count = (errorCounts.get(workflowId) ?? 0) + 1;
          errorCounts.set(workflowId, count);
          if (count >= MAX_CONSECUTIVE_ERRORS) {
            onError({ angle, finalState: 'failed' });
            pending.delete(workflowId);
          }
          return;
        }

        // Successful poll — reset consecutive error count
        errorCounts.set(workflowId, 0);
        const { state: wfState } = state.runtime;
        if (!TERMINAL_STATES.has(wfState)) return; // still running

        pending.delete(workflowId);

        if (wfState === 'completed') {
          const imageUrl = extractRenderImageUrl(state);
          if (imageUrl) {
            onResult({ angle, imageUrl });
          } else {
            onError({ angle, finalState: 'failed' });
          }
        } else {
          onError({ angle, finalState: wfState as WorkflowFinalState });
        }
      }),
    );
  }

  onAllDone();
}
