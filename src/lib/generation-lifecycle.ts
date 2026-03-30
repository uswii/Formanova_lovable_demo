/**
 * Global generation lifecycle helpers.
 *
 * Sets window.__generationInProgress / window.__activeGenerationId
 * and fires custom events so other subsystems (version polling,
 * ChunkErrorBoundary) can react.
 */

declare global {
  interface Window {
    __generationInProgress?: boolean;
    __activeGenerationId?: string | null;
  }
}

export function markGenerationStarted(generationId: string) {
  window.__generationInProgress = true;
  window.__activeGenerationId = generationId;

  // PostHog tracking
  import('posthog-js')
    .then(({ default: posthog }) => {
      if (posthog.__loaded) {
        posthog.capture('generation_started', { generation_id: generationId });
      }
    })
    .catch(() => {});
}

export function markGenerationCompleted(generationId: string, startTime?: number) {
  window.__generationInProgress = false;
  window.__activeGenerationId = null;
  window.dispatchEvent(new CustomEvent('generation:complete'));

}

export function markGenerationFailed(generationId: string, errorMessage?: string, startTime?: number) {
  window.__generationInProgress = false;
  window.__activeGenerationId = null;
  window.dispatchEvent(new CustomEvent('generation:complete'));

  import('posthog-js')
    .then(({ default: posthog }) => {
      if (posthog.__loaded) {
        posthog.capture('generation_failed', {
          generation_id: generationId,
          error: errorMessage,
          ...(startTime ? { duration_ms: Date.now() - startTime } : {}),
        });
      }
    })
    .catch(() => {});
}
