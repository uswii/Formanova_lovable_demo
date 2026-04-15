# Polling and Result Parsing Plan

Design document for Phase 6: shared polling helper.
No runtime code changes in this phase.

---

## 1. Current Polling Loops

Six distinct polling loops exist across three files.
One additional generic helper (`pollJobUntilComplete`) exists but is not wired to any high-risk generation flow.

---

### Loop 1 - UnifiedStudio photo/product-shot generation

**File:** `src/pages/UnifiedStudio.tsx:1111-1171`
**Triggered by:** `startPhotoshoot()` or `startPdpShot()` returning a `workflow_id`

| Property | Value |
|---|---|
| Endpoint polled | `/api/status/{workflowId}` via `getPhotoshootStatus()` |
| Interval | 3000 ms |
| Timeout | 720 000 ms (12 min) - wall-clock `Date.now()` check |
| 404 behavior | Handled inside `getPhotoshootStatus()`: returns `{ state: 'running' }`. The loop never sees a 404 directly. |
| Error limit | None. Any thrown error from `getPhotoshootStatus()` propagates immediately to outer catch. |
| Success condition | `resolveWorkflowState(status) === 'completed'` |
| Failure condition | `resolveWorkflowState(status) === 'failed'` |
| Result parser | `extractResultImages(result)` - iterates all node keys, collects items with `output_url`, `image_url`, `result_url`, `url`, or `base64` fields |
| Result-level failure | After status completed, scans all items for `action === 'error'` or `status === 'failed'`; if found, sets `generationError = 'workflow-failed'` without throwing |
| Cancellation | No `AbortController`. No cancel path. Timeout is only exit besides success/failure. |
| Side effects in loop | Updates `generationProgress` and `generationStep` from `status.progress.visited` |
| Post-poll side effects | `refreshCredits()`, PostHog tracking, `markGenerationCompleted()` |

**Coupling note (from probe5):** Progress ticker (300 ms `setInterval`) runs in parallel; polling drives the real progress percentage. Both live in the same `handleGenerate` function in the page.

---

### Loop 2 - TextToCAD generation (status phase)

**File:** `src/pages/TextToCAD.tsx:393-455`
**Triggered by:** `/api/run/ring_generate_v1` returning `workflow_id`

| Property | Value |
|---|---|
| Endpoint polled | `/api/status/{workflowId}` (direct `authenticatedFetch`) |
| Interval | 2000 ms |
| Timeout | 3 600 000 ms (60 min) |
| 404 behavior | Increments `consecutive404s`; throws after 3 consecutive 404s |
| Error limit | Up to 10 non-ok/thrown errors (`pollErrors`) before rethrowing |
| Success condition | `state === 'completed'` OR terminal success node reached (`success_final`, `success_original_glb`) |
| Failure condition | `state === 'failed'` or `state === 'budget_exhausted'` OR node `failed_final` active/last-exited |
| Terminal nodes | `success_final`, `success_original_glb`, `failed_final` |
| Result parser | Checks `result['failed_final']`, then `result['success_final'][0].glb_artifact` or `.original_glb_artifact`, then `result['success_original_glb'][0].original_glb_artifact` |
| Cancellation | `pollAbortRef.current` - `AbortController`. Aborted when a new generation starts (previous is cancelled). `AbortError` returns silently. `AuthExpiredError` returns silently. |
| Progress fields read | `runtime.active_nodes[0]`, `runtime.last_exit_node_id`, `node_visit_seq.generate_fix` |

**Result fetch after status (Loop 2 continued):** Up to 5 attempts at `/api/result/{workflowId}`. 404 retries with 1 s delay. Non-ok and non-404 throws immediately.

---

### Loop 3 - TextToCAD edit (status phase)

**File:** `src/pages/TextToCAD.tsx:571-613`

Structurally identical to Loop 2. Same interval, timeout, 404 limit, error limit, terminal states, `AbortController` pattern, result fetch shape. Differs only in the error message text and which state variables are updated (`setProgressStep`, `setRetryAttempt`).

**Duplication:** Loops 2 and 3 are copy-pasted with minor string differences. This is the primary driver for extracting a shared helper.

---

### Loop 4 - TextToCAD weight estimation (result-direct)

**File:** `src/pages/TextToCAD.tsx:850-862`

| Property | Value |
|---|---|
| Endpoint polled | `/api/result/{workflowId}` DIRECTLY (no status phase) |
| Interval | 2000 ms |
| Timeout | 120 000 ms (2 min) |
| 404 behavior | Not handled separately. Non-ok response throws immediately. |
| Error limit | Any non-ok throws immediately. |
| Success condition | `data?.status !== 'running'` - i.e., any non-running response is considered done |
| Failure condition | Non-ok HTTP response, or `result.success === false` (checked after loop) |
| Result parser | Reads `result.weight_14k_gold_g`, `result.weight_platinum_g`, `result.scale_warning` |
| Cancellation | No `AbortController`. Deadline-based only. |

**Different pattern:** Polls result directly instead of status-then-result. The backend writes running/done status into the result document itself.

---

### Loop 5 - TextToCAD STL export (result-direct)

**File:** `src/pages/TextToCAD.tsx:928-940`

Structurally identical to Loop 4. Differs only in timeout (300 000 ms / 5 min) and result parser:
- Checks `result.success`, `result.stl_artifact.uri`

---

### Loop 6 - Image classification (use-image-validation)

**File:** `src/hooks/use-image-validation.ts:196-241`

| Property | Value |
|---|---|
| Status endpoint | `/api/status/{workflowId}` |
| Result endpoint | `/api/result/{workflowId}` |
| Interval | 1000 ms (status); 1000 ms delay between result retries |
| Timeout | Hard `AbortController` abort at 120 000 ms (2 min) |
| Max status polls | 60 iterations (60 s max before loop exits regardless of state) |
| 404 behavior | Status 404 = `continue` (not ready, keep polling). No separate 404 counter. |
| Error limit | None inside the loop. Any thrown error from `authenticatedFetch` propagates to outer `catch`. |
| Success condition | `statusState === 'completed'` or `statusState === 'succeeded'` |
| Failure condition | `statusState === 'failed'` or `statusState === 'error'` - returns fallback flagged result (does NOT throw) |
| Result parser | Reads `image_captioning[0]`: extracts `label`, `reason`, `confidence`, `flagged`. Derives `is_worn` from reason or `WORN_CATEGORIES`. |
| Result retry | Up to 5 attempts on 404 with 1 s delay |
| Cancellation | `AbortController` at 120 s. `AbortError` -> logs timeout, returns `null`. |
| Auth expiry | `AuthExpiredError` is caught and rethrown (Phase 4 fix) - does not return fallback. |

---

### Existing generic helper (not wired to high-risk flows)

**File:** `src/lib/microservices-api.ts:53-82` - `pollJobUntilComplete`

- Accepts a `pollFn: () => Promise<{ status: string }>`, `maxAttempts` (default 120), `intervalMs` (default 1000 ms)
- Success: `status === 'completed' || status === 'succeeded'`
- Failure: `status === 'failed'`
- No 404 handling, no `AbortController`, no progress callback
- **Not used** by photo generation, CAD generation, or image validation
- Too rigid for current needs (wraps a user-provided pollFn, no separate result phase, no 404/error budgets)

---

## 2. Comparison Table

| | Loop 1 (photo) | Loop 2 (CAD gen) | Loop 3 (CAD edit) | Loop 4 (weight) | Loop 5 (STL) | Loop 6 (image-val) |
|---|---|---|---|---|---|---|
| Status endpoint | yes (via helper) | yes (inline) | yes (inline) | no | no | yes (inline) |
| Result endpoint | yes (via helper) | yes (inline) | yes (inline) | yes (inline) | yes (inline) | yes (inline) |
| Interval | 3 s | 2 s | 2 s | 2 s | 2 s | 1 s |
| Timeout | 12 min | 60 min | 60 min | 2 min | 5 min | 2 min |
| 404 limit | hidden in helper | 3 consecutive | 3 consecutive | throws | throws | continue |
| Error budget | none | 10 | 10 | throws | throws | none |
| AbortController | none | yes | yes | none | none | yes (timeout) |
| Terminal nodes | none | yes | yes | n/a | n/a | none |
| Progress callback | inline setters | inline setters | inline setters | none | none | none |
| Auth expiry re-throw | bubbles to catch | explicit | explicit | bubbles | bubbles | explicit |

---

## 3. Proposed Shared Helper API

The helper should be a plain async function, not a React hook.
React hooks impose lifecycle constraints that make it harder to call from event handlers and `useCallback` contexts (all current callers are inside callbacks).

```typescript
// src/lib/poll-workflow.ts

export interface PollWorkflowOptions<TResult> {
  // Required
  workflowId: string;

  // Status polling (required for status-then-result mode)
  // Omit for result-direct mode (Loops 4 and 5)
  fetchStatus?: () => Promise<Response>;

  // Result fetching (required)
  fetchResult: () => Promise<Response>;

  // State resolution (for status-then-result mode)
  // Returns: 'completed' | 'failed' | 'running' | string
  resolveState?: (statusData: unknown) => string;

  // Optional: terminal node check (CAD only)
  // Returns: 'success' | 'failure' | null (null = not terminal yet)
  resolveTerminalNode?: (statusData: unknown) => 'success' | 'failure' | null;

  // Optional: progress node extraction for UI callbacks (CAD only)
  resolveProgressNode?: (statusData: unknown) => { node: string; retryCount: number } | null;

  // Result mode
  // 'status-then-result': poll status until terminal, then fetch result (Loops 1, 2, 3, 6)
  // 'result-direct': poll result endpoint directly until not running (Loops 4, 5)
  mode?: 'status-then-result' | 'result-direct';

  // In result-direct mode: status field in the result document that indicates still running
  resultRunningValue?: string; // default: 'running'

  // Result parsing: caller-supplied, keeps helper domain-agnostic
  parseResult: (resultData: unknown) => TResult;

  // Timing
  intervalMs?: number;       // default: 2000
  timeoutMs?: number;        // default: 120 000

  // Error budgets
  max404s?: number;          // default: 3 (status-then-result); 0 = throw on first 404
  maxPollErrors?: number;    // default: 10 (status-then-result); 0 = throw immediately

  // Result retry
  maxResultRetries?: number; // default: 5
  resultRetryDelayMs?: number; // default: 1000

  // Cancellation
  signal?: AbortSignal;      // caller-owned AbortController signal

  // Callbacks
  onProgress?: (info: { node?: string; retryCount?: number }) => void;
}

export type PollWorkflowResult<TResult> =
  | { status: 'completed'; result: TResult }
  | { status: 'cancelled'; result?: never };

export async function pollWorkflow<TResult>(
  options: PollWorkflowOptions<TResult>,
): Promise<PollWorkflowResult<TResult>>
```

**Key decisions:**

1. `parseResult` is caller-supplied. The helper is lifecycle-only; it never knows about images, GLB artifacts, or classification labels. This keeps photo/CAD/validation parsing in their current locations.

2. `mode: 'result-direct'` replaces Loops 4 and 5. No status phase. Polls `/api/result` directly. Loop exits when `data[resultRunningValue]` is no longer present (or `data.status !== 'running'`).

3. `signal` is caller-supplied. TextToCAD needs `pollAbortRef.current` so it can abort previous generations. Callers that do not need cancellation omit the field. The helper checks `signal.aborted` before each iteration.

4. `resolveTerminalNode` is optional and CAD-specific. Photo and image-validation callers omit it.

5. `onProgress` replaces the inline `setProgressStep` / `setRetryAttempt` calls. The page passes a callback; the helper invokes it when `resolveProgressNode` returns a value.

6. `AuthExpiredError` is always rethrown (not caught). Callers handle it in their own catch block.

7. `AbortError` (from `signal`) returns `{ status: 'cancelled' }` - NOT a throw. The discriminated union makes it impossible to confuse cancelled with completed without a type check. Callers check `result.status === 'cancelled'` and return early. This matches current TextToCAD behavior where `AbortError` silently returns.

---

## 4. Migration Order

Ordered by risk (low to high) and independence (no shared state dependencies first).

### Step 1 - `use-image-validation.ts` (Loop 6)

**Why first:** Self-contained hook with existing tests (3 passing). The polling loop reads no external page state. A regression is caught immediately by test suite.

**Migration:** Replace the inline `for (let i = 0; i < maxPolls; i++)` loop with `pollWorkflow({ mode: 'status-then-result', ... })`. Keep `AuthExpiredError` re-throw in `classifyImage`'s catch.

**Test update needed:** Update `use-image-validation.test.ts` to mock `pollWorkflow` or keep current mock chain.

---

### Step 2 - `photoshoot-api.ts` `getPhotoshootResult`

**Decision: leave as-is.** The function is 20 lines, has 21 passing tests, and does exactly one thing (result-fetch retry). There is no duplication to eliminate here - it is not copy-pasted anywhere. Absorbing it into `pollWorkflow` would require introducing a partial-mode API (`fetchStatus: undefined`) that complicates the helper's contract for no measurable benefit. Revisit only if result-retry logic is needed in a third location.

---

### Step 3 - `UnifiedStudio.tsx` photo/product-shot loop (Loop 1)

**Why third:** No `AbortController` complexity. Fixed timeout. The 300 ms progress ticker is independent and stays in the page (not absorbed by the helper). The `onProgress` callback replaces the two inline `setGenerationProgress` / `setGenerationStep` calls triggered by `status.progress`.

**Migration:** Replace `while (Date.now() - pollStart < TIMEOUT)` block with `pollWorkflow({ mode: 'status-then-result', intervalMs: 3000, timeoutMs: 720000, parseResult: extractResultImages, ... })`.

**Result-level failure check:** The `hasActivityError` scan stays in the page because it is photo-specific. `parseResult` can throw if the activity error is detected, or the page can check the returned result.

---

### Step 4 - `TextToCAD.tsx` weight + STL loops (Loops 4 and 5)

**Why fourth:** Result-direct mode. No AbortController. Simpler than generation loops. The two loops are near-identical and benefit most from deduplication.

**Migration:** Replace both `while (Date.now() < deadline)` blocks with `pollWorkflow({ mode: 'result-direct', intervalMs: 2000, timeoutMs: 120000 or 300000, parseResult: ... })`.

**Result-direct note:** Backend returns `{ status: 'running' }` while running. Helper exits when that field is absent or has any other value.

---

### Step 5 - `TextToCAD.tsx` generation + edit loops (Loops 2 and 3)

**Why last:** Highest complexity. Requires `AbortController` integration, terminal node resolution, `onProgress` callback for `setProgressStep` / `setRetryAttempt`, and the CAD-specific error budget (10 poll errors, 3 consecutive 404s). A regression here is a complete generation outage.

**Migration:** Replace both `while (true)` blocks with `pollWorkflow({ mode: 'status-then-result', resolveTerminalNode: cadTerminalNodeResolver, resolveProgressNode: cadProgressNodeExtractor, signal: pollAbort.signal, ... })`. Share a single `cadTerminalNodeResolver` and `cadProgressNodeExtractor` between generation and edit.

---

## 5. Implementation Rules

**Rule: helper and tests ship in the same PR before any migration.**

The first implementation PR must:
1. Create `src/lib/poll-workflow.ts` with the `pollWorkflow` function.
2. Create `src/lib/poll-workflow.test.ts` with the full test suite below.
3. All tests must pass.
4. Do NOT migrate any existing loop in this PR.

Migration of existing loops starts only after the helper test suite is green on `main`.
This prevents the same drift pattern that created the current duplication.

### Required test cases for `poll-workflow.test.ts`

| # | Test name | What it verifies |
|---|---|---|
| 1 | status completed - returns result | Status resolves to `completed`, result is fetched and parsed, returns `{ status: 'completed', result }` |
| 2 | status failed - throws | Status resolves to `failed`, helper throws before fetching result |
| 3 | status 404 budget - throws after N consecutive | 404 counter increments; throws when `consecutive404s >= max404s` |
| 4 | status 404 below budget - continues polling | N-1 consecutive 404s, then success; helper does not throw |
| 5 | result retry 404 - succeeds on retry | First result fetch returns 404, second returns OK; `result` is parsed from second |
| 6 | result retry exhausted - throws | All result fetches return 404; helper throws after `maxResultRetries` |
| 7 | timeout - throws | Wall-clock or iteration limit exceeded before terminal state; helper throws |
| 8 | AbortSignal cancellation - returns cancelled | `signal.abort()` called during polling; returns `{ status: 'cancelled' }`, does not throw |
| 9 | AuthExpiredError propagation - rethrows | `authenticatedFetch` throws `AuthExpiredError`; helper rethrows it, does not return cancelled |
| 10 | result-direct running then success | Mode `result-direct`; first poll returns `{ status: 'running' }`, second returns done data; result parsed |
| 11 | result-direct timeout - throws | Mode `result-direct`; all polls return running until deadline; throws |

---

## 6. What the Helper Must NOT Own

- The decelerating progress ticker (`setInterval` at 300 ms in `UnifiedStudio.tsx`). That is a UI-only animation concern, not a polling concern.
- Photo image URL extraction (`extractResultImages`). Caller-supplied via `parseResult`.
- CAD GLB artifact extraction (`success_final`, `original_glb_artifact` fallback chain). Caller-supplied.
- Image classification label/reason/confidence parsing. Caller-supplied.
- Weight/STL result field mapping. Caller-supplied.
- PostHog tracking, credit refresh, toast messages. Page-level side effects; invoked by caller after `pollWorkflow` returns.

---

## 7. Uncertainties

1. **Result-direct 404 handling.** Loops 4 and 5 throw on any non-ok response including 404. If the backend can return 404 while a weight/STL job is starting up, callers will need a `max404s` budget in result-direct mode too. Needs confirmation from backend behavior.

2. **AbortController ownership.** TextToCAD currently holds `pollAbortRef.current` and aborts it at the start of each new generation. The helper must accept an external `AbortSignal`; it must not create its own controller internally. This is the proposed design - confirm before implementation.

3. **`onProgress` typing.** The CAD loops extract `runtime.active_nodes[0]`, `runtime.last_exit_node_id`, and `node_visit_seq.generate_fix`. The photo loop uses `progress.visited`. These have different shapes. The `onProgress` callback signature needs to be generic enough for both, or `resolveProgressNode` should be optional and CAD-specific only.

4. **Test strategy for page-level loops.** Loops 1, 2, 3 live inside `useCallback` closures with many page-state side effects. After extraction, the `pollWorkflow` function itself is unit-testable in isolation. The page-level integration is harder to test without a full mount. Decide before Step 3 whether integration tests or component tests are needed, or whether `pollWorkflow` unit tests plus the existing behavior-level tests are sufficient.
