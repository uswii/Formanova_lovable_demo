# UnifiedStudio Polling Migration Plan

Prep document for Phase 9. No runtime changes in this phase.
Read alongside docs/POLLING_AND_RESULT_PARSING_PLAN.md.

---

## 1. Exact Polling Block Location

The polling code lives entirely inside `handleGenerate` in `src/pages/UnifiedStudio.tsx`.

| Section | Lines | Description |
|---|---|---|
| `pollStart` / `TIMEOUT` declaration | 1098-1099 | `const pollStart = Date.now(); const TIMEOUT = 720000;` |
| Ticker start | 1103-1108 | `setInterval` at 300 ms - UI-only decelerating progress bar |
| `try` wrapper for polling | 1110 | Opens inner try that owns `clearInterval` in finally |
| **Status poll while-loop** | **1111-1166** | `while (Date.now() - pollStart < TIMEOUT)` |
| Inner finally | 1169-1171 | `clearInterval(ticker)` - runs on every exit path |
| Outer catch | 1172-1180 | `markGenerationFailed`, `setGenerationError('unavailable')`, `setIsGenerating(false)` |

**Target for replacement:** lines 1111-1166 (the while-loop body). The ticker and its cleanup are UI-only and must stay in place.

---

## 2. State Variables Set Before / During / After Polling

### Before polling (lines 1008-1097)

| Line | Call | Purpose |
|---|---|---|
| 1008 | `clearStudioSession()` | Wipe sessionStorage before fresh generation |
| 1009 | `setIsGenerating(true)` | Lock UI into generating mode |
| 1010 | `setGenerationProgress(0)` | Reset progress bar |
| 1011 | `setGenerationStep('Preparing...')` | Initial step label |
| 1012 | `setGenerationError(null)` | Clear any previous error |
| 1013 | `setCurrentStep('generating')` | Navigate to generating view |
| 1018-1054 | Multiple `setGenerationProgress(5/20/35)` | Upload and prepare sub-steps |
| 1024, 1040, 1055 | Multiple `setGenerationStep(...)` | Label each prepare sub-step |
| 1094 | `setWorkflowId(startResponse.workflow_id)` | Store workflow ID for result downloads / feedback |
| 1095 | `markGenerationStarted(workflowId)` | Generation lifecycle analytics |
| 1097 | `setGenerationStep('Generating photoshoot...')` | Label the start of polling phase |
| 1103-1108 | `ticker = setInterval(...)` | Decelerating UI progress ticker |

### During polling (inside while-loop, lines 1117-1127)

| Line | Call | Trigger |
|---|---|---|
| 1121 | `setGenerationProgress(prev => Math.max(prev, realPct))` | Only when `status.progress` is present; `realPct = min(35 + (completed/total)*60, 95)` |
| 1125 | `setGenerationStep(visited[last].replace(/_/g, ' '))` | Only when `status.progress.visited` is non-empty |

Progress never goes backwards (uses `Math.max`). The ticker runs concurrently,
pushing apparent progress toward 90% independently of real progress data.

### On status = completed (lines 1130-1160)

| Line | Call | Note |
|---|---|---|
| 1130 | `clearInterval(ticker)` | Stop fake progress |
| 1132 | `setGenerationProgress(95)` | Hold at 95% while fetching result |
| 1133 | `setGenerationStep('Fetching results...')` | Label the result-fetch wait |
| 1135 | `await getPhotoshootResult(workflowId)` | Result fetch with internal 5-retry loop |
| 1137-1145 | Activity error scan | Scans result items for `action === 'error'` or `status === 'failed'` |
| 1142 | `setGenerationError('workflow-failed')` | If activity error found |
| 1143 | `setIsGenerating(false)` | Unblock UI on workflow-failed path |
| 1147 | `setResultImages(images)` | Store extracted image URLs |
| 1148 | `setGenerationProgress(100)` | Full completion |
| 1149 | `setCurrentStep('results')` | Navigate to results view |
| 1150 | `setIsGenerating(false)` | Unblock UI on success path |
| 1151 | `markGenerationCompleted(...)` | Analytics lifecycle |
| 1152-1158 | `trackGenerationComplete(...)` | PostHog event with category, upload_type, duration_ms, is_first_ever |
| 1159 | `refreshCredits()` | Refresh credit balance after spending |

### On status = failed (line 1163-1165)

`throw new Error(status.error || 'Photoshoot generation failed')` - caught by outer catch.

### On timeout (line 1168)

`throw new Error('Generation timed out after 5 minutes')` - note: message says 5 min but TIMEOUT is 12 min; caught by outer catch.

### In outer catch (lines 1172-1180)

| Line | Call |
|---|---|
| 1173-1177 | `markGenerationFailed(_genWorkflowId, message, _genStartTime)` |
| 1178 | `setGenerationError('unavailable')` |
| 1179 | `setIsGenerating(false)` |

---

## 3. Side Effects Before / During / After Polling

### Not owned by the polling loop (must stay in place)

- **Credit preflight** (`checkCredits` at line 999) - fires before `handleGenerate` body, before any upload
- **Paywall tracking** (`trackPaywallHit` at line 1001) - fires on credit gate failure only
- **Upload and Azure** (lines 1020-1036) - fires before polling starts
- **Ticker** (`setInterval` at line 1103, `clearInterval` at line 1170) - UI-only, not backend polling
- **Session wipe** (`clearStudioSession` at line 1008) - fires before polling starts

### Owned by the polling loop and must be preserved in migration

| Side effect | Current location | Migration note |
|---|---|---|
| Real progress update from `status.progress.*` | Inside while-loop body (lines 1117-1127) | Needs `onStatusData` callback or equivalent |
| Step label update from `status.progress.visited` | Inside while-loop body (line 1125) | Same as above |
| `clearInterval(ticker)` on completion | Line 1130, inside completed branch | Must happen before or after pollWorkflow returns; finally handles the error case |
| `setGenerationProgress(95)` while fetching result | Line 1132 | UX note: timing changes - see section 5 |
| `setGenerationStep('Fetching results...')` | Line 1133 | Same UX note |
| Activity error scan of result data | Lines 1137-1145 | Must stay in page; photo-specific |
| `markGenerationCompleted` | Line 1151 | Must stay in page after pollWorkflow returns |
| `trackGenerationComplete` | Lines 1152-1158 | Must stay in page; needs `consumeFirstGeneration()` and live state |
| `refreshCredits()` | Line 1159 | Must stay in page |
| `markGenerationFailed` | Line 1173 | Must stay in catch; receives `error.message` |

---

## 4. Exact Behavior to Preserve

### 4.1 Progress updates

`status.progress` may or may not be present on each poll response. When present:
- `realPct = min(35 + round((completed_nodes / total_nodes) * 60), 95)`
- Applied as `setGenerationProgress(prev => Math.max(prev, realPct))` (never decreases)
- `visited[last]` is used as step label

The progress ticker runs independently at 300 ms and pushes apparent progress toward 90%.
`pollWorkflow` has no concept of a ticker - this remains entirely outside any migration.

### 4.2 Timeout

`TIMEOUT = 720 000 ms` (12 min). The current error message incorrectly says "5 minutes" but the actual timeout is 12 minutes.

With `pollWorkflow`: use `timeoutMs: 720_000`. The error message thrown will differ
(`'Workflow timed out after 720000ms'` instead of `'Generation timed out after 5 minutes'`).
The message is not shown to the user (catch sets `generationError: 'unavailable'`), so this is safe.

### 4.3 Failed workflow handling

`resolveWorkflowState(status) === 'failed'` triggers `throw new Error(status.error || ...)`.
This is caught by the outer catch which sets `generationError: 'unavailable'`.

With `pollWorkflow`: `defaultResolveState` reads `runtime.state || progress.state || state`,
which matches `resolveWorkflowState` exactly. `pollWorkflow` throws on 'failed', outer catch
handles it identically. No change needed.

### 4.4 Activity error scan

After status=completed, `getPhotoshootResult` is called and the result JSON is scanned:
```
Object.values(result).some(items =>
  Array.isArray(items) && items.some(i => i?.action === 'error' || i?.status === 'failed')
)
```
If true: sets `generationError = 'workflow-failed'` (not `'unavailable'`), sets `isGenerating = false`, returns.
This is photo-specific logic and must stay in the page after `pollWorkflow` returns.

### 4.5 Result image extraction

`extractResultImages(result)` iterates all response keys, collects string values under
`output_url`, `image_url`, `result_url`, `url`, `image_b64`, `output_image`.
Converts `azure://...` URIs via `azureUriToUrl`. Stays in page.

### 4.6 Credit refresh

`refreshCredits()` called on the success path only. Must stay in page after result confirmed good.

### 4.7 Analytics

`trackGenerationComplete` needs:
- `source: 'unified-studio'`
- `category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType` (live state at call time)
- `upload_type: validationResult?.category ?? null` (live state at call time)
- `duration_ms: Date.now() - _genStartTime` (closure variable)
- `is_first_ever: consumeFirstGeneration()` (must be called exactly once, at this point)

All must stay in the page. `pollWorkflow` must not own analytics.

### 4.8 Session clearing

`clearStudioSession()` fires at line 1008, before polling starts. Not inside the loop.
No change needed.

### 4.9 Final step transition

`setCurrentStep('results')` at line 1149 fires after result is confirmed good.
Stays in page after `pollWorkflow` returns.

### 4.10 404 status behavior

**Critical:** `getPhotoshootStatus` (photoshoot-api.ts:97-99) handles 404 internally:
```typescript
if (res.status === 404) {
  return { state: 'running' };
}
```
The while-loop never sees a 404 HTTP status. If we replace the loop with `pollWorkflow`
but keep calling `getPhotoshootStatus` as `fetchStatus`, we cannot do that because
`fetchStatus` must return a raw `Response` (not parsed data).

**Required:** bypass `getPhotoshootStatus` and call `authenticatedFetch` directly in
`fetchStatus`. `pollWorkflow`'s default `max404s: 3` then handles 404 correctly
(continue polling), matching original behavior.

### 4.11 Error budget

The current loop has no error budget. Any thrown error from `getPhotoshootStatus`
propagates immediately. With `pollWorkflow`, `maxPollErrors: 10` default could
swallow up to 10 transient errors before rethrowing. To preserve exact behavior,
set `maxPollErrors: 1` (throw on first error), or use `statusNonOkBehavior: 'continue'`
only if the original behavior is desired.

**Correction:** the original throws immediately on any non-ok status (photoshoot-api.ts:102
throws for non-ok, non-404 responses). So `maxPollErrors: 1` matches original behavior.

---

## 5. Proposed Smallest Code Change

### 5.1 New `pollWorkflow` option required

The status-loop progress updates need to fire after each successful status parse.
`pollWorkflow` currently offers `onProgress` (called via `resolveProgressNode`) with a CAD-specific
shape `{ node, retryCount }`. That shape does not fit photo progress data.

**Add one new option:**
```typescript
// In PollWorkflowOptions:
onStatusData?: (statusData: unknown) => void;
```
Called after each successful status JSON parse, before terminal-state check.
This is a pure addition; existing callers and tests are unaffected.

### 5.2 Migration sketch

Replace lines 1111-1166 with:

```typescript
// ticker already running from line 1103
const pollResult = await pollWorkflow({
  mode: 'status-then-result',
  fetchStatus: () =>
    authenticatedFetch(`/api/status/${startResponse.workflow_id}`),
  fetchResult: () =>
    authenticatedFetch(`/api/result/${startResponse.workflow_id}`),
  // defaultResolveState matches resolveWorkflowState exactly - no custom resolver needed
  onStatusData: (statusData: unknown) => {
    const status = statusData as PhotoshootStatusResponse;
    if (status.progress) {
      const total = status.progress.total_nodes || 1;
      const completed = status.progress.completed_nodes || 0;
      const realPct = Math.min(35 + Math.round((completed / total) * 60), 95);
      setGenerationProgress(prev => Math.max(prev, realPct));
      const visited = status.progress.visited || [];
      if (visited.length > 0) {
        setGenerationStep(visited[visited.length - 1].replace(/_/g, ' '));
      }
    }
  },
  parseResult: (d) => d as PhotoshootResultResponse,
  intervalMs: 3000,
  timeoutMs: 720_000,
  maxResultRetries: 6,     // getPhotoshootResult does attempt 0..5 = 6 total; match it
  resultRetryDelayMs: 1000,
  maxPollErrors: 1,        // original throws immediately on any error
});

clearInterval(ticker);

// pollResult.status is always 'completed' here (cancelled path requires AbortSignal;
// we don't pass one, so that branch is unreachable in practice)

// UX note: 95% step was shown while result was fetching; now result is already in hand.
// setGenerationProgress(95) briefly then 100% - React batches these, user sees 100%.
// This is an acceptable UX delta. Document it so reviewers do not flag it as a bug.
setGenerationProgress(95);
setGenerationStep('Fetching results...');

const result = pollResult.result;

// Activity error scan stays in page - photo-specific
const hasActivityError = Object.values(result).some(
  (items) => Array.isArray(items) &&
    items.some((i: any) => i?.action === 'error' || i?.status === 'failed')
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
// (end of the replaced block)
```

The outer try/catch and `finally { clearInterval(ticker) }` remain in place unchanged.

### 5.3 Files that change

| File | Change |
|---|---|
| `src/lib/poll-workflow.ts` | Add `onStatusData?: (data: unknown) => void` option; call it in the status-then-result loop after successful status parse |
| `src/lib/poll-workflow.test.ts` | Add test proving `onStatusData` is called after each status poll |
| `src/pages/UnifiedStudio.tsx` | Replace while-loop (lines 1111-1166) with `pollWorkflow` call; add `fetchStatus` with `authenticatedFetch` directly |

`src/lib/photoshoot-api.ts` is **not** modified.

---

## 6. Tests That Can Realistically Be Added Before Touching the Page

### 6.1 In `poll-workflow.test.ts` (before page migration)

These test the helper contract, not the page:

1. **`onStatusData` is called once per poll**: verify callback fires with raw status JSON on each iteration.
2. **`onStatusData` is called before terminal check**: callback fires even on the iteration that returns `completed`, before the loop breaks.
3. **`onStatusData` is not called on 404**: 404 responses skip the JSON parse; callback should not fire.
4. **`onStatusData` is not called on non-ok**: non-ok responses skip JSON parse; callback should not fire.
5. **`maxPollErrors: 1` throws on first non-ok**: confirm the one-error budget works as expected (existing `pollErrors budget` test covers similar ground, but explicit `maxPollErrors: 1` test is worth adding).

### 6.2 In `photoshoot-api.test.ts` (new file, before page migration)

`photoshoot-api.ts` is fully covered by `authenticatedFetch` mock behavior but has no tests today.

1. **`getPhotoshootStatus` returns `{ state: 'running' }` on 404**: this 404-masking behavior must survive any future refactor.
2. **`getPhotoshootStatus` throws on non-ok non-404**: confirm error propagation.
3. **`getPhotoshootResult` retries on 404, succeeds on second attempt**.
4. **`getPhotoshootResult` throws after maxRetries exhausted**.
5. **`startPhotoshoot` rejects invalid UUIDs for asset IDs**: UUID_RE validation.
6. **`resolveWorkflowState` reads `runtime.state` first, then `progress.state`, then `state`**.

These tests are low-risk (pure unit tests of the API module) and provide a regression net before any page changes.

### 6.3 What cannot be realistically tested before touching the page

- The full `handleGenerate` happy path: too deeply coupled to React state, upload, Azure, etc.
- Progress ticker interaction: UI animation, not testable in unit tests.
- Activity error scan behavior in context: too entangled with result state.

---

## 7. Risks and Rollback Plan

### 7.1 Risks

| Risk | Severity | Detail |
|---|---|---|
| `onStatusData` timing wrong | Medium | If called after terminal check, progress updates are lost on the final poll. Implementation must call it BEFORE the `if (state === 'completed') break` check. |
| Ticker not cleared on pollWorkflow throw | Low | The outer `finally { clearInterval(ticker) }` handles all error/timeout paths. The `clearInterval(ticker)` at line 1130 (inside while-loop) becomes unreachable and must be removed or moved. |
| 95% UX step invisible | Low | `setGenerationProgress(95)` and `setGenerationProgress(100)` will batch in the same React render cycle. Users skip from ~90% (ticker) to 100%. Acceptable. |
| `maxPollErrors: 1` too strict | Low | One transient network hiccup throws immediately. Original behavior was the same - `getPhotoshootStatus` threw on any non-ok, non-404 response. If more resilience is desired, use `maxPollErrors: 3`, but that changes behavior. |
| `maxResultRetries` count mismatch | Low | `getPhotoshootResult` does attempts 0..5 (6 total). `pollWorkflow` default is 5. Use `maxResultRetries: 6` to match exactly. |
| `AuthExpiredError` propagation | None | `pollWorkflow` already rethrows `AuthExpiredError`. Outer catch does not catch it (same as current - `authenticatedFetch` handles 401 before throwing). |
| No AbortSignal | Low | Current code has no cancellation. Omitting `signal` from `pollWorkflow` is correct. The `cancelled` return path is unreachable. |

### 7.2 Regression surface

UnifiedStudio is the highest-traffic page. The polling block is in the critical path for every photoshoot. Two failure modes are possible:

1. **Silent regression**: status polling succeeds but progress/step state not updated correctly. Would show user a frozen or wrong progress bar but generation completes. Hard to catch without E2E test.
2. **Breaking regression**: `pollWorkflow` throws when original did not (or vice versa). User sees error state instead of result. Would surface immediately in manual QA.

### 7.3 Rollback plan

1. The migration is confined to lines 1111-1166 of `UnifiedStudio.tsx` and a new option in `poll-workflow.ts`. Both are in a single PR.
2. If a regression is caught: revert the PR. No data or database changes involved.
3. The old while-loop can be restored in under 10 minutes from git history.
4. `poll-workflow.ts` changes are additive only (`onStatusData` is opt-in); other callers are unaffected even if the PR is partially reverted.

### 7.4 Manual QA checklist before merging

- [ ] Start a photoshoot (on-model mode). Progress bar advances from 35% during generation.
- [ ] Start a product shot. Same.
- [ ] Let one complete. Result images appear. Progress reaches 100%.
- [ ] Verify credits are refreshed after completion.
- [ ] Simulate a backend `failed` state (or use test endpoint). `generationError` set to `'unavailable'`.
- [ ] Verify `generationError = 'workflow-failed'` path (activity error in result) is still reachable.
- [ ] Timeout path: not easily testable manually. Confirm `TIMEOUT = 720_000` is passed correctly.

---

## 8. Implementation Order

1. Add `photoshoot-api.test.ts` (section 6.2) - low risk, high value safety net.
2. Add `onStatusData` to `poll-workflow.ts` + test (section 6.1).
3. Replace the while-loop in `UnifiedStudio.tsx`.
4. Manual QA checklist above before PR.
