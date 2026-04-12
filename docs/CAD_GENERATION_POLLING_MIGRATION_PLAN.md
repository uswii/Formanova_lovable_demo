# CAD Generation + Edit Polling Migration Plan

Prep document for Phase 12. Implementation is the next branch (Phase 13).
No runtime code changes in this file.

---

## 1. Exact line ranges

File: `src/pages/TextToCAD.tsx`

| Loop | Kind | Lines |
|---|---|---|
| Generation status while-loop | status-then-result | 394-456 |
| Generation result for-loop | result fetch | 463-491 |
| Edit status while-loop | status-then-result | 577-614 |
| Edit result for-loop | result fetch | 620-641 |

The generation loop lives inside `simulateGeneration` (useCallback, lines 290-513).
The edit loop lives inside `runEditWithPrompt` (useCallback, lines 515-660).

---

## 2. State variables before, during, and after each loop

### Generation loop

**Set before the loop (inside simulateGeneration, after preflight):**

| Variable | Set to |
|---|---|
| `workspaceActive` | `true` |
| `isGenerating` | `true` |
| `generationFailed` | `false` |
| `retryAttempt` | `0` |
| `hasModel` | `false` |
| `progressStep` | `"generate_initial"` |
| local `pollAbortRef.current` | new `AbortController` (previous aborted first) |
| local `pollErrors` | `0` |
| local `consecutive404s` | `0` |
| local `cadGenStartTime` | `Date.now()` |

**Written during the status loop on each successful poll:**

| Variable | Trigger | Value |
|---|---|---|
| `progressStep` | `displayNode` is non-empty | `displayNode` (activeNode or lastExitNode) |
| `retryAttempt` | `retryCount > 0` | `statusData.node_visit_seq.generate_fix` |
| `progressStep` | `state === "failed"` or `"budget_exhausted"` | `"failed_final"` |

**Written during the result fetch (after loop breaks):**

| Variable | Value |
|---|---|
| `progressStep` | `"_loading"` (set twice in a row -- likely a dev leftover) |
| `glbArtifact` | the resolved artifact object |

**Set after successful result fetch:**

| Variable | Value |
|---|---|
| `glbUrl` | GLB URI string |
| `progressStep` | `"_loading"` |
| `isModelLoading` | `true` |
| `isGenerating` | `false` |
| `hasModel` | `true` |
| `showPartRegen` | `true` |

**Set in the outer catch (on any unhandled throw):**

| Variable | Value |
|---|---|
| `isGenerating` | `false` |
| `progressStep` | `""` |
| `generationFailed` | `true` |

---

### Edit loop

**Set before the loop (inside runEditWithPrompt):**

| Variable | Set to |
|---|---|
| `isEditing` | `true` |
| `isGenerating` | `true` |
| `retryAttempt` | `0` |
| `progressStep` | `"generate_initial"` |
| local `pollAbortRef.current` | new AbortController (previous aborted first) |
| local `pollErrors` | `0` |
| local `consecutive404s` | `0` |

**Written during the status loop:** identical shape to generation loop.

**Written during the result fetch:** identical shape to generation loop.

**Set after successful result fetch:**

| Variable | Value |
|---|---|
| `glbUrl` | GLB URI string |
| `progressStep` | `"_loading"` |
| `isModelLoading` | `true` |
| `isGenerating` | `false` |
| `isEditing` | `false` |
| `hasModel` | `true` |

**Set in the outer catch:**

| Variable | Value |
|---|---|
| `isGenerating` | `false` |
| `isEditing` | `false` |
| `progressStep` | `""` |

Note: the edit outer catch calls `toast.error(err.message)`. The generation outer catch does NOT toast.

---

## 3. Terminal node logic

Both loops share the same terminal node set:

```
const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);
```

The check after each successful poll (both loops, same structure):

```
// State-level terminal check
if (state === "completed") break;
if (state === "failed" || state === "budget_exhausted") {
  setProgressStep("failed_final");
  throw new Error(`Generation ${state}`); // or `Edit ${state}`
}

// Node-level terminal check
if (TERMINAL_NODES.has(activeNode) || TERMINAL_NODES.has(lastExitNode)) {
  if (activeNode === "failed_final" || lastExitNode === "failed_final") {
    setProgressStep("failed_final");
    throw new Error("Generation failed"); // or "Edit failed"
  }
  break; // success node reached
}
```

Where:
- `activeNode` = `statusData.runtime?.active_nodes?.[0] || ""`
- `lastExitNode` = `statusData.runtime?.last_exit_node_id || ""`

Terminal conditions summary:

| Condition | Action |
|---|---|
| `state === "completed"` | break (success path) |
| `state === "failed"` | set progressStep "failed_final", throw |
| `state === "budget_exhausted"` | set progressStep "failed_final", throw |
| `activeNode === "failed_final"` | set progressStep "failed_final", throw |
| `lastExitNode === "failed_final"` | set progressStep "failed_final", throw |
| `activeNode` in TERMINAL_NODES (and not failed_final) | break (success path) |
| `lastExitNode` in TERMINAL_NODES (and not failed_final) | break (success path) |

---

## 4. Progress logic

Fields read from statusData on each successful poll:

```
const activeNode  = statusData.runtime?.active_nodes?.[0] || "";
const lastExitNode = statusData.runtime?.last_exit_node_id || "";
const retryCount  = statusData.node_visit_seq?.generate_fix || 0;
const displayNode = activeNode || lastExitNode;
```

Updates:
- `setProgressStep(displayNode)` when `displayNode` is non-empty
- `setRetryAttempt(retryCount)` when `retryCount > 0`

In the migration, `resolveProgressNode` must return `null` when `displayNode` is empty so that
`onProgress` is not called (preserving the existing "only update if non-empty" behavior).

---

## 5. AbortController behavior

### When the controller is created

At the start of the status loop (both generation and edit), just before the while loop:

```
pollAbortRef.current?.abort();        // abort previous poll if any
const pollAbort = new AbortController();
pollAbortRef.current = pollAbort;
```

This means starting a new generation or edit ALWAYS cancels the previous in-flight poll.

On component unmount:
```
useEffect(() => {
  return () => { pollAbortRef.current?.abort(); };
}, []);
```

### Signal passed to authenticatedFetch

Only the status fetch receives the signal:
```
authenticatedFetch(`/api/status/${encodeURIComponent(workflow_id)}`, { signal: pollAbort.signal })
```

The result fetch (lines 463-491 and 620-641) does NOT pass the signal. If the component unmounts
during a result fetch, the result fetch completes unchecked.

### AbortError handling (inside the inner try-catch)

```
if (err instanceof Error && err.name === "AbortError") return;
```

`return` exits the entire `simulateGenerate` / `runEditWithPrompt` function silently.
No toast, no state updates. The in-progress state (isGenerating, progressStep) stays as-is.
This is intentional: the next generation will reset those states before its own loop starts.

### AuthExpiredError handling (inside the inner try-catch)

```
if (err instanceof AuthExpiredError) return;
```

Same behavior: silent return, no cleanup. `AuthExpiredError` is thrown by `authenticatedFetch`
when it gets a 401, which also triggers a redirect to `/login`. The silent return prevents double
error handling.

### Critical: pollWorkflow receives the SIGNAL, not the controller

`pollAbortRef.current` holds the controller. The signal passed to `pollWorkflow` must be
`pollAbort.signal` (not the controller itself). The controller is never passed to the helper.

---

## 6. Result fetch retry behavior

Both loops use an identical structure (slightly compressed in the edit loop):

```
let glb_url: string | null = null;
const MAX_RESULT_RETRIES = 5;
for (let attempt = 1; attempt <= MAX_RESULT_RETRIES; attempt++) {
  const resultRes = await authenticatedFetch(`/api/result/${encodeURIComponent(workflow_id)}`);

  if (resultRes.ok) {
    const result = await resultRes.json();
    // ... parse GLB artifact ...
    if (artifact?.uri) { glb_url = artifact.uri; setGlbArtifact(artifact); break; }
    throw new Error("No GLB model found in results");
  }

  if (resultRes.status === 404 && attempt < MAX_RESULT_RETRIES) {
    await new Promise((r) => setTimeout(r, 1000));
    continue;
  }

  const err = await resultRes.json().catch(() => ({}));
  throw new Error(err.error || "Failed to fetch result");
}
if (!glb_url) throw new Error("No GLB model found in results");
```

Behavior summary:
- Up to 5 total attempts (attempt 1..5)
- 404 on attempt 1..4: retry after 1s
- 404 on attempt 5 (last): falls through to the non-ok path, throws
- Any other non-ok: throws immediately (no retry)
- OK but no artifact: throws immediately (no retry)

Mapping to `pollWorkflow` options:
- `maxResultRetries: 5` (matches 5 total attempts)
- `resultRetryDelayMs: 1000`
- Note: `parseResult` must throw if no artifact URI is found (to replicate the "OK but no GLB" failure path)

---

## 7. Proposed resolver functions

These three functions would live in `src/lib/poll-workflow.ts` as exports, or in a new
`src/lib/cad-poll-resolvers.ts`. Prefer `cad-poll-resolvers.ts` to keep `poll-workflow.ts`
domain-agnostic.

### resolveCadState

Used as the `resolveState` option. The generation loops read `statusData.runtime?.state`, not the
default fields (`runtime.state`, `progress.state`, `state`). The default `defaultResolveState` in
`poll-workflow.ts` already reads `d.runtime?.state` first, so this may not need to be overridden.
Confirm before implementing.

### resolveCadTerminalNode

Note: `resolveCadTerminalNode` returning 'failure' triggers `pollWorkflow` to throw
`new Error('Workflow failed at terminal node')`. This is the intentional bug-fix path described
in section 8 -- the helper throws immediately rather than swallowing and looping.

```typescript
export function resolveCadTerminalNode(statusData: unknown): 'success' | 'failure' | null {
  const d = statusData as {
    runtime?: { active_nodes?: string[]; last_exit_node_id?: string };
  };
  const activeNode = d.runtime?.active_nodes?.[0] || "";
  const lastExitNode = d.runtime?.last_exit_node_id || "";
  const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);

  if (!TERMINAL_NODES.has(activeNode) && !TERMINAL_NODES.has(lastExitNode)) return null;

  if (activeNode === "failed_final" || lastExitNode === "failed_final") return 'failure';
  return 'success';
}
```

### resolveCadProgressNode

```typescript
export function resolveCadProgressNode(statusData: unknown): { node: string; retryCount: number } | null {
  const d = statusData as {
    runtime?: { active_nodes?: string[]; last_exit_node_id?: string };
    node_visit_seq?: { generate_fix?: number };
  };
  const activeNode = d.runtime?.active_nodes?.[0] || "";
  const lastExitNode = d.runtime?.last_exit_node_id || "";
  const retryCount = d.node_visit_seq?.generate_fix || 0;
  const displayNode = activeNode || lastExitNode;
  if (!displayNode) return null;
  return { node: displayNode, retryCount };
}
```

### parseCadResult

The same parser is shared by generation and edit. Error messages must be neutral (not
"Generation failed") so the edit outer catch can display them in a toast without misleading the
user. A `context` label is accepted for cases where caller-specific messaging is needed.

```typescript
interface CadGlbArtifact {
  uri: string;
  type: string;
  bytes: number;
  sha256: string;
}

interface CadGenerationResult {
  glb_url: string;
  artifact: CadGlbArtifact;
}

export function parseCadResult(
  d: unknown,
  context: 'generation' | 'edit' = 'generation',
): CadGenerationResult {
  const result = d as Record<string, unknown>;
  const hasFailed = Array.isArray(result["failed_final"]) && (result["failed_final"] as unknown[]).length > 0;
  if (hasFailed) throw new Error("No valid CAD model produced");

  const successFinalArr = result["success_final"] as Array<{ glb_artifact?: CadGlbArtifact; original_glb_artifact?: CadGlbArtifact }> | undefined;
  const successOriginalArr = result["success_original_glb"] as Array<{ original_glb_artifact?: CadGlbArtifact }> | undefined;

  const artifact =
    successFinalArr?.[0]?.glb_artifact ||
    successFinalArr?.[0]?.original_glb_artifact ||
    successOriginalArr?.[0]?.original_glb_artifact;

  if (!artifact?.uri) throw new Error(`No GLB model found in ${context} results`);
  return { glb_url: artifact.uri, artifact };
}
```

Callers:
- Generation: `parseResult: (d) => parseCadResult(d, 'generation')`
- Edit: `parseResult: (d) => parseCadResult(d, 'edit')`

---

## 8. Smallest safe migration plan

### What changes

Replace only the two status `while (true)` loops and the two result `for` loops with `pollWorkflow`
calls. Everything outside those loops stays in place: `pollAbortRef` management, state setup before
the loops, post-result state updates, outer catch blocks, and analytics.

### Step-by-step for the generation loop

Before (lines 394-491):
```
const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);
pollAbortRef.current?.abort();
const pollAbort = new AbortController();
pollAbortRef.current = pollAbort;
let pollErrors = 0;
let consecutive404s = 0;
const MAX_404_RETRIES = 3;
const POLL_TIMEOUT_MS = 60 * 60 * 1000;
const pollStart = Date.now();

while (true) { ... }

setProgressStep("_loading");
setProgressStep("_loading");
let glb_url: string | null = null;
const MAX_RESULT_RETRIES = 5;
for (let attempt = 1; attempt <= MAX_RESULT_RETRIES; attempt++) { ... }
if (!glb_url) throw new Error("No GLB model found in results");
```

After:
```
pollAbortRef.current?.abort();
const pollAbort = new AbortController();
pollAbortRef.current = pollAbort;

let pollResult: Awaited<ReturnType<typeof pollWorkflow<CadGenerationResult>>>;
try {
  pollResult = await pollWorkflow<CadGenerationResult>({
    mode: 'status-then-result',
    fetchStatus: () => authenticatedFetch(
      `/api/status/${encodeURIComponent(workflow_id)}`,
      { signal: pollAbort.signal }
    ),
    fetchResult: () => authenticatedFetch(`/api/result/${encodeURIComponent(workflow_id)}`),
    resolveTerminalNode: resolveCadTerminalNode,
    resolveProgressNode: resolveCadProgressNode,
    parseResult: (d) => parseCadResult(d, 'generation'),
    onProgress: ({ node, retryCount }) => {
      setProgressStep(node);
      if (retryCount > 0) setRetryAttempt(retryCount);
    },
    onStatusData: (statusData) => {
      const s = statusData as { runtime?: { state?: string } };
      const state = (s.runtime?.state || "").toLowerCase();
      if (state === "failed" || state === "budget_exhausted") {
        setProgressStep("failed_final");
      }
    },
    intervalMs: 2000,
    timeoutMs: 60 * 60 * 1000,
    max404s: 13,   // preserves current effective tolerance (3 trigger + 10 inner-catch absorptions)
    maxPollErrors: 10,
    maxResultRetries: 5,
    resultRetryDelayMs: 1000,
    signal: pollAbort.signal,
  });
} catch (err) {
  if (err instanceof AuthExpiredError) return; // redirect already in progress -- do not set generationFailed
  throw err; // re-throw to outer catch (sets generationFailed, clears progress)
}

if (pollResult.status === 'cancelled') return;

setProgressStep("_loading");
const { glb_url, artifact } = pollResult.result;
setGlbArtifact(artifact);
```

### Behavior changes vs. current code

1. **Failed-state infinite loop -- intentional bug fix (approved).** The current inner-catch
   structure swallows terminal failure throws and re-enters the while loop. A workflow stuck in
   "failed" state therefore loops for up to 60 minutes before timing out. `pollWorkflow` throws
   immediately when `resolveTerminalNode` returns 'failure' or `resolveState` returns 'failed'.
   This is a strict UX improvement and an approved behavior change.

2. **Effective 404 tolerance preserved at ~13.** The current code has `MAX_404_RETRIES = 3` as the
   explicit trigger, but the inner-catch absorbs the resulting throw against the `pollErrors`
   budget, adding up to 10 more absorbed 404-throws before the error finally propagates. The
   effective tolerance is approximately 13 consecutive 404s. Setting `max404s: 13` preserves this.
   After backend confirms that /api/status creation latency is reliably below 6 seconds (3 polls x
   2s), `max404s` can be reduced to 3 in a later behavior-change PR.

3. **`setProgressStep("failed_final")` on state-level failure.** The current code explicitly calls
   `setProgressStep("failed_final")` when `state === "failed"` or `"budget_exhausted"`, before
   throwing. With `pollWorkflow`, `resolveProgressNode` runs before terminal checks, so
   `setProgressStep` is driven by `activeNode/lastExitNode`. If the active node is NOT
   "failed_final" when the state is "failed", the progress step will NOT be set to "failed_final"
   by the onProgress callback. Mitigation: the `onStatusData` callback in the migration snippet
   handles this explicitly.

4. **Double `setProgressStep("_loading")` removed.** Lines 459-460 set "\_loading" twice in a row
   (apparent dev leftover). The migration sets it once after `pollResult` returns.

5. **AuthExpiredError: silent return preserved via explicit catch.** The current inner-catch does
   `if (err instanceof AuthExpiredError) return`, which exits the entire function silently and lets
   the redirect from `authenticatedFetch` proceed. `pollWorkflow` rethrows `AuthExpiredError`
   unconditionally. The migration wraps `pollWorkflow` in an explicit try/catch that catches
   `AuthExpiredError` and returns, so the outer catch (which sets `generationFailed` and would show
   a broken UI state) is never reached.

6. **Result fetch has no AbortController in current code.** This is preserved: `fetchResult` does
   not pass a signal. If the component unmounts mid-result-fetch, the fetch completes silently.

---

## 9. Tests needed before implementation

All tests go in `src/lib/cad-poll-resolvers.test.ts` (or inline with the helper if kept in
`poll-workflow.ts`).

### resolveCadTerminalNode tests

| Test | Input | Expected |
|---|---|---|
| active node is success_final | `{ runtime: { active_nodes: ["success_final"] } }` | `'success'` |
| last exit node is success_original_glb | `{ runtime: { last_exit_node_id: "success_original_glb" } }` | `'success'` |
| active node is failed_final | `{ runtime: { active_nodes: ["failed_final"] } }` | `'failure'` |
| last exit node is failed_final | `{ runtime: { last_exit_node_id: "failed_final" } }` | `'failure'` |
| non-terminal node active | `{ runtime: { active_nodes: ["build_initial"] } }` | `null` |
| no runtime data | `{}` | `null` |
| active node takes priority over non-terminal last exit | active=success_final, lastExit=build_initial | `'success'` |

### resolveCadProgressNode tests

| Test | Input | Expected |
|---|---|---|
| active node present | `{ runtime: { active_nodes: ["build_initial"] } }` | `{ node: "build_initial", retryCount: 0 }` |
| last exit node used when no active | `{ runtime: { last_exit_node_id: "validate_output" } }` | `{ node: "validate_output", retryCount: 0 }` |
| active node takes priority | active=build_retry, lastExit=build_initial | `{ node: "build_retry", retryCount: 0 }` |
| retryCount read from node_visit_seq | `{ runtime: { active_nodes: ["generate_fix"] }, node_visit_seq: { generate_fix: 2 } }` | `{ node: "generate_fix", retryCount: 2 }` |
| no active or last exit | `{ runtime: {} }` | `null` |
| no runtime | `{}` | `null` |

### parseCadResult tests

| Test | Input | Expected |
|---|---|---|
| success_final with glb_artifact | `{ success_final: [{ glb_artifact: { uri: "gs://...", ... } }] }` | resolves `glb_url` from glb_artifact |
| success_final fallback to original_glb_artifact | `{ success_final: [{ original_glb_artifact: { uri: "gs://..." } }] }` | resolves from original_glb_artifact |
| success_original_glb path | `{ success_original_glb: [{ original_glb_artifact: { uri: "gs://..." } }] }` | resolves from success_original_glb |
| failed_final present | `{ failed_final: [{}] }` | throws "No valid CAD model produced" |
| no artifact in success_final (generation) | `{ success_final: [{}] }, 'generation'` | throws "No GLB model found in generation results" |
| no artifact in success_final (edit) | `{ success_final: [{}] }, 'edit'` | throws "No GLB model found in edit results" |
| empty result object | `{}` | throws "No GLB model found in generation results" |

### Integration smoke test (poll-workflow.test.ts additions)

Add one test per new option combination used in the CAD migration:

| Test | What it verifies |
|---|---|
| `resolveTerminalNode` 'success' breaks out of status loop | helper breaks and fetches result when resolveTerminalNode returns 'success' |
| `resolveTerminalNode` 'failure' throws | helper throws before fetching result when resolveTerminalNode returns 'failure' |
| `onProgress` called with resolved progress | onProgress receives { node, retryCount } from resolveProgressNode |
| `onProgress` NOT called when resolveProgressNode returns null | no spurious onProgress calls when displayNode is empty |

---

## 10. Risks and rollback plan

### Risk 1: Failed-state infinite loop fix (approved intentional change)

**Current:** workflow with state "failed" loops for ~60 minutes then times out.
**After:** workflow with state "failed" throws immediately.

**Risk level:** Low. Strictly better UX. Approved before implementation starts.
**Rollback:** Not applicable -- this fix is intentional.

### Risk 2: 404 tolerance preserved at 13

**Current:** ~13 consecutive 404s before propagation.
**After:** exactly 13 consecutive 404s (`max404s: 13`).

**Risk level:** None at first migration. Behavior-identical.
**Future:** Reduce to `max404s: 3` in a follow-up PR once backend confirms status creation
latency is always below 6 seconds.
**Rollback:** Not needed.

### Risk 3: setProgressStep("failed_final") race on state-level failure

If `onStatusData` and `onProgress` fire in unexpected order, the progress step may briefly flicker.
**Risk level:** Very low. Both run synchronously before the poll iteration completes.
**Mitigation:** `onStatusData` runs before terminal checks, so "failed_final" will be set before
the throw propagates.

### Risk 4: AbortController signal passed to both pollWorkflow and fetchStatus

The signal is passed to both `signal:` option of `pollWorkflow` (for cancellation check between
iterations) AND to `authenticatedFetch` inside `fetchStatus` (for in-flight request cancellation).
This is correct and matches the current behavior where `pollAbort.signal` is passed to
`authenticatedFetch`. Verify in review.

### Risk 5: parseCadResult throws on "No GLB model found" -- currently a no-catch path

In the current result loop, "No GLB model found" throws and is caught by the outer catch
(`setGenerationFailed(true)`). With `pollWorkflow`, `parseResult` throwing will propagate the same
way. Behavior is preserved.

### Risk 6: Edit loop outer catch uses toast.error(err.message)

`parseCadResult` now throws "No valid CAD model produced" (neutral) or
"No GLB model found in edit results" (context-specific). Both are safe to display in a toast.
No risk.

### Risk 7: AuthExpiredError bypasses outer catch

The explicit inner catch `if (err instanceof AuthExpiredError) return` must be present in BOTH
the generation and edit `pollWorkflow` wrappers. If it is missing from either, the outer catch
runs `setGenerationFailed(true)` and may display a toast, while `authenticatedFetch` has already
triggered a redirect. Verify both wrappers in review.

### Rollback plan

The migration is confined to the two while-loops and two result for-loops in `TextToCAD.tsx`.
Rollback = revert those exact line ranges to the pre-migration snapshot.

`pollWorkflow` and `cad-poll-resolvers.ts` are additive and do not affect any existing callers.
They can remain in the codebase after a rollback with zero impact.

Rollback does NOT require reverting `poll-workflow.ts` (no options were added in Phase 12).

---

## 11. Pre-migration checklist

Before opening the Phase 13 implementation PR:

- [ ] `src/lib/cad-poll-resolvers.ts` created with all three resolver functions
- [ ] `src/lib/cad-poll-resolvers.test.ts` green (all resolver unit tests passing)
- [ ] `poll-workflow.test.ts` additions green (resolveTerminalNode + onProgress integration tests)
- [ ] Behavior changes from section 8 reviewed -- failed-state fix approved, 404 tolerance at 13
- [ ] Both generation and edit pollWorkflow wrappers include AuthExpiredError inner catch
- [ ] parseCadResult called with correct context label ('generation' vs 'edit') in each caller
- [ ] Manual QA: generate a ring, verify progress steps update, verify GLB loads
- [ ] Manual QA: start generation, start second generation immediately (abort test)
- [ ] Manual QA: edit, verify toast on success and on failure
- [ ] Follow-up ticket created: reduce max404s from 13 to 3 after backend latency confirmed
