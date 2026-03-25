# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Development server on port 8080
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build
npx vitest run     # Run all tests
npx vitest run src/path/to/test.test.ts  # Run single test file
```

## Environment Variables

Required in `.env`:
```
VITE_PIPELINE_API_URL=
VITE_PIPELINE_API_KEY=
VITE_PIPELINE_ADMIN_SECRET=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ADMIN_EMAILS=   # Comma-separated list of admin emails
```

## Architecture Overview

**FormaNova** is a React + TypeScript SPA for AI-powered jewelry image processing and 3D CAD generation.

### Provider Stack

`App.tsx` wraps the app in: `QueryClient → ThemeProvider → AuthProvider → CreditsProvider`

All pages are lazy-loaded (`React.lazy()`). Route guards:
- `ProtectedRoute` — requires authenticated user + valid token
- `AdminRouteGuard` — requires email in `VITE_ADMIN_EMAILS`
- `CADGate` — feature gate for CAD routes (currently always passes)

### State Management

Three Context API providers (no Redux/Zustand):

1. **AuthContext** (`src/contexts/AuthContext.tsx`) — User auth state, Google OAuth flow, token storage in localStorage (`formanova_auth_token`, `formanova_auth_user`). Cross-tab sync via storage events.
2. **ThemeContext** (`src/contexts/ThemeContext.tsx`) — One of 12 themes (light, dark, neon, nostalgia, cutie, cyberpunk, retro, vintage, fashion, kawaii, luxury, synthwave), persisted to localStorage.
3. **CreditsContext** (`src/contexts/CreditsContext.tsx`) — Credit balance, `canAfford(toolName)`, `getToolCost(toolName)`. Tool costs defined in `src/lib/credits-api.ts`.

TanStack Query is used for server state (admin components, generation workflows).

### API Layer

`src/lib/authenticated-fetch.ts` — All authenticated API calls go through this. On 401, it clears localStorage, dispatches an auth state change event, and redirects to `/login?redirect=<current_path>`.

Backend calls route through **18 Supabase Edge Functions** in `supabase/functions/` (auth-proxy, credits-proxy, checkout-proxy, workflow-proxy, pipeline-api, azure-upload, etc.). These proxy to the Python API server.

### CAD Module Boundaries (enforced by Cursor rules)

Three separate CAD features with strict import boundaries:
- **Text-to-CAD**: `src/components/text-to-cad/` + `src/pages/TextToCAD.tsx`
- **CAD Studio**: `src/components/cad/` + `src/pages/CADStudio.tsx`
- **CAD-to-Catalog**: `src/pages/CADToCatalog.tsx`

**Protected files — do not modify:**
- `src/components/text-to-cad/CADCanvas.tsx` — 3D canvas, GLB loading, mesh selection
- `src/components/cad-studio/materials.ts` — Material definitions (sealed constants)

**Rule:** Non-CAD features must not import from CAD component folders. Shared utilities must live in `src/lib/`.

### Styling

Tailwind CSS with `class`-based dark mode. Custom fonts: Bebas Neue (display), Inter (body), Space Mono (mono). Custom color tokens: `formanova-glow`, `formanova-success`, `formanova-warning`, `formanova-hero-accent`.

TypeScript is configured loosely (`noImplicitAny: false`, `strictNullChecks: false`). Path alias: `@/*` → `./src/*`.

### Feature Flags

`src/lib/feature-flags.ts` controls per-email feature access:
- `isCADEnabled(email)` — always `true`
- `CAD_EDIT_TOOLS_ENABLED` — `false` (Edit/Rebuild tools hidden)
- `CAD_MODEL_SELECTOR_ENABLED` — `false` (model quality selector hidden)
- `isWeightStlEnabled(email)` / `isCadUploadEnabled(email)` — small allow lists

### PostHog Analytics

**Architecture: single-file event API.** All PostHog events are defined and exported from `src/lib/posthog-events.ts`. Pages and components import from there — never from `posthog-js` directly. An ESLint rule enforces this.

**Identity init — DO NOT REVERT.** `src/main.tsx` calls `posthog.init()` eagerly at startup with a `bootstrap` option:
```ts
posthog.init('phc_...', {
  bootstrap: storedUser ? { distinctId: storedUser.id, isIdentifiedID: true } : undefined,
});
```
This fixes a race condition where returning users appeared as anonymous UUIDs in session replay. The old lazy/deferred init caused the bug. Do not move this call, make it conditional, or switch back to lazy loading.

**`distinctId` is case-sensitive.** The bootstrap and any `posthog.identify()` calls must use `distinctId` (lowercase `d`). `distinctID` silently no-ops.

**Adding a new event:** Add a typed function to `posthog-events.ts`, export its props interface, write a Vitest test in `posthog-events.test.ts` first (TDD), then call it from the component.

**Adding a new page or flow with generation/paywall:**
- Credit gate fails → `trackPaywallHit({ category, steps_completed: N })`
- Generation succeeds → `trackGenerationComplete(...)` or `trackCadGenerationCompleted(...)`
- Download → `trackDownloadClicked({ context, category })`

**`TO_SINGULAR` map** is in `src/lib/jewelry-utils.ts`. All PostHog event `category` values must be singular (`'ring'` not `'rings'`). Use `TO_SINGULAR[jewelryType] ?? jewelryType` wherever `jewelryType` comes from a URL param.

**Tests:** `npx vitest run src/lib/posthog-events.test.ts` — 20 tests covering all event functions and the `__loaded` guard. These must stay green. Do not delete or weaken them.
