# Async Generation UX — Design Spec
**Date:** 2026-04-20
**Scope:** 1×1 jewelry photoshoot flow only
**Phase:** Phase 1 of async generation journey (see Phased Roadmap below)

---

## Problem

The frontend treats an async-capable backend as synchronous. After submitting a 1×1 generation, the user is trapped on a full-screen blocking spinner until the job finishes (up to 120 seconds). They cannot use the app while waiting.

## Goal

Submit → generation continues in the background → user is free immediately.

Not included in this spec: batch (m×n), order abstractions, email notifications, backend billing changes, CAD flow changes.

---

## Phased Roadmap

This spec covers Phase 1 only. Later phases are defined here for orientation.

| Phase | What changes | When |
|---|---|---|
| **1 (this spec)** | Unblock spinner + `GenerationsContext` + header indicator + toast | Now |
| **2** | Nothing new — Phase 1 already builds the right infrastructure | — |
| **3** | `GenerationsContext` holds array of concurrent generations (trivial — already an array) | When needed |
| **4** | m×n batch submission UI + backend endpoints | Full redesign |

The context is deliberately designed as an array from day one so Phase 3 requires no shape change.

---

## Architecture Overview

`handleGenerate` is split into two phases:

**Phase A — stays in `useStudioGeneration`**
Credit check → upload fallback → `startPhotoshoot` / `startPdpShot` → receive `workflow_id` → call `context.trackGeneration(workflowId, ...)` → `setCurrentStep('generating')` → return.

**Phase B — moves to `GenerationsContext`**
Poll `workflow_id` → extract results → update generation record → fire toast → refresh credits.

The hook watches the Context for its generation's completion via a `useEffect`. When status flips to `completed`, the hook sets `resultImages` and transitions the Studio to the results step. The Context never imports from or knows about the Studio.

**Provider placement:** `GenerationsContextProvider` is nested inside `CreditsProvider` in `App.tsx` (`QueryClient → Theme → Auth → Credits → Generations`). This lets it call `useCredits().refreshCredits` directly — no prop-passing or circular nesting.

---

## `GenerationsContext`

### Data shape

```typescript
interface TrackedGeneration {
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;        // 0–100
  generationStep: string;  // current step label
  resultImages: string[];  // populated on completion
  isProductShot: boolean;
  jewelryType: string;     // singular form e.g. 'ring', 'necklace'
  startedAt: number;       // Date.now() at submission
}

interface TrackGenerationParams {
  workflowId: string;
  isProductShot: boolean;
  jewelryType: string;
}

interface GenerationsContextValue {
  generations: TrackedGeneration[];
  trackGeneration: (params: TrackGenerationParams) => void;
  clearGeneration: (workflowId: string) => void;
}
```

### Polling internals

- A `useRef<Map<string, AbortController>>` holds one controller per running workflow.
- A `useEffect` watches `generations`. For each entry in `running` status, it starts `pollWorkflow` with the same parameters previously in `useStudioGeneration` (3 s interval, 720 s timeout, unlimited 404s, 1 max poll error, 6 result retries, 1 s retry delay).
- On completion: sets `status: 'completed'`, populates `resultImages`, calls `useCredits().refreshCredits()`, calls `markGenerationCompleted()`, fires success toast.
- On failure: sets `status: 'failed'`, calls `markGenerationFailed()`, fires error toast.
- On `clearGeneration`: removes entry from array, aborts its controller.
- On provider unmount: aborts all controllers.

### Replacing an active generation

For v1 (1×1 only): calling `trackGeneration` while one is already running cancels the previous controller and replaces the entry. No UI warning needed — this matches current behaviour where only one generation runs at a time.

---

## `useStudioGeneration` Changes

### `handleGenerate`

**Before:**
```
credit check → upload → startPhotoshoot → setCurrentStep('generating') → pollWorkflow (blocking await) → setResults → setCurrentStep('results')
```

**After:**
```
credit check → upload → startPhotoshoot → trackGeneration(workflowId) → setCurrentStep('generating') → return
```

- `pollWorkflow` call removed from the hook entirely.
- `setCurrentStep('generating')` stays — spinner appears as before.
- `clearStudioSession()` stays in the hook's completion `useEffect` (Studio session concern, not a Context concern). `refreshCredits()` moves to the Context's completion handler.
- PostHog `trackGenerationComplete` moves to the hook's completion `useEffect` (see below).

### New completion `useEffect`

```typescript
const myGeneration = generations.find(g => g.workflowId === workflowId);

useEffect(() => {
  if (!myGeneration) return;
  if (myGeneration.status === 'completed') {
    setResultImages(myGeneration.resultImages);
    setCurrentStep('results');
    clearGeneration(workflowId);
    trackGenerationComplete({ ... }); // PostHog
    clearStudioSession();
  }
  if (myGeneration.status === 'failed') {
    setGenerationError('unavailable');
    clearGeneration(workflowId);
  }
}, [myGeneration?.status]);
```

### What stays in the hook

All input state (jewelryImage, modelUrl, jewelryUploadedUrl, etc.), credit check, upload fallback, error state, `resetGeneration`, `regenerationCount`, `feedbackOpen`.

---

## Spinner — Escapable, Not Blocking

`StudioGeneratingStep` gains one addition: a subtle "Keep browsing →" link that calls `setCurrentStep('model')`. The generation continues in the Context regardless.

`StudioGeneratingStep` reads `progress` and `generationStep` from `generations.find(g => g.workflowId === workflowId)` instead of local hook state — the hook no longer owns those fields.

The Studio header back-navigation (step 1 / step 2) also works freely while generating.

`StudioGeneratingStep` is otherwise unchanged and is not deleted — it remains available for future batch UI.

---

## Header Indicator

A small new component added to `Header.tsx`, reading from `GenerationsContext`. Placed to the left of the credits display.

**States:**

| State | Visual | Interaction |
|---|---|---|
| Idle | Nothing rendered | — |
| Running | `animate-spin` gem icon + `"Generating…"` (`font-mono text-[10px]`) | Click → navigate to `/studio/:jewelryType` |
| Just completed | Static checkmark + `"Ready"` — auto-hides after 3 s | Click → trigger result navigation |

No `cursor-pointer` per CLAUDE.md cursor affordance rule.

---

## Toast Notification

Fired from `GenerationsContextProvider` using `useToast()`.

**On completion:**
- Title: `"Your photoshoot is ready"`
- Description: `"[jewelry type] · [duration]"`
- Action button: `"View Results"` → triggers result navigation

**On failure:**
- Title: `"Generation failed"`
- Description: `"Try again from the studio"`
- Variant: `destructive`

Uses the existing `<Toaster />` placement — no custom positioning.

---

## Result Navigation

**Clicking "View Results" (toast) or the completed header indicator:**

Navigates to `/studio/:jewelryType` with route state:
```typescript
{ asyncResult: { workflowId: string; resultImages: string[] } }
```

`UnifiedStudio` checks `location.state?.asyncResult` on mount. If present:
- Sets `resultImages` from state
- Calls `setCurrentStep('results')`
- Calls `clearGeneration(workflowId)`

**If user is already on Studio when generation completes:**
The hook's `useEffect` transitions to results first. `clearGeneration` is called there, so the toast action becomes a no-op (generation already removed from Context).

---

## Error Handling

| Failure point | Behaviour |
|---|---|
| `startPhotoshoot` throws before `workflow_id` | `setGenerationError('unavailable')` in hook — existing error overlay, nothing reaches Context |
| Polling timeout or repeated errors | Context sets `status: 'failed'` → error toast → hook's `useEffect` sets `generationError` → existing error overlay |
| Workflow reports `state: 'failed'` | Same as above |
| User starts second generation while one runs | Previous controller aborted, entry replaced silently |

---

## Tests

**New file: `src/contexts/GenerationsContext.test.tsx`**
- Tracks a generation and starts polling
- Transitions to `completed` when poll resolves, populates `resultImages`
- Transitions to `failed` on poll error
- Cancels polling when `clearGeneration` is called
- Replaces previous generation when `trackGeneration` is called while one is running

**New file: `src/hooks/useStudioGeneration.test.ts`**
- `handleGenerate` calls `trackGeneration` after `startPhotoshoot` resolves
- Hook transitions to `results` when Context generation status becomes `completed`
- Hook sets `generationError` when Context generation status becomes `failed`

`pollWorkflow` is tested independently — no changes to existing tests.

---

## Files Changed

| File | Change |
|---|---|
| `src/contexts/GenerationsContext.tsx` | New |
| `src/contexts/GenerationsContext.test.tsx` | New |
| `src/hooks/useStudioGeneration.ts` | Remove `pollWorkflow`, add Context integration |
| `src/hooks/useStudioGeneration.test.ts` | New |
| `src/components/layout/Header.tsx` | Add generation indicator |
| `src/components/studio/StudioGeneratingStep.tsx` | Add escape link, read progress from Context |
| `src/pages/UnifiedStudio.tsx` | Pass `GenerationsContext` to hook, handle `location.state.asyncResult` on mount |
| `src/App.tsx` | Add `GenerationsContextProvider` to provider stack |

**Not changed:** `poll-workflow.ts`, `photoshoot-api.ts`, `generation-lifecycle.ts`, `Generations.tsx`, `StudioResultsStep.tsx`, all CAD files.
