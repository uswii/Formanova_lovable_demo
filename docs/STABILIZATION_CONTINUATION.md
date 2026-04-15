# FormaNova Stabilization Continuation

## Current Goal

Stabilize FormaNova before feature velocity resumes.

The work is focused on stopping architecture drift, standardizing API/auth/polling/environment behavior, and then proving the stack with runtime QA on staging. Do not start broad refactors until the stabilization stack is runtime-tested.

## Product Context

FormaNova is one product with two tools:

- Photo / on-model / product-shot generation
- CAD text-to-3D / WebGL generation

Shared auth, nav/header, credits, and history are intended.

CAD weight estimate and STL export are intentionally free after a generated or imported GLB exists. They should not get credit preflight unless product/backend later changes that decision.

User-facing preset models should come only from `/api/models`, not from a hardcoded Azure fallback.

## Completed Phases

- Phase 1: Docs guardrails.
- Phase 2: Runtime error boundary and confirmed credit fallback keys.
- Phase 3: `photoshoot-api` migrated to `authenticatedFetch`.
- Phase 4: Runtime backend URL cleanup.
- Phase 5: Remaining protected API auth cleanup.
- Phase 6: Polling design.
- Phase 7: `pollWorkflow` helper.
- Phase 8: Image-validation polling migration.
- Phase 9: `UnifiedStudio` polling prep.
- Phase 10: `UnifiedStudio` polling migration.
- Phase 11: CAD weight/STL polling migration.
- Phase 12: CAD generation/edit polling prep.
- Phase 13: CAD generation/edit polling migration.
- Phase 14: Credit intent comments for free CAD auxiliary workflows.
- Phase 15: `/api/models` only; removed hardcoded Azure preset model fallback.
- Phase 16: Public site URL helper for auth escape links.
- Phase 17: PostHog `api_host` env.
- Phase 18: Env-driven host redirect policy.
- Phase 19: Local CAD/WebGL runtime error boundary.
- Phase 20: Env-driven Azure artifact URL conversion.
- Phase 21: Env-driven temporary feature flag email allowlists.
- Phase 22: Removed unused credit context/API surface and dead fallback keys.
- Phase 23: CAD navigation active-state and dashboard entry-copy polish.
- Phase 24: Resolved PR #16 merge conflicts with main.
- Phase 25: Extracted 4 sub-components from UnifiedStudio.tsx (PR #23).
- Phase 26: Added RouteErrorBoundary to prevent runtime crash white-screens (PR #24).
- Phase 27: Extracted useStudioModels and useStudioGeneration hooks (PR #25).
- Phase 28: Extracted example image constants to `src/lib/studio-examples.ts` (PR #26).
- Phase 29: Extracted `StudioGeneratingStep` and `StudioResultsStep` render components (PR #28).
- Phase 30: Extracted `useStudioUpload` hook (PR #29).
- Phase 31: Extracted `StudioUploadStep` from `UnifiedStudio.tsx` (merged directly into `phase-18-host-redirect-policy`).
- Phase 32: Extracted `StudioModelStep` from `UnifiedStudio.tsx`.
- Phase 33: Added Rule 9 compliant `eslint-disable react-hooks/exhaustive-deps` explanations.
- Phase 34: Removed dead imports from `UnifiedStudio.tsx` and added smoke tests.
- Phase 35: Extracted `StudioHeader` from `UnifiedStudio.tsx`.
- Phase 36: Extracted `useStudioOnboarding` hook.
- Phase 37: Extracted upload step render code again after branch-chain divergence.
- Phase 38: Renamed `AlternateUploadStep` to `StudioVaultUploadStep`.
- Phase 39: Renamed `isAltUploadLayoutEnabled` to `isVaultUploadLayoutEnabled`.

## Branch Status

- `phase-18-host-redirect-policy` is the combined branch containing phases 2-39.
- `phase-19-cad-webgl-error-boundary` contains the CAD/WebGL local error-boundary work.
- `phase-20-azure-storage-config` contains the Azure `azure://` conversion config cleanup.
- `phase-21-feature-flag-allowlists` contains the temporary feature-gate email allowlist cleanup.
- `phase-22-dead-credit-context-cleanup` contains the dead credit context/API cleanup.
- `phase-23-cad-onboarding-routing-polish` contains the CAD nav/dashboard polish.
- All phase branches 2-18 have been pushed.
- Phase 19 has been pushed and opened as PR #17 against `phase-18-host-redirect-policy`.
- Phase 20 has been pushed and opened as PR #18 against `phase-18-host-redirect-policy`.
- Phase 21 has been pushed and opened as PR #19 against `phase-18-host-redirect-policy`.
- Phase 22 has been pushed and opened as PR #20 against `phase-18-host-redirect-policy`.
- Phase 23 has been pushed and opened as PR #21 against `phase-18-host-redirect-policy`.
- Phase 31 opened as PR #31 and merged into `phase-18-host-redirect-policy`.
- Phase 32 opened as PR #30 and merged into `phase-18-host-redirect-policy`.
- Phases 32-39 were direct-merged into `phase-18-host-redirect-policy` at merge commit `ad05abbd`.
- Intermediate PRs #32-#38 were closed because their commits are already included in `phase-18-host-redirect-policy`.
- `phase-13-cad-generation-edit-polling` is PR #11 and runtime QA is pending.
- The combined stabilization PR is PR #16 from `phase-18-host-redirect-policy` to `main`. It is the only remaining merge PR after runtime QA.
- `.claude/` is untracked and should not be committed.

## Latest Verified Phase

Phase 39 was completed by merging the full phase 32-39 chain directly into `phase-18-host-redirect-policy`. UnifiedStudio split is now complete and the combined branch contains phases 2-39.

- Branch: `phase-18-host-redirect-policy`
- Merge commit: `ad05abbd Merge phases 32-39 into phase-18-host-redirect-policy`
- Chain commits:
  - `a96f89d7 Extract StudioModelStep component from UnifiedStudio (phase 32)`
  - `b8bb8541 Fix placeholder text to match original exactly (phase 32 correction)`
  - `527bff2b Add Rule 9 compliant explanations to eslint-disable comments in UnifiedStudio (phase 33)`
  - `f8730302 Remove dead imports from UnifiedStudio and add smoke tests (phase 34)`
  - `2c404899 Remove pollWorkflow dead import missed in phase 34`
  - `e810ff34 Extract StudioHeader component from UnifiedStudio (phase 35)`
  - `ed68492a Extract useStudioOnboarding hook from UnifiedStudio (phase 36)`
  - `a2916128 Extract StudioUploadStep component from UnifiedStudio (phase 37)`
  - `87a2bc05 Rename AlternateUploadStep to StudioVaultUploadStep (phase 38)`
  - `fa48bb69 Rename isAltUploadLayoutEnabled to isVaultUploadLayoutEnabled (phase 39)`
- Base: `phase-18-host-redirect-policy`
- Pushed to remote.
- Files changed:
  - `src/pages/UnifiedStudio.tsx` (line count now 634; down from 1332 at the start of the split)
  - `src/components/studio/StudioHeader.tsx`
  - `src/components/studio/StudioModelStep.tsx`
  - `src/components/studio/StudioUploadStep.tsx`
  - `src/components/studio/StudioVaultUploadStep.tsx`
  - `src/hooks/useStudioOnboarding.ts`
- Verified:
  - `npx vitest run` -- 21 files, 200 tests passed.
  - `npm run build` -- clean, built successfully.
  - `git diff --check HEAD` -- clean.
  - No conflict markers in `src/pages/UnifiedStudio.tsx` or `src/components/studio/StudioUploadStep.tsx`.

Phase 39 behavior: no intended visual or functional changes. Structural extraction and naming cleanup only.

Phase 31 was also completed before the phase 32-39 chain merge.

Current dirty local files expected:

- `CLAUDE.md`
- `.claude/`
- `AGENTS.md`
- `docs/STABILIZATION_CONTINUATION.md`

These are local docs/tooling/handoff files and should not be included in phase implementation commits unless the user explicitly requests it.

## Phase Branch / PR Workflow

Use this workflow for any new stabilization changes after phase 18.

1. Start from the latest intended base branch for the work.
   - If the work builds on the combined stabilization stack, branch from `phase-18-host-redirect-policy`.
   - If the work builds on a newer phase that has not merged yet, use that phase branch as the PR base.
2. Create a new phase branch for each scoped change:
   - Branch name format: `phase-N-short-purpose`.
   - Example: `phase-19-cad-webgl-error-boundary`.
3. Keep each phase branch scoped to one behavior change.
   - Do not pile deferred refactors directly into `phase-18-host-redirect-policy`.
   - Do not mix Azure cleanup, feature flags, polling/auth/credits, CAD UI polish, or docs/tooling changes unless the phase explicitly owns that scope.
4. Commit only files that belong to that phase.
   - Use path-limited `git add`.
   - Check `git diff --cached --name-only` before commit.
   - Leave `.claude/`, `AGENTS.md`, `CLAUDE.md`, and this continuation doc uncommitted unless explicitly requested.
5. Verify before commit or PR:
   - Run the focused test for the changed behavior when one exists.
   - Run `npm run build`.
6. Open a PR for the phase branch.
   - Base should be the branch the phase builds on.
   - Head should be the new phase branch.
   - PR body should state scope, verification, and what areas were intentionally not changed.
7. Do not merge PRs from an agent session unless explicitly requested.
8. After Codex verifies and approves a phase, Codex updates this continuation document locally with the reviewed phase status.
   - Do not ask Claude to commit this continuation document as part of scoped implementation PRs.
   - Only update `AI_RULES.md` when a permanent engineering rule is intentionally added or changed.

## Current Next Step

Do not start broad refactors.

UnifiedStudio split is complete. Immediate next steps:

1. Keep PR #16 open until runtime QA passes.
2. Do not merge PR #16 to `main` until staging runtime QA is complete.
3. If QA fails, fix only the failing behavior on a scoped branch or directly as instructed by the user.

## Staging Setup Plan

Short-term frontend staging:

1. Create DNS:
   - `staging.formanova.ai` -> same server IP as production.
2. Clone the frontend separately on the server:
   - `/home/hassan/formanova-frontend-staging`
3. Checkout:
   - `phase-18-host-redirect-policy`
4. Build with:
   - `VITE_PUBLIC_SITE_URL=https://staging.formanova.ai`
   - `VITE_ALLOWED_HOSTS=staging.formanova.ai`
   - `VITE_POSTHOG_API_HOST=https://relay.formanova.ai`
5. Add an nginx server block for `staging.formanova.ai` serving that staging `dist` folder.
6. Proxy `/api`, `/auth`, `/history`, `/billing`, and `/data` to the existing backend ports short-term.

If staging proxies to production backend services, this is frontend-staging only. Use internal test accounts because generations, credits, uploads, and history may still affect production backend data.

Long-term proper staging needs separate backend services, database, storage, and auth config.

## Runtime QA Checklist

- Login/logout works.
- Staging does not redirect to production.
- `/api/models` loads.
- `/api/inspirations` loads.
- On-model generation works.
- Product-shot generation works.
- CAD generation completes and GLB loads. Pending or waiting for backend confirmation in the latest manual QA notes.
- CAD edit succeeds and updated GLB loads. Pending or waiting for backend confirmation in the latest manual QA notes.
- CAD weight estimate works and remains free. Pending or waiting for backend confirmation in the latest manual QA notes.
- CAD STL export works and remains free. Pending or waiting for backend confirmation in the latest manual QA notes.
- Credits preflight and balance refresh work.
- Generation history loads photo/product-shot/CAD results.
- Auth expiry behavior works if practical to test.
- PostHog host uses staging env or production fallback knowingly.

## UnifiedStudio Split Progress

The split is proceeding one component at a time on the `phase-18-host-redirect-policy` base. Each phase is zero visual/functional change -- pure extraction.

Completed extractions:

- Phase 28: `src/lib/studio-examples.ts` -- 30 image asset imports + `CATEGORY_EXAMPLES`, `ACCEPTABLE_EXAMPLES`, `LABEL_NAMES` maps.
- Phase 29: `src/components/studio/StudioGeneratingStep.tsx` -- pure render component for the generating step. `src/components/studio/StudioResultsStep.tsx` -- pure render component for the results step.
- Phase 30: `src/hooks/useStudioUpload.ts` -- async upload flows for jewelry and model images. All state kept inline in UnifiedStudio to avoid TDZ in production bundle.
- Phase 31: `src/components/studio/StudioUploadStep.tsx` -- Step 1 upload zone + flagged-image Dialog. Branch: `phase-31-studio-upload-step`. Merged as PR #31.
- Phase 32: `src/components/studio/StudioModelStep.tsx` -- Step 2 model/inspiration selection block. Branch: `phase-32-studio-model-step`. Merged as PR #30.
- Phase 35: `src/components/studio/StudioHeader.tsx` -- mode switcher and step progress header.
- Phase 36: `src/hooks/useStudioOnboarding.ts` -- onboarding/guide modal state and persistence.
- Phase 37: `src/components/studio/StudioUploadStep.tsx` -- reconciled upload-step extraction in the phase 32-39 branch chain.
- Phase 38: `src/components/studio/StudioVaultUploadStep.tsx` -- renamed alternate upload step to match product terminology.
- Phase 39: `isVaultUploadLayoutEnabled` naming cleanup.

TDZ rule (must not regress): any state setter referenced by a `useEffect` with `[]` deps MUST be declared as inline `useState` in UnifiedStudio before that effect -- never inside a hook called later in the body.

UnifiedStudio split is complete. Remaining in UnifiedStudio by design:

- All state declarations (TDZ rule).
- Session persistence helpers (`loadStudioSession`, `saveStudioSession`, `clearStudioSession`).
- All `useEffect`s and `useCallback`s.
- Inline handlers (`handleNextStep`, `handleContinueAnyway`, `handleStartOver`).
- Bottom modal renders (`UploadGuideModal`, `ModelGuideModal`, `ProductShotGuideModal`, `StudioTestMenu`).
- Current `src/pages/UnifiedStudio.tsx` line count: 634.

## AI_RULES Follow-up Check

No `AI_RULES.md` changes are needed from the phase 32-39 merge.

Quick scan after the merge found no obvious new rule work introduced by phases 32-39. Remaining raw `fetch` and hardcoded production URL matches in `src` are in allowed or non-runtime categories:

- `authenticatedFetch` internals.
- Auth bootstrap calls under `/auth`.
- Static `/version.json` polling.
- Public/legal/SEO URLs.
- Asset/blob/data conversion and direct GLB/STL asset downloads with auth fallback where needed.
- Tests.

The pre-existing `src/lib/pipeline-api.ts` drift was fixed after the phase 32-39 merge: it now uses `authenticatedFetch`, preserves `X-Admin-Secret` for admin calls, and no longer manually attaches bearer tokens. Focused coverage was added in `src/lib/pipeline-api.test.ts`.

Continue to treat the runtime QA checklist as the blocker before merging PR #16 to `main`.

## Known Deferred Work

None. UnifiedStudio split is complete.

## Rules For Future Sessions

- Read `AI_RULES.md` first.
- Read `docs/STABILIZATION_CONTINUATION.md` second.
- Do not refactor before staging QA.
- Do not merge to main/prod until runtime QA passes.
- If QA fails, fix only the failing behavior.
- Do not include `.claude/`.
- Use the phase branch / PR workflow above for new changes.
