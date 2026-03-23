/**
 * AlternateUploadStep — internal experiment (gated via feature flag).
 *
 * Two-column layout:
 *   Left  (2/3) — upload canvas with guide watermark background.
 *   Right (1/3) — My Products library, 10 per page with pagination.
 */

import React from 'react';
import { Check, X, Diamond, ArrowRight, ArrowLeft, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserAssets } from '@/hooks/useUserAssets';
import type { ImageValidationResult } from '@/hooks/use-image-validation';

// ── Example images ────────────────────────────────────────────────────────────
import necklaceAllowed1    from '@/assets/examples/necklace-allowed-1.jpg';
import necklaceAllowed2    from '@/assets/examples/necklace-allowed-2.jpg';
import necklaceAllowed3    from '@/assets/examples/necklace-allowed-3.jpg';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.png';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.png';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.png';
import earringAllowed1     from '@/assets/examples/earring-allowed-1.jpg';
import earringAllowed2     from '@/assets/examples/earring-allowed-2.jpg';
import earringAllowed3     from '@/assets/examples/earring-allowed-3.jpg';
import earringNotAllowed1  from '@/assets/examples/earring-notallowed-1.png';
import earringNotAllowed2  from '@/assets/examples/earring-notallowed-2.png';
import earringNotAllowed3  from '@/assets/examples/earring-notallowed-3.png';
import braceletAllowed1    from '@/assets/examples/bracelet-allowed-1.jpg';
import braceletAllowed2    from '@/assets/examples/bracelet-allowed-2.jpg';
import braceletAllowed3    from '@/assets/examples/bracelet-allowed-3.jpg';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.png';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.png';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.png';
import ringAllowed1        from '@/assets/examples/ring-allowed-1.png';
import ringAllowed2        from '@/assets/examples/ring-allowed-2.png';
import ringAllowed3        from '@/assets/examples/ring-allowed-3.jpg';
import ringNotAllowed1     from '@/assets/examples/ring-notallowed-1.png';
import ringNotAllowed2     from '@/assets/examples/ring-notallowed-2.png';
import ringNotAllowed3     from '@/assets/examples/ring-notallowed-3.png';
import watchAllowed1       from '@/assets/examples/watch-allowed-1.jpg';
import watchAllowed2       from '@/assets/examples/watch-allowed-2.jpg';
import watchAllowed3       from '@/assets/examples/watch-allowed-3.png';
import watchNotAllowed1    from '@/assets/examples/watch-notallowed-1.png';
import watchNotAllowed2    from '@/assets/examples/watch-notallowed-2.png';
import watchNotAllowed3    from '@/assets/examples/watch-notallowed-3.png';

const CATEGORY_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace:  { allowed: [necklaceAllowed1, necklaceAllowed2, necklaceAllowed3],   notAllowed: [necklaceNotAllowed1, necklaceNotAllowed2, necklaceNotAllowed3] },
  earrings:  { allowed: [earringAllowed1,  earringAllowed2,  earringAllowed3],    notAllowed: [earringNotAllowed1,  earringNotAllowed2,  earringNotAllowed3]  },
  bracelets: { allowed: [braceletAllowed1, braceletAllowed2, braceletAllowed3],   notAllowed: [braceletNotAllowed1, braceletNotAllowed2, braceletNotAllowed3] },
  rings:     { allowed: [ringAllowed1,     ringAllowed2,     ringAllowed3],        notAllowed: [ringNotAllowed1,     ringNotAllowed2,     ringNotAllowed3]     },
  watches:   { allowed: [watchAllowed1,    watchAllowed2,    watchAllowed3],       notAllowed: [watchNotAllowed1,    watchNotAllowed2,    watchNotAllowed3]    },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AlternateUploadStepProps {
  exampleCategoryType: string;
  jewelryImage: string | null;
  isValidating: boolean;
  validationResult: ImageValidationResult | null;
  isFlagged: boolean;
  canProceed: boolean;
  jewelryInputRef: React.RefObject<HTMLInputElement>;
  onFileUpload: (file: File) => void;
  onClearImage: () => void;
  onNextStep: () => void;
  /** Called when the user clicks a My Products thumbnail — pre-loads it into the canvas. */
  onProductSelect: (thumbnailUrl: string, assetId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AlternateUploadStep({
  exampleCategoryType,
  jewelryImage,
  isValidating,
  validationResult,
  isFlagged,
  canProceed,
  jewelryInputRef,
  onFileUpload,
  onClearImage,
  onNextStep,
  onProductSelect,
}: AlternateUploadStepProps) {
  const examples = CATEGORY_EXAMPLES[exampleCategoryType] ?? CATEGORY_EXAMPLES['necklace'];

  // My Products — 10 per page, same API + hook as the Dashboard vault
  const PAGE_SIZE = 10;
  const { assets, total, page, isLoading, error, goToPage } = useUserAssets('jewelry_photo', PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Shared canvas height — both columns are locked to this so their bottom
  // edges stay aligned regardless of content.
  const CANVAS_H = 'h-[480px] md:h-[540px]';

  return (
    <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">

      {/* ══════════════════════════════════════════════════════════════
          LEFT — Upload Canvas  (2 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-2 flex flex-col gap-4">

        {/* Header */}
        <div>
          <span className="marta-label block mb-1">Step 1</span>
          <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">
            Upload Your Jewelry
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Upload a photo worn on a person or mannequin
          </p>
        </div>

        {/* Canvas */}
        <div className={`relative border border-border/30 overflow-hidden ${CANVAS_H}`}>

          {/* ── WATERMARK BACKGROUND (empty state only) ── */}
          {!jewelryImage && (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex flex-col"
              style={{ zIndex: 0 }}
            >
              {/* Row 1 — Accepted (top half) */}
              <div className="flex-1 grid grid-cols-3 relative min-h-0">
                <span className="absolute top-2 left-2 z-10 font-mono text-[8px] tracking-[0.25em] uppercase
                                  text-foreground/30 pointer-events-none select-none">
                  Accepted
                </span>
                {examples.allowed.map((src, i) => (
                  <div key={`ok-${i}`} className="relative overflow-hidden border-r border-border/10 last:border-r-0">
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-contain grayscale opacity-[0.15]"
                    />
                    {/* Badge — high contrast so it reads clearly over the dim image */}
                    <div className="absolute top-2 right-2 z-10 bg-background/85 border border-green-500/50
                                    flex items-center justify-center w-5 h-5">
                      <Check className="w-3 h-3 text-green-500" strokeWidth={2.5} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Row divider */}
              <div className="h-px bg-border/15 flex-shrink-0" />

              {/* Row 2 — Not Accepted (bottom half) */}
              <div className="flex-1 grid grid-cols-3 relative min-h-0">
                <span className="absolute top-2 left-2 z-10 font-mono text-[8px] tracking-[0.25em] uppercase
                                  text-foreground/30 pointer-events-none select-none">
                  Not Accepted
                </span>
                {examples.notAllowed.map((src, i) => (
                  <div key={`no-${i}`} className="relative overflow-hidden border-r border-border/10 last:border-r-0">
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-contain grayscale opacity-[0.12]"
                    />
                    <div className="absolute top-2 right-2 z-10 bg-background/85 border border-destructive/50
                                    flex items-center justify-center w-5 h-5">
                      <X className="w-3 h-3 text-destructive" strokeWidth={2.5} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Radial vignette — clears the centre for the CTA */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 55% 55% at 50% 50%, hsl(var(--background)/0.75) 0%, transparent 100%)',
                }}
              />
            </div>
          )}

          {/* ── FOREGROUND — drop zone (empty state) ── */}
          {!jewelryImage && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              style={{ zIndex: 10 }}
              onClick={() => jewelryInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileUpload(f); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center text-center px-8 select-none">

                {/* Original pulsing diamond button */}
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div
                    className="absolute inset-0 rounded-full bg-primary/10 animate-ping"
                    style={{ animationDuration: '2.5s' }}
                  />
                  <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                    <Diamond className="h-9 w-9 text-primary" />
                  </div>
                </div>

                {/* Primary CTA */}
                <p className="font-display text-4xl md:text-5xl uppercase tracking-wide leading-none mb-3 text-foreground">
                  Drag &amp; Drop
                </p>

                <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-6">
                  or click to browse · paste Ctrl+V
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-[10px] tracking-[0.15em] uppercase gap-2 pointer-events-none"
                >
                  Browse Files
                </Button>
              </div>
            </div>
          )}

          {/* ── FOREGROUND — image preview (uploaded state) ── */}
          {jewelryImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <img
                src={jewelryImage}
                alt="Jewelry"
                className="max-w-full max-h-full object-contain"
              />

              <button
                onClick={onClearImage}
                className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm
                           flex items-center justify-center border border-border/40
                           hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {isValidating && (
                <div className="absolute top-3 left-3 bg-muted/90 backdrop-blur-sm px-2.5 py-1
                                flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                    Validating…
                  </span>
                </div>
              )}
              {!isValidating && validationResult && !isFlagged && (
                <div className="absolute top-3 left-3 px-2.5 py-1 flex items-center gap-1.5
                                bg-primary/10 border border-primary/20">
                  <Check className="h-3 w-3 text-primary" />
                  <span className="font-mono text-[9px] tracking-wider uppercase text-primary">
                    Accepted
                  </span>
                </div>
              )}
            </div>
          )}

          <input
            ref={jewelryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileUpload(f); }}
          />
        </div>

        {/* Next button */}
        {jewelryImage && (
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={onNextStep}
              disabled={!canProceed}
              className="gap-2.5 font-display text-base uppercase tracking-wide px-10
                         bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))]
                         text-background hover:opacity-90 transition-opacity border-0 disabled:opacity-60"
            >
              {isValidating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Validating…</>
              ) : (
                <>Next <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          RIGHT — My Products Library  (1 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">

        {/*
         * Header — invisible marta-label spacer keeps "My Products" on the
         * exact same horizontal axis as "Upload Your Jewelry" on the left.
         */}
        <div>
          <span className="marta-label block mb-1 invisible" aria-hidden="true">Step 1</span>
          <h3 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">
            My Products
          </h3>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Previously uploaded jewelry
          </p>
        </div>

        {/* Grid — height-locked to canvas, pagination controls below */}
        <div className="flex flex-col gap-3 flex-1">

          {/* Scrollable grid area — matches canvas height */}
          <div className={`${CANVAS_H} overflow-y-auto`}>

            {isLoading && (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-muted animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && error && (
              <p className="text-sm text-destructive py-6">{error}</p>
            )}

            {!isLoading && !error && assets.length === 0 && (
              <div className="flex items-center justify-center border border-dashed border-border/25
                              h-full text-center px-6">
                <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground/60 uppercase">
                  No products yet
                </p>
              </div>
            )}

            {!isLoading && !error && assets.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onProductSelect(asset.thumbnail_url, asset.id)}
                    className="relative aspect-square overflow-hidden border border-border/20 bg-muted/10
                               group hover:border-foreground/40 transition-colors"
                  >
                    <img
                      src={asset.thumbnail_url}
                      alt={asset.name ?? 'Product'}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Hover overlay — signals selectability */}
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity
                                       font-mono text-[9px] tracking-[0.15em] uppercase text-background
                                       bg-foreground/70 px-2 py-1">
                        Use
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination — only rendered when there is more than one page */}
          {!isLoading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 0}
                className="flex items-center gap-1 font-mono text-[10px] tracking-[0.1em] uppercase
                           text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed
                           transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>

              <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground tabular-nums">
                {page + 1} / {totalPages}
              </span>

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 font-mono text-[10px] tracking-[0.1em] uppercase
                           text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed
                           transition-colors"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
