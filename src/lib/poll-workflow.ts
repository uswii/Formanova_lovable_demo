/**
 * poll-workflow.ts
 *
 * Domain-agnostic workflow polling helper.
 * Supports two modes:
 *   'status-then-result' - poll /api/status until terminal, then fetch /api/result
 *   'result-direct'      - poll /api/result directly until data.status != running
 *
 * The helper owns lifecycle only. Result parsing, progress UI, and side effects
 * (credit refresh, analytics) stay in the caller.
 *
 * See docs/POLLING_AND_RESULT_PARSING_PLAN.md for design rationale.
 */

import { AuthExpiredError } from '@/lib/authenticated-fetch';

// -- Return type --

export type PollWorkflowResult<TResult> =
  | { status: 'completed'; result: TResult }
  | { status: 'cancelled'; result?: never };

// -- Options --

export interface PollWorkflowOptions<TResult> {
  /**
   * Mode:
   *   'status-then-result' (default) - poll status until terminal, then retry-fetch result.
   *   'result-direct' - poll result endpoint directly until data.status !== resultRunningValue.
   */
  mode?: 'status-then-result' | 'result-direct';

  /**
   * Called to fetch /api/status/{workflowId}.
   * Required for status-then-result mode.
   */
  fetchStatus?: () => Promise<Response>;

  /**
   * Called to fetch /api/result/{workflowId}.
   * Required in both modes.
   */
  fetchResult: () => Promise<Response>;

  /**
   * Resolves the terminal state from a parsed status response.
   * Returns: 'completed' | 'failed' | 'running' | any other string (treated as running).
   * Default: reads statusData.runtime?.state || statusData.progress?.state || statusData.state
   */
  resolveState?: (statusData: unknown) => string;

  /**
   * Optional: CAD-specific terminal node check.
   * Returns 'success' | 'failure' | null (null = not terminal).
   * Evaluated after resolveState when the state is not yet terminal.
   */
  resolveTerminalNode?: (statusData: unknown) => 'success' | 'failure' | null;

  /**
   * Optional: extract progress info for UI callbacks.
   * Invoked after each successful status poll when onProgress is provided.
   */
  resolveProgressNode?: (statusData: unknown) => { node: string; retryCount: number } | null;

  /**
   * Caller-supplied result parser. Keeps the helper domain-agnostic.
   * Receives the parsed JSON from /api/result. May throw to signal a result-level failure.
   */
  parseResult: (resultData: unknown) => TResult;

  /** Poll interval in ms. Default: 2000. */
  intervalMs?: number;

  /**
   * Hard wall-clock timeout in ms. Default: 120 000 (2 min).
   * Throws a timeout error when exceeded.
   */
  timeoutMs?: number;

  /**
   * Maximum consecutive 404 responses on the STATUS endpoint before throwing.
   * Default: 3. Only applies to status-then-result mode.
   */
  max404s?: number;

  /**
   * Maximum total non-ok / thrown poll errors on the STATUS endpoint before rethrowing.
   * Default: 10. Only applies to status-then-result mode.
   */
  maxPollErrors?: number;

  /**
   * Maximum number of status poll iterations (count-based, not time-based).
   * When reached without a terminal state, takes the action specified by onStatusExhausted.
   * If undefined, polling continues until timeoutMs expires.
   * Only applies to status-then-result mode.
   */
  maxStatusPolls?: number;

  /**
   * What to do when maxStatusPolls iterations complete without a terminal state.
   * 'throw' (default): throw an error.
   * 'fetch-result': break out of the status loop and attempt the result fetch anyway.
   * Only applies when maxStatusPolls is set.
   */
  onStatusExhausted?: 'throw' | 'fetch-result';

  /**
   * How to handle non-ok (non-404) status responses.
   * 'count-error' (default): count against maxPollErrors budget and eventually throw.
   * 'continue': silently skip without counting as an error (matches callers that
   *   treat transient HTTP errors as "not ready yet").
   * Only applies to status-then-result mode.
   */
  statusNonOkBehavior?: 'continue' | 'count-error';

  /**
   * Number of result-fetch attempts (including the first) on /api/result.
   * Retries on 404 only. Default: 5.
   * Only applies to status-then-result mode.
   */
  maxResultRetries?: number;

  /** Delay between result retries in ms. Default: 1000. */
  resultRetryDelayMs?: number;

  /**
   * Caller-owned AbortSignal. When aborted, the helper returns { status: 'cancelled' }.
   * The helper does NOT create its own AbortController.
   */
  signal?: AbortSignal;

  /**
   * Called after each status poll when resolveProgressNode returns a value.
   * Suitable for updating setProgressStep / setRetryAttempt in the page.
   */
  onProgress?: (info: { node: string; retryCount: number }) => void;

  /**
   * Called after each successful status JSON parse, before terminal-state checks.
   * Not called on 404 or non-ok responses (those skip JSON parsing).
   * Use this to update progress UI from raw status data without coupling the
   * caller to resolveProgressNode's CAD-specific shape.
   */
  onStatusData?: (statusData: unknown) => void;

  /**
   * result-direct mode only: the value of data.status that means still running.
   * Default: 'running'.
   */
  resultRunningValue?: string;
}

// -- Default state resolver --

function defaultResolveState(statusData: unknown): string {
  if (!statusData || typeof statusData !== 'object') return 'unknown';
  const d = statusData as { runtime?: { state?: string }; progress?: { state?: string }; state?: string };
  return d.runtime?.state || d.progress?.state || d.state || 'unknown';
}

// -- Helpers --

function isCancelled(signal?: AbortSignal): boolean {
  return !!signal?.aborted;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// -- Main function --

export async function pollWorkflow<TResult>(
  options: PollWorkflowOptions<TResult>,
): Promise<PollWorkflowResult<TResult>> {
  const {
    mode = 'status-then-result',
    fetchStatus,
    fetchResult,
    resolveState = defaultResolveState,
    resolveTerminalNode,
    resolveProgressNode,
    parseResult,
    intervalMs = 2000,
    timeoutMs = 120_000,
    max404s = 3,
    maxPollErrors = 10,
    maxResultRetries = 5,
    resultRetryDelayMs = 1000,
    maxStatusPolls,
    onStatusExhausted = 'throw',
    statusNonOkBehavior = 'count-error',
    signal,
    onProgress,
    onStatusData,
    resultRunningValue = 'running',
  } = options;

  const deadline = Date.now() + timeoutMs;

  // ------------------------------------------------------------------ //
  // result-direct mode: poll /api/result until status != running        //
  // ------------------------------------------------------------------ //

  if (mode === 'result-direct') {
    while (Date.now() < deadline) {
      if (isCancelled(signal)) return { status: 'cancelled' };

      await sleep(intervalMs);

      if (isCancelled(signal)) return { status: 'cancelled' };
      if (Date.now() > deadline) break;

      let res: Response;
      try {
        res = await fetchResult();
      } catch (err) {
        if (err instanceof AuthExpiredError) throw err;
        if (err instanceof Error && err.name === 'AbortError') return { status: 'cancelled' };
        throw err;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Polling failed: ${res.status}`);
      }

      const data = await res.json();
      if (data?.status === resultRunningValue) continue;

      return { status: 'completed', result: parseResult(data) };
    }

    throw new Error(`Workflow timed out after ${timeoutMs}ms`);
  }

  // ------------------------------------------------------------------ //
  // status-then-result mode: poll /api/status until terminal state,     //
  // then retry-fetch /api/result                                         //
  // ------------------------------------------------------------------ //

  if (!fetchStatus) {
    throw new Error('pollWorkflow: fetchStatus is required in status-then-result mode');
  }

  let consecutive404s = 0;
  let pollErrors = 0;
  let pollCount = 0;

  while (true) {
    if (isCancelled(signal)) return { status: 'cancelled' };

    if (Date.now() > deadline) {
      throw new Error(`Workflow timed out after ${timeoutMs}ms`);
    }

    // -- Count-based exhaustion check (before sleep, so exactly maxStatusPolls fetches run) --
    if (maxStatusPolls !== undefined && pollCount >= maxStatusPolls) {
      if (onStatusExhausted === 'fetch-result') break;
      throw new Error(`Status polling exhausted ${maxStatusPolls} attempts without completing`);
    }

    await sleep(intervalMs);
    pollCount++;

    if (isCancelled(signal)) return { status: 'cancelled' };
    if (Date.now() > deadline) throw new Error(`Workflow timed out after ${timeoutMs}ms`);

    // -- Fetch status --
    let statusRes: Response;
    try {
      statusRes = await fetchStatus();
    } catch (err) {
      if (err instanceof AuthExpiredError) throw err;
      if (err instanceof Error && err.name === 'AbortError') return { status: 'cancelled' };
      pollErrors++;
      if (pollErrors >= maxPollErrors) throw err;
      continue;
    }

    // -- 404 budget --
    if (statusRes.status === 404) {
      consecutive404s++;
      if (consecutive404s >= max404s) {
        throw new Error(`Workflow not found after ${max404s} consecutive 404 responses`);
      }
      continue;
    }
    consecutive404s = 0;

    // -- Non-ok budget --
    if (!statusRes.ok) {
      if (statusNonOkBehavior === 'continue') { continue; }
      pollErrors++;
      if (pollErrors >= maxPollErrors) {
        throw new Error(`Status polling failed ${maxPollErrors} times (last status: ${statusRes.status})`);
      }
      continue;
    }
    pollErrors = 0;

    // -- Parse status --
    const statusData = await statusRes.json();
    const state = resolveState(statusData).toLowerCase();

    // -- Raw status data callback (before terminal checks) --
    if (onStatusData) onStatusData(statusData);

    // -- Progress callback --
    if (onProgress && resolveProgressNode) {
      const progress = resolveProgressNode(statusData);
      if (progress) onProgress(progress);
    }

    // -- Terminal state check --
    if (state === 'completed') {
      break;
    }

    if (state === 'failed' || state === 'budget_exhausted') {
      const d = statusData as { error?: string; message?: string };
      throw new Error(d.error || d.message || `Workflow ${state}`);
    }

    // -- Optional terminal node check (CAD) --
    if (resolveTerminalNode) {
      const nodeResult = resolveTerminalNode(statusData);
      if (nodeResult === 'success') break;
      if (nodeResult === 'failure') throw new Error('Workflow failed at terminal node');
    }
  }

  // -- Fetch result with retry on 404 --
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxResultRetries; attempt++) {
    if (isCancelled(signal)) return { status: 'cancelled' };

    if (attempt > 1) {
      await sleep(resultRetryDelayMs);
    }

    let resultRes: Response;
    try {
      resultRes = await fetchResult();
    } catch (err) {
      if (err instanceof AuthExpiredError) throw err;
      if (err instanceof Error && err.name === 'AbortError') return { status: 'cancelled' };
      throw err;
    }

    if (resultRes.status === 404) {
      lastError = new Error(`Result not ready (404) after attempt ${attempt}`);
      continue;
    }

    if (!resultRes.ok) {
      const body = await resultRes.json().catch(() => ({}));
      throw new Error(body?.error || `Result fetch failed: ${resultRes.status}`);
    }

    const resultData = await resultRes.json();
    return { status: 'completed', result: parseResult(resultData) };
  }

  throw lastError || new Error('Result fetch exhausted all retries');
}
