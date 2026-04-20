# Async Generation UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 1×1 photoshoot generation from a blocking full-screen wait into a background-tracked async flow — user is released immediately after backend accepts the job, toast + header indicator surface completion.

**Architecture:** A new `GenerationsContext` (inside `BrowserRouter` in `App.tsx`) owns all polling via `pollWorkflow`. `useStudioGeneration` hands off `workflow_id` to the context after `startPhotoshoot` resolves, sets `currentStep('generating')`, and returns. The spinner step becomes escapable via a "Keep browsing" link. On completion the context fires a toast; if the user is still on Studio the hook's completion effect auto-transitions to results.

**Tech Stack:** React 18, TypeScript, TanStack Query, react-router-dom v6, Vitest + @testing-library/react, Tailwind CSS, shadcn/ui (`useToast`, `ToastAction`), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-04-20-async-generation-ux-design.md`

---

## Binding Constraints (read before touching any code)

### From AI_RULES.md
- **Rule 1:** All `/api/` calls must use `authenticatedFetch`, never raw `fetch`.
- **Rule 3:** No hardcoded production URLs. Use relative `/api/...` paths.
- **Rule 5:** No polling loops inside page components. All polling lives in `GenerationsContext`.
- **Rule 8:** `UnifiedStudio.tsx` is already 648 lines (pre-existing). Additions must be minimal (~10 lines max). Do not restructure unrelated code.
- **Rule 9:** Any `eslint-disable react-hooks/exhaustive-deps` must have a comment explaining: which deps are excluded, why safe, what regression to watch.
- **Rule 10:** Tests must ship with this PR for: polling behavior, session save/restore, completion transitions.

### From CLAUDE.md
- **No `cursor-pointer` on `<button>` elements.** Use default cursor — visual design is the affordance. `cursor-pointer` is for links/navigation only.
- **Icon consistency:** Use `Gem` from lucide-react for generation indicator (matches the existing spinner in `StudioGeneratingStep`). Use `Check` for the "ready" state.
- **Font/spacing:** `font-mono text-[10px] tracking-[0.15em] uppercase` for indicator labels — matches the existing mono style in `StudioGeneratingStep`.
- **Minimal blast radius:** Do not refactor code unrelated to this feature.

---

## Key Context (existing code you must understand before changing)

### Provider stack in `App.tsx` (lines 165–259)
```
QueryClientProvider
  ThemeProvider
    AuthProvider
      CreditsProvider          ← useCredits() available to everything inside
        TooltipProvider
          BrowserRouter        ← useNavigate() available to everything inside
            Header
            Routes / pages
```
`GenerationsContextProvider` must go **inside `BrowserRouter`** (needs `useNavigate`) and is also inside `CreditsProvider` (can call `useCredits()` freely).

### `useStudioGeneration.ts` — key sections to change

**Remove `extractResultImages` (lines 92–113)** — moves to `GenerationsContext.tsx`.

**`handleGenerate` currently (lines 151–336):**
- `isGenerating` state guards double-submit → replace with `isSubmitting` useState
- Sets `currentStep('generating')` immediately on submit → keep, but it now follows `trackGeneration`
- Calls `pollWorkflow` inline → **remove entirely**
- Calls `clearStudioSession()` at start → **move to completion effect**
- Calls `refreshCredits()` at end → **remove** (Context handles it)
- Calls `markGenerationCompleted` / `markGenerationFailed` → **remove** (Context handles it)
- Calls `trackGenerationComplete` (PostHog) → **move to completion effect**

**State that is removed from hook:**
- `const [isGenerating, setIsGenerating] = useState(false)` → replaced by `isSubmitting`
- `const [generationProgress, setGenerationProgress] = useState(0)` → derived from Context
- `const [generationStep, setGenerationStep] = useState('')` → derived from Context

**State that stays:**
- `workflowId`, `resultImages`, `generationError`, `regenerationCount`, `feedbackOpen`, `rotatingMsgIdx`

### `StudioGeneratingStep.tsx` — current props interface (line 16)
```typescript
interface StudioGeneratingStepProps {
  isProductShot: boolean; generationStep: string; generationProgress: number;
  rotatingMsgIdx: number; jewelryImage: string | null; resolvedJewelryImage: string | null;
  activeModelUrl: string | null; resolvedActiveModelUrl: string | null;
  generationError: string | null; handleStartOver: () => void;
}
```
Add one prop: `onKeepBrowsing: () => void`.

### `Header.tsx` — where to insert the indicator (line 121)
The credits pill starts at line 122. Insert `<GenerationIndicator />` immediately **before** the credits `<div className="relative">` block.

### `UnifiedStudio.tsx` — where to add the async result effect
Add a new `useEffect` at the end of the existing mount effects (around line 264), before the session-restore effect. Add `onKeepBrowsing` prop to the `<StudioGeneratingStep>` render at line 580.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/contexts/GenerationsContext.tsx` | **Create** | Tracks active generations, owns polling, fires toast on completion |
| `src/contexts/GenerationsContext.test.tsx` | **Create** | Tests for context: track, complete, fail, cancel, concurrent |
| `src/hooks/useStudioGeneration.ts` | **Modify** | Remove pollWorkflow; add Context hand-off; completion useEffect |
| `src/hooks/useStudioGeneration.test.ts` | **Create** | Tests for hook: trackGeneration called, results transition, clearStudioSession |
| `src/components/studio/StudioGeneratingStep.tsx` | **Modify** | Add `onKeepBrowsing` prop + escape link |
| `src/components/layout/Header.tsx` | **Modify** | Add `GenerationIndicator` component + render it |
| `src/pages/UnifiedStudio.tsx` | **Modify** | Handle `location.state.asyncResult` on mount; pass `onKeepBrowsing` |
| `src/App.tsx` | **Modify** | Wrap BrowserRouter content with `GenerationsContextProvider` |

---

## Task 1: Create `GenerationsContext.tsx`

**Files:**
- Create: `src/contexts/GenerationsContext.tsx`
- Create: `src/contexts/GenerationsContext.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/contexts/GenerationsContext.test.tsx`:

```typescript
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GenerationsContextProvider, GenerationsContext, useGenerations, type TrackedGeneration } from './GenerationsContext';

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/poll-workflow', () => ({ pollWorkflow: vi.fn() }));
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('@/contexts/CreditsContext', () => ({ useCredits: () => ({ refreshCredits: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/generation-lifecycle', () => ({
  markGenerationCompleted: vi.fn(),
  markGenerationFailed: vi.fn(),
}));
vi.mock('@/lib/azure-utils', () => ({ azureUriToUrl: (v: string) => v.replace('azure://', 'https://cdn.example.com/') }));

import { pollWorkflow } from '@/lib/poll-workflow';
import { markGenerationCompleted, markGenerationFailed } from '@/lib/generation-lifecycle';

const mockPollWorkflow = vi.mocked(pollWorkflow);
const mockMarkCompleted = vi.mocked(markGenerationCompleted);
const mockMarkFailed = vi.mocked(markGenerationFailed);

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter><GenerationsContextProvider>{children}</GenerationsContextProvider></MemoryRouter>;
}

describe('GenerationsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: never resolves (long-running generation)
    mockPollWorkflow.mockReturnValue(new Promise(() => {}));
  });

  it('starts with empty generations array', () => {
    const { result } = renderHook(() => useGenerations(), { wrapper });
    expect(result.current.generations).toEqual([]);
  });

  it('appends a running generation when trackGeneration is called', () => {
    const { result } = renderHook(() => useGenerations(), { wrapper });
    act(() => {
      result.current.trackGeneration({ workflowId: 'wf-1', isProductShot: false, jewelryType: 'ring' });
    });
    expect(result.current.generations).toHaveLength(1);
    expect(result.current.generations[0]).toMatchObject({ workflowId: 'wf-1', status: 'running' });
  });

  it('starts pollWorkflow when a generation is tracked', async () => {
    const { result } = renderHook(() => useGenerations(), { wrapper });
    act(() => {
      result.current.trackGeneration({ workflowId: 'wf-2', isProductShot: false, jewelryType: 'necklace' });
    });
    await waitFor(() => expect(mockPollWorkflow).toHaveBeenCalledOnce());
    expect(mockPollWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'status-then-result',
      intervalMs: 3000,
      timeoutMs: 720_000,
    }));
  });

  it('allows concurrent generations (unbounded queue)', () => {
    const { result } = renderHook(() => useGenerations(), { wrapper });
    act(() => {
      result.current.trackGeneration({ workflowId: 'wf-a', isProductShot: false, jewelryType: 'ring' });
      result.current.trackGeneration({ workflowId: 'wf-b', isProductShot: true, jewelryType: 'necklace' });
    });
    expect(result.current.generations).toHaveLength(2);
  });

  it('transitions to completed and populates resultImages when poll resolves', async () => {
    const resultData = { output: [{ output_url: 'https://example.com/image.jpg' }] };
    mockPollWorkflow.mockResolvedValueOnce({ status: 'completed', result: resultData });

    const { result } = renderHook(() => useGenerations(), { wrapper });
    act(() => {
      result.current.trackGeneration({ workflowId: 'wf-3', isProductShot: false, jewelryType: 'ring' });
    });

    await waitFor(() => {
      const gen = result.current.generations.find(g => g.workflowId === 'wf-3');
      expect(gen?.status).toBe('completed');
      expect(gen?.resultImages).toContain('https://example.com/image.jpg');
    });
    expect(mockMarkCompleted).toHaveBeenCalledWith('wf-3', expect.any(Number));
  });

  it('transitions to failed when poll rejects', async () => {
    mockPollWorkflow.mockRejectedValueOnce(new Error('timeout'));

    const { result } = renderHook(() => useGenerations(), { wrapper });
    act(() => {
      result.current.trackGeneration({ workflowId: 'wf-4', isProductShot: false, jewelryType: 'ring' });
    });

    await waitFor(() => {
      const gen = result.current.generations.find(g => g.workflowId === 'wf-4');
      expect(gen?.status).toBe('failed');
    });
    expect(mockMarkFailed).toHaveBeenCalledWith('wf-4', expect.any(String), expect.any(Number));
  });

  it('removes generation and aborts poll when clearGeneration is called', async () => {
    const { result } = renderHook(() => useGenerations(), { wrapper });
    act(() => {
      result.current.trackGeneration({ workflowId: 'wf-5', isProductShot: false, jewelryType: 'ring' });
    });
    await waitFor(() => expect(mockPollWorkflow).toHaveBeenCalledOnce());

    act(() => {
      result.current.clearGeneration('wf-5');
    });
    expect(result.current.generations.find(g => g.workflowId === 'wf-5')).toBeUndefined();
    // Verify AbortController was triggered by checking poll was called with a signal
    const callArgs = mockPollWorkflow.mock.calls[0][0];
    expect(callArgs.signal).toBeInstanceOf(AbortSignal);
    expect(callArgs.signal.aborted).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/contexts/GenerationsContext.test.tsx
```
Expected: multiple FAIL with "Cannot find module './GenerationsContext'"

- [ ] **Step 3: Implement `GenerationsContext.tsx`**

Create `src/contexts/GenerationsContext.tsx`:

```typescript
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { pollWorkflow } from '@/lib/poll-workflow';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { markGenerationCompleted, markGenerationFailed } from '@/lib/generation-lifecycle';
import { azureUriToUrl } from '@/lib/azure-utils';
import type { PhotoshootResultResponse } from '@/lib/photoshoot-api';

// ── Types ─────────────────────────────────────────────────────────────────

export interface TrackedGeneration {
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  generationStep: string;
  resultImages: string[];
  isProductShot: boolean;
  jewelryType: string;
  startedAt: number;
}

export interface TrackGenerationParams {
  workflowId: string;
  isProductShot: boolean;
  jewelryType: string;
}

interface GenerationsContextValue {
  generations: TrackedGeneration[];
  trackGeneration: (params: TrackGenerationParams) => void;
  clearGeneration: (workflowId: string) => void;
}

// Exported for testing — allows wrapping with a controlled value in tests.
export const GenerationsContext = createContext<GenerationsContextValue | null>(null);

// ── Result extraction ────────────────────────────────────────────────────
// Moved here from useStudioGeneration.ts (Phase 1 spec).

function extractResultImages(result: PhotoshootResultResponse): string[] {
  const images: string[] = [];
  for (const key of Object.keys(result)) {
    const items = result[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      for (const k of ['output_url', 'image_url', 'result_url', 'url', 'image_b64', 'output_image']) {
        const val = obj[k];
        if (typeof val === 'string' && val.length > 0) {
          if (val.startsWith('azure://')) {
            images.push(azureUriToUrl(val));
          } else if (val.startsWith('http') || val.startsWith('data:')) {
            images.push(val);
          }
        }
      }
    }
  }
  return images;
}

// ── Provider ─────────────────────────────────────────────────────────────

export function GenerationsContextProvider({ children }: { children: React.ReactNode }) {
  const [generations, setGenerations] = useState<TrackedGeneration[]>([]);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const { refreshCredits } = useCredits();
  const { toast } = useToast();
  const navigate = useNavigate();

  const trackGeneration = useCallback((params: TrackGenerationParams) => {
    setGenerations(prev => [
      ...prev,
      {
        workflowId: params.workflowId,
        status: 'running',
        progress: 35,
        generationStep: 'Generating photoshoot...',
        resultImages: [],
        isProductShot: params.isProductShot,
        jewelryType: params.jewelryType,
        startedAt: Date.now(),
      },
    ]);
  }, []);

  const clearGeneration = useCallback((workflowId: string) => {
    const ctrl = controllers.current.get(workflowId);
    if (ctrl) {
      ctrl.abort();
      controllers.current.delete(workflowId);
    }
    setGenerations(prev => prev.filter(g => g.workflowId !== workflowId));
  }, []);

  // Start polling for any newly-tracked running generation.
  // Uses the running workflowId set as dep so progress-tick re-renders don't restart polls.
  const runningKey = generations
    .filter(g => g.status === 'running')
    .map(g => g.workflowId)
    .join(',');

  useEffect(() => {
    const running = generations.filter(g => g.status === 'running');

    for (const gen of running) {
      if (controllers.current.has(gen.workflowId)) continue;

      const ctrl = new AbortController();
      controllers.current.set(gen.workflowId, ctrl);
      const startTime = gen.startedAt;

      // Smooth progress animation while polling
      const ticker = setInterval(() => {
        setGenerations(prev => prev.map(g => {
          if (g.workflowId !== gen.workflowId || g.status !== 'running') return g;
          return { ...g, progress: Math.min(g.progress + Math.max((90 - g.progress) * 0.04, 0.1), 90) };
        }));
      }, 300);

      pollWorkflow<PhotoshootResultResponse>({
        mode: 'status-then-result',
        fetchStatus: () => authenticatedFetch(`/api/status/${gen.workflowId}`),
        fetchResult: () => authenticatedFetch(`/api/result/${gen.workflowId}`),
        onStatusData: (statusData: unknown) => {
          const s = statusData as { progress?: { total_nodes?: number; completed_nodes?: number; visited?: string[] } };
          if (!s.progress) return;
          const total = s.progress.total_nodes || 1;
          const done = s.progress.completed_nodes || 0;
          const realPct = Math.min(35 + Math.round((done / total) * 60), 95);
          const visited = s.progress.visited ?? [];
          const step = visited.length > 0 ? visited[visited.length - 1].replace(/_/g, ' ') : 'Generating photoshoot...';
          setGenerations(prev => prev.map(g =>
            g.workflowId === gen.workflowId
              ? { ...g, progress: Math.max(g.progress, realPct), generationStep: step }
              : g
          ));
        },
        parseResult: (d) => d as PhotoshootResultResponse,
        intervalMs: 3000,
        timeoutMs: 720_000,
        max404s: Number.MAX_SAFE_INTEGER,
        maxPollErrors: 1,
        maxResultRetries: 6,
        resultRetryDelayMs: 1000,
        signal: ctrl.signal,
      }).then(pollResult => {
        clearInterval(ticker);
        if (pollResult.status === 'cancelled') return;

        const result = pollResult.result;
        const hasActivityError = Object.values(result).some(
          (items) => Array.isArray(items) && items.some((i: any) => i?.action === 'error' || i?.status === 'failed')
        );

        if (hasActivityError) {
          setGenerations(prev => prev.map(g =>
            g.workflowId === gen.workflowId ? { ...g, status: 'failed' } : g
          ));
          markGenerationFailed(gen.workflowId, 'workflow-failed', startTime);
          controllers.current.delete(gen.workflowId);
          toast({ variant: 'destructive', title: 'Generation failed', description: 'Try again from the studio' });
          return;
        }

        const resultImages = extractResultImages(result);
        const duration = Math.round((Date.now() - startTime) / 1000);
        const label = gen.jewelryType.charAt(0).toUpperCase() + gen.jewelryType.slice(1);

        setGenerations(prev => prev.map(g =>
          g.workflowId === gen.workflowId
            ? { ...g, status: 'completed', progress: 100, resultImages }
            : g
        ));
        markGenerationCompleted(gen.workflowId, startTime);
        refreshCredits();
        controllers.current.delete(gen.workflowId);

        toast({
          title: 'Your photoshoot is ready',
          description: `${label} · ${duration}s`,
          action: (
            <ToastAction
              altText="View Results"
              onClick={() => navigate(`/studio/${gen.jewelryType}`, {
                state: { asyncResult: { workflowId: gen.workflowId, resultImages } },
              })}
            >
              View Results
            </ToastAction>
          ),
        });
      }).catch(err => {
        clearInterval(ticker);
        if (err?.name === 'AbortError') return;
        setGenerations(prev => prev.map(g =>
          g.workflowId === gen.workflowId ? { ...g, status: 'failed' } : g
        ));
        markGenerationFailed(gen.workflowId, err?.message, startTime);
        controllers.current.delete(gen.workflowId);
        toast({ variant: 'destructive', title: 'Generation failed', description: 'Try again from the studio' });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // runningKey is a derived string from the running workflowId set.
  // It changes only when a generation is added or removed — not on progress ticks.
  // This prevents the effect from re-running every 300 ms while the progress ticker fires.
  // Regression to watch: if runningKey doesn't update when a new workflowId is added,
  // the new generation won't start polling. Always verify trackGeneration causes a re-run.
  }, [runningKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abort all controllers on provider unmount
  useEffect(() => {
    return () => {
      for (const ctrl of controllers.current.values()) ctrl.abort();
      controllers.current.clear();
    };
  }, []);

  return (
    <GenerationsContext.Provider value={{ generations, trackGeneration, clearGeneration }}>
      {children}
    </GenerationsContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useGenerations(): GenerationsContextValue {
  const ctx = useContext(GenerationsContext);
  if (!ctx) throw new Error('useGenerations must be used inside GenerationsContextProvider');
  return ctx;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/contexts/GenerationsContext.test.tsx
```
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/GenerationsContext.tsx src/contexts/GenerationsContext.test.tsx
git commit -m "feat: add GenerationsContext with background polling and toast notification"
```

---

## Task 2: Wire `GenerationsContextProvider` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import**

At the top of `src/App.tsx`, after the existing context imports (around line 8), add:

```typescript
import { GenerationsContextProvider } from '@/contexts/GenerationsContext';
```

- [ ] **Step 2: Wrap BrowserRouter content**

In `src/App.tsx`, find the `<BrowserRouter>` opening tag (line ~177). Wrap its children with `<GenerationsContextProvider>`. The result should look like:

```jsx
<BrowserRouter>
  <GenerationsContextProvider>
    <PostHogPageView />
    <PostReloadHandler />
    <OnboardingRedirectHandler />
    <VersionBanner />

    <DeferredDecorations>
      <Suspense fallback={null}>
        <FloatingElements />
        <ScrollProgressIndicator />
        <ThemeDecorations />
      </Suspense>
    </DeferredDecorations>
    <div className="min-h-screen flex flex-col relative z-10">
      <Header />
      <main className="flex-1">
        <RouteErrorBoundary>
          <ChunkErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* all existing routes unchanged */}
              </Routes>
            </Suspense>
          </ChunkErrorBoundary>
        </RouteErrorBoundary>
      </main>
    </div>
  </GenerationsContextProvider>
</BrowserRouter>
```

Find the closing `</BrowserRouter>` (line ~256) and insert `</GenerationsContextProvider>` just before it.

- [ ] **Step 3: Verify app still compiles**

```bash
npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire GenerationsContextProvider inside BrowserRouter"
```

---

## Task 3: Refactor `useStudioGeneration.ts`

**Files:**
- Modify: `src/hooks/useStudioGeneration.ts`
- Create: `src/hooks/useStudioGeneration.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `src/hooks/useStudioGeneration.test.ts`:

```typescript
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GenerationsContext } from '@/contexts/GenerationsContext';
import type { TrackedGeneration, GenerationsContextValue } from '@/contexts/GenerationsContext';

// ── Module mocks ──────────────────────────────────────────────────────────
vi.mock('@/lib/photoshoot-api', () => ({
  startPhotoshoot: vi.fn(),
  startPdpShot: vi.fn(),
}));
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('@/lib/microservices-api', () => ({ uploadToAzure: vi.fn() }));
vi.mock('@/lib/image-compression', () => ({
  compressImageBlob: vi.fn().mockResolvedValue({ blob: new Blob() }),
  imageSourceToBlob: vi.fn().mockResolvedValue(new Blob()),
}));
vi.mock('@/lib/generation-lifecycle', () => ({
  markGenerationStarted: vi.fn(),
  markGenerationCompleted: vi.fn(),
  markGenerationFailed: vi.fn(),
}));
vi.mock('@/lib/posthog-events', () => ({
  trackPaywallHit: vi.fn(),
  trackGenerationComplete: vi.fn(),
  consumeFirstGeneration: vi.fn().mockReturnValue(false),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { startPhotoshoot } from '@/lib/photoshoot-api';
import { markGenerationStarted } from '@/lib/generation-lifecycle';
import { trackGenerationComplete } from '@/lib/posthog-events';
import { useStudioGeneration } from './useStudioGeneration';

const mockStartPhotoshoot = vi.mocked(startPhotoshoot);
const mockMarkGenerationStarted = vi.mocked(markGenerationStarted);

// ── Context helpers ────────────────────────────────────────────────────────

function makeContextValue(overrides: Partial<GenerationsContextValue> = {}): GenerationsContextValue {
  return {
    generations: [],
    trackGeneration: vi.fn(),
    clearGeneration: vi.fn(),
    ...overrides,
  };
}

function wrapper(ctxValue: GenerationsContextValue) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <GenerationsContext.Provider value={ctxValue}>
        {children}
      </GenerationsContext.Provider>
    </MemoryRouter>
  );
}

// ── Shared hook options ────────────────────────────────────────────────────

const mockSetCurrentStep = vi.fn();
const mockCheckCredits = vi.fn().mockResolvedValue(true);
const mockRefreshCredits = vi.fn();
const mockClearStudioSession = vi.fn();
const mockClearValidation = vi.fn();
const mockSetJewelryAssetId = vi.fn();

function baseOptions() {
  return {
    isProductShot: false,
    effectiveJewelryType: 'rings',
    jewelryImage: 'data:image/jpeg;base64,abc',
    activeModelUrl: 'https://example.com/model.jpg',
    jewelryUploadedUrl: 'https://example.com/jewelry.jpg',
    jewelryAssetId: null,
    selectedModel: { id: 'model-1', url: 'https://example.com/model.jpg', name: 'Model 1', metadata: {} },
    customModelImage: null,
    modelAssetId: null,
    validationResult: null,
    checkCredits: mockCheckCredits,
    refreshCredits: mockRefreshCredits,
    toast: vi.fn(),
    setCurrentStep: mockSetCurrentStep,
    setJewelryAssetId: mockSetJewelryAssetId,
    clearStudioSession: mockClearStudioSession,
    clearValidation: mockClearValidation,
  };
}

describe('useStudioGeneration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls trackGeneration with workflowId after startPhotoshoot resolves', async () => {
    const mockTrackGeneration = vi.fn();
    const ctx = makeContextValue({ trackGeneration: mockTrackGeneration });

    mockStartPhotoshoot.mockResolvedValue({
      workflow_id: 'wf-test-1',
      status_url: '/api/status/wf-test-1',
      result_url: '/api/result/wf-test-1',
    });

    const { result } = renderHook(() => useStudioGeneration(baseOptions()), { wrapper: wrapper(ctx) });

    await act(async () => { await result.current.handleGenerate(); });

    expect(mockTrackGeneration).toHaveBeenCalledWith({
      workflowId: 'wf-test-1',
      isProductShot: false,
      jewelryType: 'ring',
    });
    expect(mockMarkGenerationStarted).toHaveBeenCalledWith('wf-test-1');
    expect(mockSetCurrentStep).toHaveBeenCalledWith('generating');
  });

  it('transitions to results step when generation completes in Context', async () => {
    const mockClearGeneration = vi.fn();
    mockStartPhotoshoot.mockResolvedValue({ workflow_id: 'wf-test-2', status_url: '', result_url: '' });

    const completedGeneration: TrackedGeneration = {
      workflowId: 'wf-test-2', status: 'completed', progress: 100,
      generationStep: 'Done', resultImages: ['https://example.com/result.jpg'],
      isProductShot: false, jewelryType: 'ring', startedAt: Date.now() - 30000,
    };

    // Start with no generations, then simulate completion
    let ctxGenerations: TrackedGeneration[] = [];
    const ctx = makeContextValue({
      get generations() { return ctxGenerations; },
      trackGeneration: vi.fn(),
      clearGeneration: mockClearGeneration,
    });

    const { result, rerender } = renderHook(() => useStudioGeneration(baseOptions()), { wrapper: wrapper(ctx) });

    // Submit to set workflowId in hook state
    await act(async () => { await result.current.handleGenerate(); });

    // Simulate Context completing the generation
    ctxGenerations = [completedGeneration];
    act(() => { rerender(); });

    await waitFor(() => {
      expect(mockSetCurrentStep).toHaveBeenCalledWith('results');
    });
    expect(result.current.resultImages).toEqual(['https://example.com/result.jpg']);
    expect(mockClearGeneration).toHaveBeenCalledWith('wf-test-2');
    expect(mockClearStudioSession).toHaveBeenCalled();
    expect(trackGenerationComplete).toHaveBeenCalled();
  });

  it('sets generationError when generation fails in Context', async () => {
    mockStartPhotoshoot.mockResolvedValue({ workflow_id: 'wf-test-3', status_url: '', result_url: '' });

    const failedGeneration: TrackedGeneration = {
      workflowId: 'wf-test-3', status: 'failed', progress: 0,
      generationStep: '', resultImages: [],
      isProductShot: false, jewelryType: 'ring', startedAt: Date.now(),
    };

    let ctxGenerations: TrackedGeneration[] = [];
    const ctx = makeContextValue({
      get generations() { return ctxGenerations; },
      trackGeneration: vi.fn(),
      clearGeneration: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useStudioGeneration(baseOptions()), { wrapper: wrapper(ctx) });

    await act(async () => { await result.current.handleGenerate(); });

    ctxGenerations = [failedGeneration];
    act(() => { rerender(); });

    await waitFor(() => {
      expect(result.current.generationError).toBe('unavailable');
    });
  });

  it('calls clearStudioSession on generation completion', async () => {
    mockStartPhotoshoot.mockResolvedValue({ workflow_id: 'wf-test-4', status_url: '', result_url: '' });

    const completedGeneration: TrackedGeneration = {
      workflowId: 'wf-test-4', status: 'completed', progress: 100,
      generationStep: '', resultImages: ['https://example.com/r.jpg'],
      isProductShot: false, jewelryType: 'ring', startedAt: Date.now() - 10000,
    };

    let ctxGenerations: TrackedGeneration[] = [];
    const ctx = makeContextValue({
      get generations() { return ctxGenerations; },
      trackGeneration: vi.fn(),
      clearGeneration: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useStudioGeneration(baseOptions()), { wrapper: wrapper(ctx) });

    await act(async () => { await result.current.handleGenerate(); });
    ctxGenerations = [completedGeneration];
    act(() => { rerender(); });

    await waitFor(() => expect(mockClearStudioSession).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/hooks/useStudioGeneration.test.ts
```
Expected: FAIL (hook is not yet refactored — `trackGeneration` won't be called, etc.)

- [ ] **Step 3: Refactor `useStudioGeneration.ts`**

Open `src/hooks/useStudioGeneration.ts`. Make the following changes:

**3a. Update imports** — add `useGenerations`, remove unused:

```typescript
// ADD after existing imports:
import { useGenerations } from '@/contexts/GenerationsContext';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
import {
  trackPaywallHit,
  trackGenerationComplete,
  consumeFirstGeneration,
} from '@/lib/posthog-events';
```

Remove `pollWorkflow` import (it's no longer used in this file).
Remove `extractResultImages` function body (lines 92–113) — it has moved to `GenerationsContext.tsx`.

**3b. Replace state declarations** — find the block starting at `const [isGenerating, setIsGenerating] = useState(false)` and replace:

```typescript
// REMOVE these three lines:
// const [isGenerating, setIsGenerating] = useState(false);
// const [generationProgress, setGenerationProgress] = useState(0);
// const [generationStep, setGenerationStep] = useState('');

// ADD:
const [isSubmitting, setIsSubmitting] = useState(false);

// Context integration
const { generations, trackGeneration, clearGeneration } = useGenerations();
```

**3c. Add derived values** — after the state declarations, add:

```typescript
const myGeneration = generations.find(g => g.workflowId === workflowId);
const isGenerating = isSubmitting; // true only during the brief submission window
const generationProgress = myGeneration?.progress ?? 0;
const generationStep = myGeneration?.generationStep ?? '';

// hasNavigatedAway: true if user clicked "Keep browsing" — suppress auto-transition to results
const hasNavigatedAway = useRef(false);
```

**3d. Update the rotating-message `useEffect`** — it already keys off `isGenerating`, no change needed.

**3e. Add the completion `useEffect`** — add this block after the rotating-message effect:

```typescript
useEffect(() => {
  if (!myGeneration) return;
  if (myGeneration.status === 'completed') {
    setResultImages(myGeneration.resultImages);
    clearGeneration(workflowId!);
    trackGenerationComplete({
      source: 'unified-studio',
      category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
      upload_type: validationResult?.category ?? null,
      duration_ms: Date.now() - (myGeneration.startedAt ?? Date.now()),
      is_first_ever: consumeFirstGeneration(),
    });
    clearStudioSession();
    if (!hasNavigatedAway.current) {
      setCurrentStep('results');
    }
  }
  if (myGeneration.status === 'failed') {
    setGenerationError('unavailable');
    clearGeneration(workflowId!);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
// Deps excluded: workflowId, clearGeneration, setResultImages, setCurrentStep, clearStudioSession,
// effectiveJewelryType, validationResult. All are stable refs, setters, or hook-level constants
// that don't change identity between renders.
// Regression to watch: if workflowId changes while in flight (user submits a second generation),
// myGeneration becomes undefined and the effect is a no-op — safe because the new generation
// will trigger its own completion effect when it resolves.
}, [myGeneration?.status]); // eslint-disable-line react-hooks/exhaustive-deps
```

**3f. Rewrite `handleGenerate`** — replace the entire `handleGenerate` useCallback body with:

```typescript
const handleGenerate = useCallback(async () => {
  if (isSubmitting) return;
  if (!jewelryImage || !activeModelUrl) {
    toast({ variant: 'destructive', title: 'Missing inputs', description: 'Upload a jewelry image and select a model.' });
    return;
  }

  const hasCredits = await checkCredits(isProductShot ? 'Product_shot_pipeline' : 'jewelry_photoshoots_generator');
  if (!hasCredits) {
    trackPaywallHit({
      category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
      steps_completed: 2,
    });
    return;
  }

  setIsSubmitting(true);
  setGenerationError(null);
  hasNavigatedAway.current = false;

  try {
    let jewelryUrl: string;
    if (jewelryUploadedUrl) {
      jewelryUrl = jewelryUploadedUrl;
    } else {
      const jewelryBlob = await imageSourceToBlob(jewelryImage);
      const { blob: compressedJewelry } = await compressImageBlob(jewelryBlob);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedJewelry);
      });
      const azResult = await uploadToAzure(base64, 'image/jpeg', 'jewelry_photo', {
        category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
      });
      jewelryUrl = azResult.sas_url || azResult.https_url;
      setJewelryAssetId(azResult.asset_id ?? null);
    }

    let modelUrl: string;
    if (selectedModel) {
      modelUrl = selectedModel.url;
    } else if (customModelImage) {
      modelUrl = customModelImage;
    } else {
      throw new Error('No model selected');
    }

    if (!jewelryUrl || !modelUrl) {
      toast({ variant: 'destructive', title: 'Missing images', description: 'Please select both a jewelry image and a model before generating.' });
      setIsSubmitting(false);
      setCurrentStep('model');
      return;
    }

    const idempotencyKey = `${Date.now()}-${effectiveJewelryType}-${selectedModel?.id || 'custom'}`;
    const category = TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType;

    const startResponse = isProductShot
      ? await startPdpShot({
          jewelry_image_url: jewelryUrl,
          inspiration_image_url: modelUrl,
          category,
          idempotency_key: idempotencyKey,
          ...(jewelryAssetId ? { input_jewelry_asset_id: jewelryAssetId } : {}),
          ...(selectedModel?.id ? { input_preset_inspiration_id: selectedModel.id }
              : modelAssetId ? { input_inspiration_asset_id: modelAssetId } : {}),
        })
      : await startPhotoshoot({
          jewelry_image_url: jewelryUrl,
          model_image_url: modelUrl,
          category,
          idempotency_key: idempotencyKey,
          ...(jewelryAssetId ? { input_jewelry_asset_id: jewelryAssetId } : {}),
          ...(modelAssetId ? { input_model_asset_id: modelAssetId } : {}),
          ...(selectedModel?.id && !modelAssetId ? { input_preset_model_id: selectedModel.id } : {}),
        });

    const _workflowId = startResponse.workflow_id;
    setWorkflowId(_workflowId);
    trackGeneration({
      workflowId: _workflowId,
      isProductShot,
      jewelryType: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
    });
    markGenerationStarted(_workflowId);
    setCurrentStep('generating');
  } catch (error) {
    setGenerationError('unavailable');
  } finally {
    setIsSubmitting(false);
  }
}, [
  isSubmitting, jewelryImage, activeModelUrl, isProductShot, effectiveJewelryType,
  jewelryUploadedUrl, jewelryAssetId, selectedModel, customModelImage, modelAssetId,
  checkCredits, toast, setCurrentStep, setJewelryAssetId, trackGeneration,
]);
```

**3g. Add `handleKeepBrowsing` callback** — add after `handleGenerate`:

```typescript
const handleKeepBrowsing = useCallback(() => {
  hasNavigatedAway.current = true;
  setCurrentStep('model');
}, [setCurrentStep]);
```

**3h. Update `resetGeneration`** — add `hasNavigatedAway.current = false` inside:

```typescript
const resetGeneration = useCallback(() => {
  hasNavigatedAway.current = false;
  setResultImages([]);
  setWorkflowId(null);
  setGenerationError(null);
  setGenerationProgress_unused_remove_this(); // Remove the old setters entirely
  setRegenerationCount(0);
  setFeedbackOpen(false);
}, []);
```

Note: Remove `setGenerationProgress` and `setGenerationStep` calls from `resetGeneration` since those state vars are gone.

**3i. Update the hook return value** — add `handleKeepBrowsing`, keep all others unchanged:

```typescript
return {
  isGenerating,        // now reflects isSubmitting (brief submission window only)
  generationProgress,  // now derived from Context
  generationStep,      // now derived from Context
  rotatingMsgIdx,
  workflowId,
  resultImages,
  setResultImages,
  generationError,
  regenerationCount,
  setRegenerationCount,
  feedbackOpen,
  setFeedbackOpen,
  handleGenerate,
  handleKeepBrowsing,  // NEW
  resetGeneration,
};
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/hooks/useStudioGeneration.test.ts
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass (no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useStudioGeneration.ts src/hooks/useStudioGeneration.test.ts
git commit -m "feat: refactor useStudioGeneration — hand off polling to GenerationsContext"
```

---

## Task 4: Make spinner escapable (`StudioGeneratingStep.tsx`)

**Files:**
- Modify: `src/components/studio/StudioGeneratingStep.tsx`

- [ ] **Step 1: Add `onKeepBrowsing` to props interface**

In `src/components/studio/StudioGeneratingStep.tsx`, find the `StudioGeneratingStepProps` interface and add one line:

```typescript
interface StudioGeneratingStepProps {
  isProductShot: boolean;
  generationStep: string;
  generationProgress: number;
  rotatingMsgIdx: number;
  jewelryImage: string | null;
  resolvedJewelryImage: string | null;
  activeModelUrl: string | null;
  resolvedActiveModelUrl: string | null;
  generationError: string | null;
  handleStartOver: () => void;
  onKeepBrowsing: () => void;  // ← ADD THIS
}
```

- [ ] **Step 2: Add escape link to render**

Find the thumbnail row (the `<div className="flex gap-4">` block near the bottom of the non-error render path). Add the escape link immediately **before** this div:

```jsx
{/* Escape link — user can leave spinner; generation continues in background */}
<button
  onClick={onKeepBrowsing}
  className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-6"
>
  Keep browsing →
</button>
```

No `cursor-pointer` — per CLAUDE.md, buttons use default cursor.

- [ ] **Step 3: Verify no type errors**

```bash
npm run build 2>&1 | grep -i error | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/StudioGeneratingStep.tsx
git commit -m "feat: make generating spinner escapable with Keep browsing link"
```

---

## Task 5: Add `GenerationIndicator` to `Header.tsx`

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/layout/Header.tsx`, update the lucide-react import to add `Gem` and `Check`:

```typescript
import { Menu, X, LogIn, LogOut, User, Image, BadgeCheck, ScanEye, Gem, Check } from 'lucide-react';
```

Add the GenerationsContext import after the existing context imports:

```typescript
import { useGenerations } from '@/contexts/GenerationsContext';
```

- [ ] **Step 2: Add the `GenerationIndicator` component**

Add this component definition immediately before the `export function Header()` declaration:

```typescript
function GenerationIndicator() {
  const { generations } = useGenerations();
  const navigate = useNavigate();
  const [showReady, setShowReady] = useState(false);
  const prevRunningCount = useRef(0);

  const runningGenerations = generations.filter(g => g.status === 'running');
  const runningCount = runningGenerations.length;
  const completedGenerations = generations.filter(g => g.status === 'completed');

  // Show "Ready" flash when running count drops to zero and we have completed items
  useEffect(() => {
    if (prevRunningCount.current > 0 && runningCount === 0 && completedGenerations.length > 0) {
      setShowReady(true);
      const t = setTimeout(() => setShowReady(false), 3000);
      return () => clearTimeout(t);
    }
    prevRunningCount.current = runningCount;
  }, [runningCount, completedGenerations.length]);

  if (runningCount === 0 && !showReady) return null;

  const mostRecent = runningGenerations[runningGenerations.length - 1]
    ?? completedGenerations[completedGenerations.length - 1];

  const handleClick = () => {
    if (!mostRecent) return;
    if (mostRecent.status === 'completed') {
      navigate(`/studio/${mostRecent.jewelryType}`, {
        state: { asyncResult: { workflowId: mostRecent.workflowId, resultImages: mostRecent.resultImages } },
      });
    } else {
      navigate(`/studio/${mostRecent.jewelryType}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 mr-3"
      aria-label={runningCount > 0 ? 'Generation in progress' : 'Generation ready'}
    >
      {runningCount > 0 ? (
        <>
          <Gem className="h-3.5 w-3.5 text-primary animate-spin flex-shrink-0" />
          <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase hidden sm:inline">
            {runningCount > 1 ? `${runningCount} Generating\u2026` : 'Generating\u2026'}
          </span>
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase hidden sm:inline">
            Ready
          </span>
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Render the indicator in the desktop nav**

In `Header.tsx`, find the desktop user section (the `{user ? (` block, around line 120). Inside the `<div className="flex items-center gap-3">` that wraps the credits pill and profile dropdown, add `<GenerationIndicator />` **before** the credits pill `<div className="relative">`:

```jsx
{user ? (
  <div className="flex items-center gap-3">
    <GenerationIndicator />   {/* ← ADD HERE */}
    <div className="relative">  {/* credits pill starts here */}
      ...
    </div>
    ...
  </div>
) : (...)}
```

- [ ] **Step 4: Verify no type errors**

```bash
npm run build 2>&1 | grep -i error | head -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add GenerationIndicator to header for background generation tracking"
```

---

## Task 6: Handle async result in `UnifiedStudio.tsx`

**Files:**
- Modify: `src/pages/UnifiedStudio.tsx`

- [ ] **Step 1: Add `handleKeepBrowsing` from the hook**

In `UnifiedStudio.tsx`, find the `useStudioGeneration` destructuring (around line 367). Add `handleKeepBrowsing` to the destructured values:

```typescript
const {
  isGenerating,
  generationProgress,
  generationStep,
  rotatingMsgIdx,
  workflowId,
  resultImages,
  setResultImages,
  generationError,
  regenerationCount,
  setRegenerationCount,
  feedbackOpen,
  setFeedbackOpen,
  handleGenerate,
  handleKeepBrowsing,   // ← ADD THIS
  resetGeneration,
} = useStudioGeneration({ ... });
```

- [ ] **Step 2: Add async result mount effect**

In `UnifiedStudio.tsx`, find the pre-load vault asset effect (the `useEffect` that reads `location.state.preloadedJewelryUrl`, around line 247). Add a new `useEffect` **immediately after** it:

```typescript
// Handle result navigation from toast/header indicator click
// When user was away from Studio and clicks "View Results", route state carries the images.
useEffect(() => {
  const state = location.state as { asyncResult?: { workflowId: string; resultImages: string[] } } | null;
  if (!state?.asyncResult) return;
  setResultImages(state.asyncResult.resultImages);
  setCurrentStep('results');
  // Clear route state so a refresh doesn't re-apply
  navigate(location.pathname, { replace: true, state: null });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
// Dep excluded: location, navigate, setResultImages, setCurrentStep — all stable.
// This must run only on mount (not on re-renders) to avoid re-applying stale route state.
// Regression to watch: if navigate or setResultImages changes identity on re-render,
// the empty dep array prevents stale closures from running again — this is intentional.
```

- [ ] **Step 3: Pass `onKeepBrowsing` to `StudioGeneratingStep`**

Find the `<StudioGeneratingStep .../>` render (around line 580). Add the `onKeepBrowsing` prop:

```jsx
{currentStep === 'generating' && (
  <StudioGeneratingStep
    isProductShot={isProductShot}
    generationStep={generationStep}
    generationProgress={generationProgress}
    rotatingMsgIdx={rotatingMsgIdx}
    jewelryImage={jewelryImage}
    resolvedJewelryImage={resolvedJewelryImage}
    activeModelUrl={activeModelUrl}
    resolvedActiveModelUrl={resolvedActiveModelUrl}
    generationError={generationError}
    handleStartOver={handleStartOver}
    onKeepBrowsing={handleKeepBrowsing}   {/* ← ADD THIS */}
  />
)}
```

- [ ] **Step 4: Verify no type errors**

```bash
npm run build 2>&1 | grep -i error | head -20
```
Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass including the posthog-events tests (20 tests must stay green).

- [ ] **Step 6: Commit**

```bash
git add src/pages/UnifiedStudio.tsx
git commit -m "feat: wire async result navigation and Keep browsing in UnifiedStudio"
```

---

## Task 7: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the happy path**

1. Navigate to `/studio/ring` (log in if needed).
2. Upload a jewelry image → proceed to model step.
3. Select a model → click Generate.
4. **Expected:** Spinner appears. "Keep browsing →" link is visible below the thumbnail row.
5. Click "Keep browsing →". **Expected:** Returns to model step. No spinner. A small spinning gem + "Generating…" appears in the header (to the left of the credits pill).
6. Wait for generation to complete (~30–120 s). **Expected:** Toast appears bottom-left: "Your photoshoot is ready" with a "View Results" button. Header indicator briefly shows checkmark + "Ready".
7. Click "View Results" in toast. **Expected:** Studio navigates to results step with generated images.

- [ ] **Step 3: Verify navigation-away recovery**

1. Submit a generation, click "Keep browsing →", then navigate to `/generations`.
2. Wait for completion toast.
3. Click "View Results". **Expected:** Studio page opens at results step with images.

- [ ] **Step 4: Final test suite**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: async generation UX — background polling, escapable spinner, toast + header indicator

Phase 1 of async generation journey. GenerationsContext owns polling.
Studio releases user immediately after backend accepts the job.
Concurrent generations supported (unbounded queue).

Co-Authored-By: claude-flow <ruv@ruv.net>"
```
