# Artifact Auth Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all frontend paths that load artifact proxy URLs (`/api/artifacts/<sha256>`) without the required `Authorization: Bearer` header, replacing them with authenticated patterns.

**Architecture:** No new abstractions. Eight surgical edits applying three existing patterns (`useAuthenticatedImage`, `authenticatedFetch` download, conditional `authenticatedFetch` GLB fetch). All changes land on a feature branch and ship as a single PR for frontend team review.

**Tech Stack:** React, TypeScript, `authenticatedFetch` (`src/lib/authenticated-fetch.ts`), `useAuthenticatedImage` (`src/hooks/useAuthenticatedImage.ts`), `AUTHENTICATED_IMAGES_ENABLED` (`src/lib/feature-flags.ts`)

---

## File map

| File | Change type |
|------|-------------|
| `src/lib/assets-api.ts` | Comment only (line 14) |
| `src/pages/Generations.tsx` | One-line guard in `preloadImage` |
| `src/pages/UnifiedStudio.tsx` | Make open-in-new-tab onClick async + Pattern 2b |
| `src/components/generations/WorkflowCard.tsx` | Add import; make `handleDownloadGlb` async + Pattern 2 |
| `src/components/generations/SnapshotPreviewModal.tsx` | Make `handleDownloadGlb` async + Pattern 2 |
| `src/components/text-to-cad/CADCanvas.tsx` | Add 2 imports; fix comment; replace 2 `fetch()` with Pattern 3 |
| `src/components/studio/StepGenerate.tsx` | Add 2 imports; 5 hook calls; 5 `<img>` replacements; async `handleDownload` |
| `src/components/studio/StepRefineAndGenerate.tsx` | Add 2 imports; 5 hook calls; 8 `<img>` replacements; async `handleDownload` |
| `CLAUDE.md` | Temporarily unprotect CADCanvas during Task 7, restore immediately after |

> **No tests to write:** These changes fix browser rendering (authenticated fetch, blob URL creation). They are not unit-testable in Vitest — the existing posthog test suite (`npx vitest run src/lib/posthog-events.test.ts`) must stay green. Manual verification steps are listed at the end of each task and consolidated in the testing checklist at the bottom of this plan.

---

### Task 1: Create feature branch

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b fix/artifact-auth
```

Expected: `Switched to a new branch 'fix/artifact-auth'`

---

### Task 2: Fix stale comment in `assets-api.ts`

**Files:**
- Modify: `src/lib/assets-api.ts:14`

- [ ] **Step 1: Apply the comment fix**

In `src/lib/assets-api.ts`, line 14, replace:
```ts
  thumbnail_url: string;   // SAS URL with 1-hour expiry — use directly in <img src>
```
with:
```ts
  thumbnail_url: string;   // Artifact proxy URL — always load via useAuthenticatedImage, never use directly in <img src>
```

- [ ] **Step 2: Verify the file looks correct**

Run: `grep -n "thumbnail_url" src/lib/assets-api.ts`

Expected output includes:
```
14:  thumbnail_url: string;   // Artifact proxy URL — always load via useAuthenticatedImage, never use directly in <img src>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/assets-api.ts
git commit -m "fix: update stale assets-api comment — thumbnail_url requires useAuthenticatedImage"
```

---

### Task 3: Guard `preloadImage` in `Generations.tsx`

**Files:**
- Modify: `src/pages/Generations.tsx:62`

**Why:** `preloadImage` calls `new Image(); img.src = url` which sends no auth header. For `/artifacts/` URLs it silently 401s and warms nothing. Adding the guard skips them.

- [ ] **Step 1: Apply the guard**

In `src/pages/Generations.tsx`, replace lines 61–65:
```ts
/** Preload an image into browser cache */
function preloadImage(url: string) {
  if (!url || url.startsWith('data:')) return;
  const img = new Image();
  img.src = url;
}
```
with:
```ts
/** Preload an image into browser cache */
function preloadImage(url: string) {
  if (!url || url.startsWith('data:') || url.includes('/artifacts/')) return;
  const img = new Image();
  img.src = url;
}
```

- [ ] **Step 2: Verify**

Run: `grep -A4 "function preloadImage" src/pages/Generations.tsx`

Expected:
```ts
function preloadImage(url: string) {
  if (!url || url.startsWith('data:') || url.includes('/artifacts/')) return;
  const img = new Image();
  img.src = url;
}
```

- [ ] **Step 3: Run lint**

```bash
npm run lint -- --quiet 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Generations.tsx
git commit -m "fix: skip artifact URLs in preloadImage — unauthenticated fetch always 401s"
```

---

### Task 4: Fix open-in-new-tab in `UnifiedStudio.tsx`

**Files:**
- Modify: `src/pages/UnifiedStudio.tsx:218`

**Why:** `window.open(url, '_blank', ...)` on a raw artifact URL opens a 401 page. Instead: fetch with auth → create blob URL → open blob URL. Do NOT revoke the blob URL — the new tab loads asynchronously.

- [ ] **Step 1: Apply Pattern 2b**

In `src/pages/UnifiedStudio.tsx`, find the open-in-new-tab Button at line ~218. Replace its `onClick` prop:

Before:
```tsx
          onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer'); }}
```

After:
```tsx
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const resp = await authenticatedFetch(url);
              if (!resp.ok) throw new Error('Fetch failed');
              const blob = await resp.blob();
              const blobUrl = URL.createObjectURL(blob);
              window.open(blobUrl, '_blank', 'noopener,noreferrer');
              // Do not revoke — new tab loads the URL asynchronously
            } catch { /* silent — tab simply won't open */ }
          }}
```

> `authenticatedFetch` is already imported in this file. No import changes needed.

- [ ] **Step 2: Verify no import changes needed**

```bash
grep "authenticatedFetch" src/pages/UnifiedStudio.tsx | head -3
```

Expected: at least one existing import line.

- [ ] **Step 3: Run lint**

```bash
npm run lint -- --quiet 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/UnifiedStudio.tsx
git commit -m "fix: open-in-new-tab uses authenticatedFetch blob URL instead of raw artifact URL"
```

---

### Task 5: Fix GLB download in `WorkflowCard.tsx`

**Files:**
- Modify: `src/components/generations/WorkflowCard.tsx:1` (add import)
- Modify: `src/components/generations/WorkflowCard.tsx:114–123` (replace `handleDownloadGlb`)

**Why:** `handleDownloadGlb` in `CadTextCard` creates a plain anchor on `workflow.glb_url`. For `/artifacts/` URLs the browser fetch will 401 and the download fails silently. Reference implementation: `CadWorkflowModal.tsx:56–76`.

- [ ] **Step 1: Add import**

In `src/components/generations/WorkflowCard.tsx`, add this import after the existing imports (after line 13, before the `const localDateFmt` line):
```ts
import { authenticatedFetch } from '@/lib/authenticated-fetch';
```

- [ ] **Step 2: Replace `handleDownloadGlb`**

Replace lines 114–123:
```ts
  const handleDownloadGlb = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workflow.glb_url) return;
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: shownFilename, file_type: 'glb', context: 'generations' }));
    const a = document.createElement('a');
    a.href = workflow.glb_url;
    a.download = shownFilename;
    a.target = '_blank';
    a.click();
  };
```

with:
```ts
  const handleDownloadGlb = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workflow.glb_url) return;
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: shownFilename, file_type: 'glb', context: 'generations' }));
    try {
      const resp = await authenticatedFetch(workflow.glb_url);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = shownFilename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('[WorkflowCard] GLB download error:', err);
    }
  };
```

- [ ] **Step 3: Run lint**

```bash
npm run lint -- --quiet 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/generations/WorkflowCard.tsx
git commit -m "fix: use authenticatedFetch for GLB download in WorkflowCard"
```

---

### Task 6: Fix GLB download in `SnapshotPreviewModal.tsx`

**Files:**
- Modify: `src/components/generations/SnapshotPreviewModal.tsx:63–72`

**Why:** `handleDownloadGlb` uses a plain anchor on `glbUrl`. `authenticatedFetch` is already imported and `handleDownloadImage` immediately above it already uses Pattern 2 correctly — mirror that pattern.

- [ ] **Step 1: Replace `handleDownloadGlb`**

Replace lines 63–72:
```ts
  const handleDownloadGlb = () => {
    if (!glbUrl) return;
    const fileName = glbFilename || 'model.glb';
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: fileName, file_type: 'glb', context: 'generations-snapshot' }));
    const a = document.createElement('a');
    a.href = glbUrl;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  };
```

with:
```ts
  const handleDownloadGlb = async () => {
    if (!glbUrl) return;
    const fileName = glbFilename || 'model.glb';
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: fileName, file_type: 'glb', context: 'generations-snapshot' }));
    try {
      const resp = await authenticatedFetch(glbUrl);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('[SnapshotPreviewModal] GLB download error:', err);
    }
  };
```

- [ ] **Step 2: Run lint**

```bash
npm run lint -- --quiet 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/generations/SnapshotPreviewModal.tsx
git commit -m "fix: use authenticatedFetch for GLB download in SnapshotPreviewModal"
```

---

### Task 7: Fix GLB fetch in `CADCanvas.tsx`

**Files:**
- Modify: `CLAUDE.md:88` (temporarily remove protection; restore in Step 8)
- Modify: `src/components/text-to-cad/CADCanvas.tsx:1–24` (add 2 imports)
- Modify: `src/components/text-to-cad/CADCanvas.tsx:345` (update stale comment)
- Modify: `src/components/text-to-cad/CADCanvas.tsx:354` (replace `fetch(url)`)
- Modify: `src/components/text-to-cad/CADCanvas.tsx:651` (replace `fetch(partUrl)`)

**Why:** CADCanvas has two plain `fetch()` calls that load GLB files. For `/artifacts/` URLs these 401 silently, leaving the 3D viewport blank. Pattern 3 mirrors `ScissorGLBGrid.tsx:298–301` — conditional auth based on URL shape, fallback to plain fetch for pre-migration Azure blob URLs in older history entries.

**IMPORTANT:** CADCanvas.tsx is listed as a protected file in CLAUDE.md. The protection guards the 3D/mesh-selection logic. These changes touch only the two `fetch()` calls at the top of each GLB-loading `useEffect`. Remove the protection before editing; restore it immediately after committing.

- [ ] **Step 1: Remove CLAUDE.md protection**

In `CLAUDE.md`, remove line 88:
```
- `src/components/text-to-cad/CADCanvas.tsx` — 3D canvas, GLB loading, mesh selection
```

The **Protected files** block should now only list `materials.ts`.

- [ ] **Step 2: Add imports to CADCanvas.tsx**

At the end of the existing import block in `src/components/text-to-cad/CADCanvas.tsx` (after line 23, before the `// ── Quality settings` comment), add:
```ts
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { AUTHENTICATED_IMAGES_ENABLED } from '@/lib/feature-flags';
```

- [ ] **Step 3: Fix primary GLB load (line ~345)**

Replace:
```ts
  // Load GLB via server-side blob-proxy to avoid CORS issues with Azure
  useEffect(() => {
    if (!url || loadedUrlRef.current === url) return;
    loadedUrlRef.current = url;
    let cancelled = false;
    onLoadStart?.();

    (async () => {
      try {
        const response = await fetch(url);
```

with:
```ts
  // Fetch GLB — uses authenticatedFetch for /artifacts/ proxy URLs, plain fetch otherwise
  useEffect(() => {
    if (!url || loadedUrlRef.current === url) return;
    loadedUrlRef.current = url;
    let cancelled = false;
    onLoadStart?.();

    (async () => {
      try {
        const needsAuth = AUTHENTICATED_IMAGES_ENABLED && url.includes('/artifacts/');
        const response = needsAuth ? await authenticatedFetch(url) : await fetch(url);
```

- [ ] **Step 4: Fix additional GLB parts merge (line ~651)**

Replace:
```ts
          const resp = await fetch(partUrl);
```

with:
```ts
          const needsAuth = AUTHENTICATED_IMAGES_ENABLED && partUrl.includes('/artifacts/');
          const resp = needsAuth ? await authenticatedFetch(partUrl) : await fetch(partUrl);
```

- [ ] **Step 5: Run lint**

```bash
npm run lint -- --quiet 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 6: Restore CLAUDE.md protection**

In `CLAUDE.md`, restore line 88 — the **Protected files** block must read:
```
**Protected files — do not modify:**
- `src/components/text-to-cad/CADCanvas.tsx` — 3D canvas, GLB loading, mesh selection
- `src/components/cad-studio/materials.ts` — Material definitions (sealed constants)
```

- [ ] **Step 7: Commit everything together**

```bash
git add CLAUDE.md src/components/text-to-cad/CADCanvas.tsx
git commit -m "fix: use authenticatedFetch for GLB fetch in CADCanvas (Pattern 3)"
```

---

### Task 8: Fix auth in `StepGenerate.tsx`

**Files:**
- Modify: `src/components/studio/StepGenerate.tsx:1–26` (add 2 imports)
- Modify: `src/components/studio/StepGenerate.tsx:36–44` (add 5 hook calls after existing state declarations)
- Modify: `src/components/studio/StepGenerate.tsx:178–186` (replace `handleDownload`)
- Modify: `src/components/studio/StepGenerate.tsx:234–239` (fullscreen `<img>`)
- Modify: `src/components/studio/StepGenerate.tsx:324` (`<img src={state.fluxResult}`)
- Modify: `src/components/studio/StepGenerate.tsx:352` (`<img src={state.fidelityViz}`)
- Modify: `src/components/studio/StepGenerate.tsx:415` (`<img src={state.geminiResult || state.fluxResult!}`)
- Modify: `src/components/studio/StepGenerate.tsx:446` (`<img src={state.fidelityVizGemini}`)

> **Note:** `StepGenerate.tsx` is only used by `JewelryStudio`, which is currently commented out in `App.tsx`. These fixes are pre-emptive — they prevent 401s when/if the route is re-enabled. No production 401s are currently coming from this file.

- [ ] **Step 1: Add imports**

After line 26 (after the `markGenerationStarted...` import line), add:
```ts
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
```

- [ ] **Step 2: Add hook calls**

Inside `StepGenerate` component, after line 44 (after the `const { refreshCredits }` line and before `const handleGenerate`), add:
```ts
  const resolvedFlux        = useAuthenticatedImage(state.fluxResult ?? null);
  const resolvedGemini      = useAuthenticatedImage(state.geminiResult ?? null);
  const resolvedFidelity    = useAuthenticatedImage(state.fidelityViz ?? null);
  const resolvedFidelityGem = useAuthenticatedImage(state.fidelityVizGemini ?? null);
  const resolvedFullscreen  = useAuthenticatedImage(fullscreenImage?.url ?? null);
```

- [ ] **Step 3: Replace `handleDownload`**

Replace lines 178–186:
```ts
  const handleDownload = (imageUrl: string, filename: string) => {
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: filename, file_type: 'png', context: 'step-generate' }));
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
```

with:
```ts
  const handleDownload = async (imageUrl: string, filename: string) => {
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: filename, file_type: 'png', context: 'step-generate' }));
    if (imageUrl.includes('/artifacts/')) {
      const resp = await authenticatedFetch(imageUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } else {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = filename;
      a.click();
    }
  };
```

- [ ] **Step 4: Replace fullscreen `<img>`**

Find the fullscreen dialog `<img>` tag (around line 234):
```tsx
                <img 
                  src={fullscreenImage.url} 
                  alt={fullscreenImage.title} 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
```

Replace with:
```tsx
                <img 
                  src={resolvedFullscreen ?? undefined} 
                  alt={fullscreenImage.title} 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
```

- [ ] **Step 5: Replace inline result `<img>` tags**

Replace (line ~324):
```tsx
                          <img src={state.fluxResult} alt="Standard result" className="w-full h-auto" />
```
with:
```tsx
                          <img src={resolvedFlux ?? undefined} alt="Standard result" className="w-full h-auto" />
```

Replace (line ~352):
```tsx
                                  <img src={state.fidelityViz} alt="Accuracy visualization" className="w-full h-auto" />
```
with:
```tsx
                                  <img src={resolvedFidelity ?? undefined} alt="Accuracy visualization" className="w-full h-auto" />
```

Replace (line ~415):
```tsx
                          <img
                            src={state.geminiResult || state.fluxResult!}
                            alt="Enhanced result"
                            className="w-full h-auto"
```
with:
```tsx
                          <img
                            src={resolvedGemini ?? resolvedFlux ?? undefined}
                            alt="Enhanced result"
                            className="w-full h-auto"
```

Replace (line ~446):
```tsx
                                  <img src={state.fidelityVizGemini} alt="Accuracy visualization" className="w-full h-auto" />
```
with:
```tsx
                                  <img src={resolvedFidelityGem ?? undefined} alt="Accuracy visualization" className="w-full h-auto" />
```

- [ ] **Step 6: Run lint**

```bash
npm run lint -- --quiet 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/studio/StepGenerate.tsx
git commit -m "fix: add auth to StepGenerate image rendering and download"
```

---

### Task 9: Fix auth in `StepRefineAndGenerate.tsx`

**Files:**
- Modify: `src/components/studio/StepRefineAndGenerate.tsx:1` (add 2 imports)
- Modify: `src/components/studio/StepRefineAndGenerate.tsx:169` region (add 5 hook calls)
- Modify: `src/components/studio/StepRefineAndGenerate.tsx:361–369` (replace `handleDownload`)
- Modify: Lines 449, 492, 516, 549, 573, 607, 632, 682 (8 `<img>` substitutions)

> **Note:** Same dead-code caveat as Task 8. Additionally, this component's fullscreen is used for both artifact URLs (result images) AND local `data:` URLs (mask overlays at lines 740, 788). The conditional `handleDownload` handles both correctly — `data:` URLs take the else branch.

- [ ] **Step 1: Add imports**

After line 30 (after `import { useCredits }...`), add:
```ts
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
```

- [ ] **Step 2: Add hook calls**

Inside the `StepRefineAndGenerate` component, after the `fullscreenImage` state declaration at line 169 (`const [fullscreenImage, setFullscreenImage]...`), add:
```ts
  const resolvedFlux        = useAuthenticatedImage(state.fluxResult ?? null);
  const resolvedGemini      = useAuthenticatedImage(state.geminiResult ?? null);
  const resolvedFidelity    = useAuthenticatedImage(state.fidelityViz ?? null);
  const resolvedFidelityGem = useAuthenticatedImage(state.fidelityVizGemini ?? null);
  const resolvedFullscreen  = useAuthenticatedImage(fullscreenImage?.url ?? null);
```

- [ ] **Step 3: Replace `handleDownload`**

Replace lines 361–369:
```ts
  const handleDownload = (imageUrl: string, filename: string) => {
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: filename, file_type: 'png', context: 'step-refine' }));
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
```

with:
```ts
  const handleDownload = async (imageUrl: string, filename: string) => {
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: filename, file_type: 'png', context: 'step-refine' }));
    if (imageUrl.includes('/artifacts/')) {
      const resp = await authenticatedFetch(imageUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } else {
      // data: URLs (mask overlays) — plain anchor
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = filename;
      a.click();
    }
  };
```

- [ ] **Step 4: Replace fullscreen `<img>` tags (both dialogs)**

First fullscreen dialog (around line 449):
```tsx
                  <img 
                    src={fullscreenImage.url} 
                    alt={fullscreenImage.title} 
                    className="max-w-full max-h-[80vh] object-contain rounded-lg"
```
→
```tsx
                  <img 
                    src={resolvedFullscreen ?? undefined} 
                    alt={fullscreenImage.title} 
                    className="max-w-full max-h-[80vh] object-contain rounded-lg"
```

Second fullscreen dialog (around line 682):
```tsx
                <img 
                  src={fullscreenImage.url} 
                  alt={fullscreenImage.title} 
                  className="max-w-full max-h-[85vh] object-contain"
```
→
```tsx
                <img 
                  src={resolvedFullscreen ?? undefined} 
                  alt={fullscreenImage.title} 
                  className="max-w-full max-h-[85vh] object-contain"
```

- [ ] **Step 5: Replace inline result `<img>` tags (6 tags)**

Line ~492:
```tsx
                        <img src={state.fluxResult} alt="Standard result" className="max-w-full max-h-full object-contain" />
```
→
```tsx
                        <img src={resolvedFlux ?? undefined} alt="Standard result" className="max-w-full max-h-full object-contain" />
```

Line ~516:
```tsx
                            <img src={state.fidelityViz} alt="Jewelry Accuracy" className="w-full h-auto" />
```
→
```tsx
                            <img src={resolvedFidelity ?? undefined} alt="Jewelry Accuracy" className="w-full h-auto" />
```

Line ~549:
```tsx
                        <img src={state.geminiResult} alt="Enhanced result" className="max-w-full max-h-full object-contain" />
```
→
```tsx
                        <img src={resolvedGemini ?? undefined} alt="Enhanced result" className="max-w-full max-h-full object-contain" />
```

Line ~573:
```tsx
                            <img src={state.fidelityVizGemini} alt="Jewelry Accuracy" className="w-full h-auto" />
```
→
```tsx
                            <img src={resolvedFidelityGem ?? undefined} alt="Jewelry Accuracy" className="w-full h-auto" />
```

Line ~607:
```tsx
                    <img src={state.fluxResult} alt="Generated result" className="max-w-full max-h-full object-contain" />
```
→
```tsx
                    <img src={resolvedFlux ?? undefined} alt="Generated result" className="max-w-full max-h-full object-contain" />
```

Line ~632:
```tsx
                      <img src={state.fidelityViz} alt="Jewelry Accuracy" className="w-full h-auto" />
```
→
```tsx
                      <img src={resolvedFidelity ?? undefined} alt="Jewelry Accuracy" className="w-full h-auto" />
```

- [ ] **Step 6: Run lint**

```bash
npm run lint -- --quiet 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 7: Run posthog test suite to confirm no regressions**

```bash
npx vitest run src/lib/posthog-events.test.ts
```

Expected: all 20 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/studio/StepRefineAndGenerate.tsx
git commit -m "fix: add auth to StepRefineAndGenerate image rendering and download"
```

---

### Task 10: Open pull request

- [ ] **Step 1: Push branch**

```bash
git push -u origin fix/artifact-auth
```

- [ ] **Step 2: Open PR**

```bash
gh pr create \
  --base main \
  --title "fix: authenticate all artifact URL fetch paths" \
  --body "$(cat <<'EOF'
## Summary

Fixes all frontend paths that loaded \`/api/artifacts/<sha256>\` URLs without
the required \`Authorization: Bearer\` header, following the backend migration
from Azure SAS URLs to permanent proxy URLs.

**8 files changed, 3 patterns applied:**
- **Pattern 1 (useAuthenticatedImage):** StepGenerate, StepRefineAndGenerate
- **Pattern 2 (authenticatedFetch download):** WorkflowCard, SnapshotPreviewModal, StepGenerate, StepRefineAndGenerate
- **Pattern 2b (authenticatedFetch open-in-tab):** UnifiedStudio
- **Pattern 3 (conditional GLB fetch):** CADCanvas
- **Guard:** Generations preloadImage
- **Comment:** assets-api stale doc

## Test plan

- [ ] `/generations` — thumbnail images load; GLB card downloads save file; snapshot image download saves file
- [ ] `/text-to-cad` — GLB loads in 3D viewport; Load in Studio → GLB still loads
- [ ] `/studio/:type` — result images render after generation; download button saves file; open-in-new-tab opens image (not 401 page)
- [ ] No regressions on older history entries with pre-migration Azure blob URLs

🤖 Generated with [claude-flow](https://github.com/ruvnet/claude-flow)
EOF
)"
```

- [ ] **Step 3: Note the PR URL**

Copy the PR URL from the output and share with the frontend developer for review.

---

## Manual Testing Checklist (consolidated)

After the PR is merged and deployed:

| Route | What to check |
|-------|---------------|
| `/generations` | Thumbnail images render; GLB download saves `.glb` file; snapshot image download saves `.png` |
| `/text-to-cad` | 3D viewport shows the ring model; Load in Studio round-trip works |
| `/studio/:type` | Result images appear after generation completes; download button works; open-in-new-tab opens image (not a 401 page) |
| Older history entries | Pre-migration Azure blob URLs in Generations still load (Pattern 3 fallback) |
