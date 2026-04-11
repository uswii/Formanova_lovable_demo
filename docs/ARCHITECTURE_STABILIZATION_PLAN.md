# Architecture Stabilization Plan

## 1. Current diagnosis

FormaNova has grown through vertical feature slices. Each slice solved API calls, auth, polling, credits, loading, and assets locally. That made early shipping fast, but now every new feature risks breaking another flow.

The main regression driver is coupling, not lack of effort.
The fix is not a rewrite.
The fix is to standardize the boundaries new work must use.

---

## 2. Confirmed high-risk areas

### `src/lib/photoshoot-api.ts`

4 raw protected `/api` calls:
- `startPhotoshoot` - `/api/run/state/jewelry_photoshoots_generator`
- `getPhotoshootStatus` - `/api/status/{workflowId}`
- `getPhotoshootResult` - `/api/result/{workflowId}`
- `startPdpShot` - `/api/run/Product_shot_pipeline`

These manually attach JWT through `getStoredToken`/`getAuthHeaders`.
On 401 they throw generic generation errors instead of using centralized auth expiry behavior.

### `src/hooks/use-image-validation.ts`

- Hardcoded `https://formanova.ai`.
- Raw/manual auth pattern.
- 401 can appear as validation/classification failure rather than auth expiry.

### Runtime production URL hardcodes

- `src/hooks/use-image-validation.ts`
- `src/pages/PromoAdminPage.tsx`
- `src/lib/generation-history-api.ts`
- `src/lib/generation-enrichment.ts`

### Azure blob hardcodes

- `src/lib/azure-utils.ts`
- `src/lib/model-library.ts`

### Error boundary coverage

- `ChunkErrorBoundary` handles chunk-load failures only.
- `PostHogErrorBoundary` exists but is not currently wired globally.
- `UnifiedStudio`/`TextToCAD`/`CADCanvas` normal runtime errors can still have large blast radius.

### Credit/pricing drift

- `TOOL_COSTS` has stale/dormant keys.
- `jewelry_photoshoots_generator` is used live but was missing from `TOOL_COSTS` in the audited repo.
- Verify product-shot workflow cost key too.

---

## 3. Phase 1: stop drift

**PR 1:**
- Add `AI_RULES.md`.
- Add `docs/ARCHITECTURE_STABILIZATION_PLAN.md`.
- No production behavior changes in this PR.

**Acceptance:**
- Files added.
- No app source files changed.

---

## 4. Phase 2: tiny stability fixes

**PR 2:**
- Wire `PostHogErrorBoundary` or a general-purpose runtime error boundary into the app.
- Keep `ChunkErrorBoundary` for chunk-load recovery.
- Do not remove existing `ChunkErrorBoundary` behavior.
- Add `jewelry_photoshoots_generator` to `TOOL_COSTS` if still missing.
- Verify whether product-shot has a separate workflow/cost key. Add it only if the backend actually uses a separate key.

**Acceptance:**
- App still boots.
- Existing tests pass.
- Error boundary behavior is manually smoke-tested or covered if practical.
- Credit fallback for live photoshoot workflow is no longer missing.

---

## 5. Phase 3: migrate photoshoot-api.ts to authenticatedFetch

**PR 3:**
- Target `src/lib/photoshoot-api.ts`.
- Replace raw fetch calls to protected `/api` endpoints with `authenticatedFetch`.
- Remove `getAuthHeaders` if no longer needed.
- Remove `getStoredToken` import if no longer needed.
- Use relative paths:
  - `/api/run/state/jewelry_photoshoots_generator`
  - `/api/status/{workflowId}`
  - `/api/result/{workflowId}`
  - `/api/run/Product_shot_pipeline` (if `startPdpShot` exists)
- Preserve current non-auth behavior:
  - status 404 returns/renders running behavior
  - result 404 retry behavior remains
  - request payload shape does not change

**Tests required in same PR:**
- `startPhotoshoot` uses `authenticatedFetch` path and body.
- `getPhotoshootStatus` preserves 404-as-running behavior.
- `getPhotoshootResult` preserves 404 retry behavior.
- 401 path uses `authenticatedFetch`/`AuthExpiredError` behavior.
- `startPdpShot` is tested if present.

---

## 6. Phase 4: remove hardcoded runtime production backend URLs

**PR 4:**
- `src/hooks/use-image-validation.ts`
  - migrate protected calls to `authenticatedFetch`
  - use relative `/api` paths instead of `https://formanova.ai`
  - preserve validation result behavior except auth expiry should now use `authenticatedFetch` behavior
- `src/lib/generation-history-api.ts`
  - change runtime `BASE_URL` from `https://formanova.ai` to relative path or configured API base
  - keep `authenticatedFetch`
- `src/lib/generation-enrichment.ts`
  - change `https://formanova.ai/api/result/{workflowId}` to `/api/result/{workflowId}`
  - keep `authenticatedFetch`
- `src/pages/PromoAdminPage.tsx`
  - change hardcoded production `API_BASE` to relative `/api/credits/admin/ui/promo-codes`
  - keep `authenticatedFetch`

**Tests required:**
- `generation-enrichment` uses relative result URL.
- `use-image-validation` 401 no longer silently becomes generic classification unavailable.
- Existing generation-history tests still pass.

---

## 7. Phase 5: migrate remaining protected raw /api call sites

**PR 5:**
- `src/pages/LinkAccount.tsx`
  - replace raw fetch to `/api/agent/link/complete` with `authenticatedFetch`
  - preserve 400/403/404/422 user-facing status mapping
- `src/lib/admin-generations-api.ts`
  - replace manual `getStoredToken` + fetch with `authenticatedFetch`
  - preserve `AdminGenerationsApiError` for non-auth admin UI handling
- `src/pages/AdminFeedbackPage.tsx`
  - protected artifact/image downloads should use `authenticatedFetch`
  - preserve public/signed URL behavior if the helper supports both

**Acceptance:**
- No protected runtime `/api` calls in `src/lib` or `src/pages` manually attach Bearer tokens, except explicitly excluded auth/bootstrap/admin-secret cases.

---

## 8. Explicit do-not-migrate list

Do not migrate these in the first pass:

- `src/lib/authenticated-fetch.ts` - wrapper internals
- `src/lib/auth-api.ts` - auth bootstrap/login/register/logout/me behavior is special
- `src/pages/Auth.tsx` - OAuth/auth bootstrap endpoints are not normal protected `/api` calls
- `validateStoredToken` behavior - intentionally does not redirect on 401
- `src/lib/pipeline-api.ts` - has `X-Admin-Secret`/admin behavior and appears outside current highest-risk live path
- `CADCanvas`/`ScissorGLBGrid` dual-fetch behavior - protected `/artifacts` through `authenticatedFetch` and public GLB through raw fetch is acceptable
- `TextToCAD` STL signed Azure download - raw fetch is acceptable if backend returns signed public Azure URL

---

## 9. Phase 6: shared polling/result parsing

Do not start until Phases 3-5 are merged and green.

Design or implement a shared polling helper/hook that covers:
- interval
- timeout
- transient 404 policy
- error limit
- cancellation
- terminal states
- optional progress callback
- product-specific result parser

Flows to eventually unify:
- `UnifiedStudio` status/result polling
- `use-image-validation` classification polling
- `TextToCAD` CAD generation polling
- `TextToCAD` weight/STL polling

Before writing a new helper, evaluate whether `src/lib/microservices-api.ts` `pollJobUntilComplete` can be reused or adapted.

---

## 10. Phase 7: paid-feature/credit flow

Do after API/auth stabilization.

Tasks:
- Audit `TOOL_COSTS` keys.
- Remove or document dead keys.
- Confirm live workflow keys:
  - `jewelry_photoshoots_generator`
  - `Product_shot_pipeline` or actual product-shot cost key, if separate
  - `ring_generate_v1` and model variants
- Verify CAD weight/STL have credit preflight if they are paid.
- Add a new-paid-feature checklist to docs or PR template.

---

## 11. Phase 8: split UnifiedStudio safely

Do not start until:
- photoshoot API migration is tested
- polling helper exists and is tested
- session save/restore behavior has tests

Extraction target:
- `useStudioUpload`
- `useStudioGeneration`
- `useStudioSession`
- `ResultsPanel`
- `FeedbackPanel`

This is extraction, not rewrite.
