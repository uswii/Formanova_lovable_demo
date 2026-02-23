

# Image Performance Optimization Plan

## Current State

The project loads ~30+ high-resolution PNG/JPG images across pages (Welcome hero carousel with 10 images, CinematicShowcase, JewelryShowcase, PhotographyStudioCategories, BeforeAfterShowcase, bulk upload examples, etc.). Currently:

- No `loading="lazy"` on any below-the-fold images
- No `width`/`height` attributes (causes Cumulative Layout Shift)
- No `fetchpriority="high"` on LCP hero images
- No `decoding="async"` on non-critical images
- All images served as original PNG/JPG with no WebP conversion
- No responsive `srcset` -- every device downloads full-resolution images
- No build-time image compression or optimization

## Implementation

### 1. Create a reusable `OptimizedImage` component

A drop-in replacement for `<img>` that enforces best practices:
- `loading="lazy"` by default (overridable for above-the-fold)
- `decoding="async"` by default
- `fetchpriority` prop for LCP images
- Explicit `width`/`height` to prevent CLS
- CSS `aspect-ratio` fallback
- Optional blur-up placeholder via a tiny inline base64

**File**: `src/components/ui/optimized-image.tsx`

### 2. Install `vite-imagetools` for build-time optimization

This Vite plugin generates WebP variants and multiple sizes at build time via import query parameters:

```typescript
import heroImg from '@/assets/jewelry/hero-diamond-choker.png?w=640;1024;1920&format=webp&as=srcset'
```

This produces responsive WebP images with srcset automatically. The component will use `<picture>` with WebP source and original format fallback.

**File**: `vite.config.ts` (add plugin)

### 3. Apply optimizations across all pages/components

For each file with images, replace raw `<img>` tags with `OptimizedImage`, categorized by priority:

**Above-the-fold (eager loading, high priority)**:
- `CinematicHero.tsx` -- hero carousel images (first image eager, rest lazy-preload)
- `Header.tsx` -- logo image (already has some optimization)

**Below-the-fold (lazy loading)**:
- `CinematicShowcase.tsx` -- showcase images
- `JewelryShowcase.tsx` -- model images and metrics
- `BeforeAfterShowcase.tsx` -- before/after slider images
- `PhotographyStudioCategories.tsx` -- category grid images
- `ImageUploadCard.tsx` -- user-uploaded previews
- `StepUploadMark.tsx` -- example images
- `UploadGuideBillboard.tsx` -- guide images
- Bulk upload components -- inspiration/upload previews

### 4. Preload critical hero image

Add a `<link rel="preload">` for the first hero image in `index.html` to eliminate LCP delay, and use `fetchpriority="high"` on the active hero image in `CinematicHero`.

### 5. Add caching headers via Vite config

Vite already hashes static assets in production builds (e.g., `hero-diamond-choker-abc123.png`), enabling aggressive caching. We will verify the build output includes proper `Cache-Control` headers. For the Lovable preview/published URLs, caching is handled by the platform CDN.

## Technical Details

### OptimizedImage component API

```typescript
interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  priority?: boolean;       // true = eager load + high fetchpriority
  aspectRatio?: string;     // e.g. "3/4", "16/9" for CLS prevention
  sizes?: string;           // responsive sizes attribute
}
```

### Files to modify

| File | Change |
|------|--------|
| `vite.config.ts` | Add `vite-imagetools` plugin |
| `src/components/ui/optimized-image.tsx` | New component |
| `src/components/CinematicHero.tsx` | Use OptimizedImage with priority for active slide |
| `src/components/CinematicShowcase.tsx` | Lazy load showcase images |
| `src/components/JewelryShowcase.tsx` | Lazy load model images |
| `src/components/BeforeAfterShowcase.tsx` | Lazy load slider images |
| `src/pages/PhotographyStudioCategories.tsx` | Lazy load category images |
| `src/components/bulk/ImageUploadCard.tsx` | Lazy load upload previews |
| `src/components/bulk/UploadGuideBillboard.tsx` | Lazy load guide images |
| `src/components/bulk/InspirationUpload.tsx` | Lazy load inspiration images |
| `src/components/bulk/InspirationModal.tsx` | Lazy load modal images |
| `src/pages/Welcome.tsx` | No img tags directly (delegates to components) |
| `src/components/layout/Header.tsx` | Already partially optimized, minor improvements |
| `index.html` | Add preload link for first hero image |

### Expected improvements

- **LCP**: 30-50% faster via preloading, priority hints, and WebP format
- **CLS**: Near-zero via explicit dimensions and aspect ratios
- **Total page weight**: 40-60% reduction via WebP conversion and responsive srcset
- **Below-fold images**: Zero impact on initial load via native lazy loading

