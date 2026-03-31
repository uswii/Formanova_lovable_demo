# Artifact Auth Fix — Design Spec
**Date:** 2026-03-31
**Status:** Approved

## Background

The backend migrated from Azure SAS URLs (auth baked into the URL) to permanent artifact proxy
URLs (`/api/artifacts/<sha256>`) that require an `Authorization: Bearer <token>` header on every
request. A previous front-end pass fixed most rendering paths, but an audit found the remaining
holes documented below. This spec covers the complete fix.

## Scope

8 files. No new abstractions. No changes outside the listed files.

---

## Three patterns used throughout

All fixes are applications of one of these three patterns. Implementation must not deviate.

**Pattern 1 — Authenticated image rendering**
Call `useAuthenticatedImage(url)` at the component top level. Use the returned blob URL in `<img src>`.
The hook handles fetch, blob creation, and revocation on unmount. Already used correctly in
`AssetCard`, `WorkflowCard` (photo thumbnail), `ResultImageItem`, `SnapshotPreviewModal` (images),
`PhotoPreviewModal`, `AlternateUploadStep` (via `ProductThumb`).

**Pattern 2 — Authenticated download**
```ts
const resp = await authenticatedFetch(url);
const blob = await resp.blob();
const blobUrl = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = blobUrl;
a.download = filename;
a.click();
URL.revokeObjectURL(blobUrl);
```
Already done correctly in `CadWorkflowModal` (GLB download) and `SnapshotPreviewModal` (image download).

**Pattern 2b — Authenticated open-in-new-tab**
Same as Pattern 2 but `window.open(blobUrl, '_blank', 'noopener,noreferrer')` instead of anchor click. Do NOT revoke —
the new tab loads the URL asynchronously and revoking synchronously would race. The memory cost
(one result image per click) is acceptable and is reclaimed on page unload.

**Pattern 3 — Conditional authenticated GLB fetch (CADCanvas)**
```ts
const needsAuth = AUTHENTICATED_IMAGES_ENABLED && url.includes('/artifacts/');
const resp = needsAuth ? await authenticatedFetch(url) : await fetch(url);
```
Mirrors `ScissorGLBGrid.tsx:298–301` exactly. The fallback to plain `fetch` preserves backward
compatibility with pre-migration Azure blob URLs that appear in older history entries.

---

## File-by-file changes

### 1. `src/pages/Generations.tsx`

**What:** `preloadImage()` calls `new Image(); img.src = url` which sends no auth header and will
401 on artifact URLs. Cache-warming via this mechanism is ineffective for authenticated endpoints
regardless.

**Change:** Add a single guard:
```ts
function preloadImage(url: string) {
  if (!url || url.startsWith('data:') || url.includes('/artifacts/')) return;
  const img = new Image();
  img.src = url;
}
```

**Imports added:** none.

---

### 2. `src/components/text-to-cad/CADCanvas.tsx`

**Note:** Listed as protected in CLAUDE.md. Remove the protection entry before editing, restore
after the fix is committed. The protection was for the 3D/mesh logic — these changes touch only
the two fetch calls at the top of each GLB-loading `useEffect`.

**What:** Two `fetch(url)` / `fetch(partUrl)` calls load GLBs without auth. For `/artifacts/`
URLs these 401 silently, leaving the 3D viewport blank with no error.

**Imports to add:**
```ts
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { AUTHENTICATED_IMAGES_ENABLED } from '@/lib/feature-flags';
```

**Change 1 — primary GLB load (around line 345):**
- Replace stale comment `// Load GLB via server-side blob-proxy to avoid CORS issues with Azure`
  with `// Fetch GLB — uses authenticatedFetch for /artifacts/ proxy URLs, plain fetch otherwise`
- Replace `const response = await fetch(url);` with Pattern 3.

**Change 2 — additional GLB parts merge (around line 651):**
- Replace `const resp = await fetch(partUrl);` with Pattern 3 (using `partUrl`).

**No other changes to this file.**

---

### 3. `src/pages/UnifiedStudio.tsx`

**What:** The "open in new tab" button in `ResultImageItem` (line 218) calls
`window.open(url, '_blank', 'noopener,noreferrer')` directly on the artifact URL, which opens a
401 error page.

**Change:** Make the `onClick` async, apply Pattern 2b. The download button in `ResultImageItem`
already uses `authenticatedFetch` correctly — do not touch it.

```ts
onClick={async (e) => {
  e.stopPropagation();
  try {
    const resp = await authenticatedFetch(url);
    if (!resp.ok) throw new Error('Fetch failed');
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    // Do not revoke — new tab loads asynchronously
  } catch { /* silent — tab simply won't open */ }
}}
```

**Imports added:** none (`authenticatedFetch` already imported in this file).

---

### 4. `src/components/generations/WorkflowCard.tsx`

**What:** `handleDownloadGlb` in `CadTextCard` uses a plain anchor click on `workflow.glb_url`.

**Import to add:**
```ts
import { authenticatedFetch } from '@/lib/authenticated-fetch';
```

**Change:** Make `handleDownloadGlb` async and apply Pattern 2. Match the shape of
`CadWorkflowModal.tsx:56–76` which is the reference implementation. PostHog tracking call moves
inside the async handler but fires before the fetch.

---

### 5. `src/components/generations/SnapshotPreviewModal.tsx`

**What:** `handleDownloadGlb` uses a plain anchor click. `handleDownloadImage` in the same file
already uses Pattern 2 correctly.

**Change:** Make `handleDownloadGlb` async and apply Pattern 2. No import changes needed
(`authenticatedFetch` already imported).

---

### 6. `src/components/studio/StepGenerate.tsx`

**What:** The component renders `state.fluxResult`, `state.geminiResult`, `state.fidelityViz`,
and `state.fidelityVizGemini` — artifact URLs from the DAG pipeline — directly in `<img src>`
tags. A fullscreen dialog also renders `fullscreenImage.url` without auth. `handleDownload` uses
a plain anchor.

**Imports to add:**
```ts
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
```

**Hook calls to add at component top (before any return):**
```ts
const resolvedFlux         = useAuthenticatedImage(state.fluxResult);
const resolvedGemini       = useAuthenticatedImage(state.geminiResult);
const resolvedFidelity     = useAuthenticatedImage(state.fidelityViz);
const resolvedFidelityGem  = useAuthenticatedImage(state.fidelityVizGemini);
const resolvedFullscreen   = useAuthenticatedImage(fullscreenImage?.url ?? null);
```

**JSX substitutions:**
- `<img src={state.fluxResult}` → `<img src={resolvedFlux ?? undefined}`
- `<img src={state.fidelityViz}` → `<img src={resolvedFidelity ?? undefined}`
- `<img src={state.geminiResult || state.fluxResult!}` → `<img src={resolvedGemini ?? resolvedFlux ?? undefined}`
- `<img src={state.fidelityVizGemini}` → `<img src={resolvedFidelityGem ?? undefined}`
- Fullscreen dialog `<img src={fullscreenImage.url}` → `<img src={resolvedFullscreen ?? undefined}`

**`handleDownload` change:** Make async, apply conditional Pattern 2. The conditional is
defensive but correct — the fullscreen can only be opened from result images (all artifact URLs)
in this component:
```ts
const handleDownload = async (imageUrl: string, filename: string) => {
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

The fullscreen dialog download button passes `fullscreenImage.url` (the raw original URL, not the
blob URL) to `handleDownload` — this remains correct as `fullscreenImage` state still stores
original URLs.

---

### 7. `src/components/studio/StepRefineAndGenerate.tsx`

**What:** Same pattern as `StepGenerate.tsx`. Six raw `<img src={state.*}>` tags. This component
additionally has TWO separate fullscreen `<Dialog>` components (lines 432 and 676) that share one
`fullscreenImage` state. The fullscreen is also used for mask overlays (`baseImage`,
`state.maskBinary`) which are local `data:` URLs — the conditional `handleDownload` handles
these correctly via the else branch.

**Imports to add:** same as StepGenerate.

**Hook calls to add at component top:** same 5 calls as StepGenerate.

**JSX substitutions:**
- Lines 492, 607: `<img src={state.fluxResult}` → resolved
- Lines 516, 632: `<img src={state.fidelityViz}` → resolved
- Line 549: `<img src={state.geminiResult}` → resolved
- Line 573: `<img src={state.fidelityVizGemini}` → resolved
- Line 449 (first fullscreen dialog): `<img src={fullscreenImage.url}` → `resolvedFullscreen`
- Line 682 (second fullscreen dialog): `<img src={fullscreenImage.url}` → `resolvedFullscreen`

**`handleDownload` change:** Same conditional Pattern 2 as StepGenerate. The else branch handles
`data:` URL mask downloads via plain anchor.

---

### 8. `src/lib/assets-api.ts`

**What:** Stale comment misleads future readers into writing broken `<img src>` code.

**Change:** Line 14:
```ts
// Before:
thumbnail_url: string;   // SAS URL with 1-hour expiry — use directly in <img src>
// After:
thumbnail_url: string;   // Artifact proxy URL — always load via useAuthenticatedImage, never use directly in <img src>
```

---

## What is NOT changing

- `StepUploadMark.tsx` — `handleDownload` there operates on local `data:` blob URLs from canvas
  operations, never artifact URLs. No change.
- `generation-enrichment.ts` / `azure-utils.ts` — URL translation logic is correct and not
  involved in rendering.
- `WorkflowCard.tsx` `handleLoadInStudio` — passes the URL as a query param; `CADCanvas.tsx`
  (fixed above) handles the actual fetch.
- `AdminRouteGuard` missing `ProtectedRoute` wrapper — noted in audit, out of scope here.
- All files where `useAuthenticatedImage` / `authenticatedFetch` are already used correctly.

---

## CLAUDE.md

Before implementing step 2 (`CADCanvas.tsx`): remove the line protecting it.
After committing: restore the protection line. The 3D canvas and mesh-selection logic remain
untouched; only the two `fetch()` calls change.

---

## Testing checklist

- [ ] `/generations` — thumbnail images load; GLB downloads work; snapshot image downloads work
- [ ] `/text-to-cad` — GLB loads in 3D viewport after fix; `handleLoadInStudio` round-trip works
- [ ] `/studio/:type` — result images render after generation; download button downloads; open-in-new-tab opens image (not 401 page)
- [ ] `JewelryStudio` (local test) — result images render, fullscreen renders, download works,
      mask fullscreen still works (data: URL path)
- [ ] No regressions on pre-migration Azure blob URLs in Generations history
