/**
 * AlternateUploadStep — internal experiment (gated via feature flag).
 *
 * Two-column layout:
 *   Left  (2/3) — upload canvas. Guide examples are embedded as a
 *                 very low-opacity watermark mosaic in the background.
 *                 The Drag & Drop CTA is the dominant foreground element.
 *   Right (1/3) — My Products library: 3-column grid, max 10 items,
 *                 each numbered sequentially.
 *
 * No backend logic, validation, or workflow changes.
 */

import React from 'react';
import { Check, X, Upload, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserAssets } from '@/hooks/useUserAssets';
import type { ImageValidationResult } from '@/hooks/use-image-validation';

// ── Example images ────────────────────────────────────────────────────────────
import necklaceAllowed1   from '@/assets/examples/necklace-allowed-1.jpg';
import necklaceAllowed2   from '@/assets/examples/necklace-allowed-2.jpg';
import necklaceAllowed3   from '@/assets/examples/necklace-allowed-3.jpg';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.png';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.png';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.png';
import earringAllowed1    from '@/assets/examples/earring-allowed-1.jpg';
import earringAllowed2    from '@/assets/examples/earring-allowed-2.jpg';
import earringAllowed3    from '@/assets/examples/earring-allowed-3.jpg';
import earringNotAllowed1  from '@/assets/examples/earring-notallowed-1.png';
import earringNotAllowed2  from '@/assets/examples/earring-notallowed-2.png';
import earringNotAllowed3  from '@/assets/examples/earring-notallowed-3.png';
import braceletAllowed1   from '@/assets/examples/bracelet-allowed-1.jpg';
import braceletAllowed2   from '@/assets/examples/bracelet-allowed-2.jpg';
import braceletAllowed3   from '@/assets/examples/bracelet-allowed-3.jpg';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.png';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.png';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.png';
import ringAllowed1       from '@/assets/examples/ring-allowed-1.png';
import ringAllowed2       from '@/assets/examples/ring-allowed-2.png';
import ringAllowed3       from '@/assets/examples/ring-allowed-3.jpg';
import ringNotAllowed1     from '@/assets/examples/ring-notallowed-1.png';
import ringNotAllowed2     from '@/assets/examples/ring-notallowed-2.png';
import ringNotAllowed3     from '@/assets/examples/ring-notallowed-3.png';
import watchAllowed1      from '@/assets/examples/watch-allowed-1.jpg';
import watchAllowed2      from '@/assets/examples/watch-allowed-2.jpg';
import watchAllowed3      from '@/assets/examples/watch-allowed-3.png';
import watchNotAllowed1    from '@/assets/examples/watch-notallowed-1.png';
import watchNotAllowed2    from '@/assets/examples/watch-notallowed-2.png';
import watchNotAllowed3    from '@/assets/examples/watch-notallowed-3.png';

const CATEGORY_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace:  { allowed: [necklaceAllowed1, necklaceAllowed2, necklaceAllowed3],    notAllowed: [necklaceNotAllowed1, necklaceNotAllowed2, necklaceNotAllowed3] },
  earrings:  { allowed: [earringAllowed1, earringAllowed2, earringAllowed3],        notAllowed: [earringNotAllowed1, earringNotAllowed2, earringNotAllowed3] },
  bracelets: { allowed: [braceletAllowed1, braceletAllowed2, braceletAllowed3],    notAllowed: [braceletNotAllowed1, braceletNotAllowed2, braceletNotAllowed3] },
  rings:     { allowed: [ringAllowed1, ringAllowed2, ringAllowed3],                notAllowed: [ringNotAllowed1, ringNotAllowed2, ringNotAllowed3] },
  watches:   { allowed: [watchAllowed1, watchAllowed2, watchAllowed3],             notAllowed: [watchNotAllowed1, watchNotAllowed2, watchNotAllowed3] },
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
}: AlternateUploadStepProps) {
  const examples = CATEGORY_EXAMPLES[exampleCategoryType] ?? CATEGORY_EXAMPLES['necklace'];

  // My Products: same API + hook as the Dashboard vault. Limit to 10.
  const { assets, isLoading, error } = useUserAssets('jewelry_photo', 10);
  const products = assets.slice(0, 10);

  // ── Canvas height token — shared by both columns ───────────────────
  // Both the canvas and the product grid are constrained to this height
  // so their top and bottom edges align exactly.
  const CANVAS_H = 'h-[480px] md:h-[540px]';

  return (
    /*
     * Outer layout: headers inside each column so they sit on the
     * same horizontal axis. items-start so columns don't stretch each
     * other beyond their natural content height.
     */
    <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">

      {/* ══════════════════════════════════════════════════════════════
          LEFT — Upload Canvas  (2 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-2 flex flex-col gap-4">

        {/* Column header */}
        <div>
          <span className="marta-label block mb-1">Step 1</span>
          <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">
            Upload Your Jewelry
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Upload a photo worn on a person or mannequin
          </p>
        </div>

        {/* ── Canvas ── */}
        <div className={`relative border border-border/30 overflow-hidden ${CANVAS_H}`}>

          {/* ── WATERMARK BACKGROUND (empty state only) ────────────── */}
          {!jewelryImage && (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex flex-col"
              style={{ zIndex: 0 }}
            >
              {/*
               * Two equal rows: top = accepted, bottom = not accepted.
               * Images are grayscale + very low opacity → neutral watermark.
               * Each cell has overflow-hidden so nothing escapes its bounds.
               * Check / X badges sit on top of the image at higher opacity
               * so they remain clearly legible.
               */}

              {/* Row 1 — Accepted */}
              <div className="flex-1 grid grid-cols-3 relative min-h-0">
                {/* Row label */}
                <span className="absolute top-2 left-2 z-10 font-mono text-[8px] tracking-[0.25em] uppercase
                                  text-foreground/30 pointer-events-none select-none">
                  Accepted
                </span>
                {examples.allowed.map((src, i) => (
                  <div
                    key={`ok-${i}`}
                    className="relative overflow-hidden border-r border-border/10 last:border-r-0"
                  >
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-cover grayscale opacity-[0.12]"
                    />
                    {/* Accepted badge — full opacity so user can read it clearly */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1
                                    bg-background/80 border border-green-500/40 px-1.5 py-0.5">
                      <Check className="w-2.5 h-2.5 text-green-500 flex-shrink-0" strokeWidth={2.5} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Row divider */}
              <div className="h-px bg-border/15 flex-shrink-0" />

              {/* Row 2 — Not Accepted */}
              <div className="flex-1 grid grid-cols-3 relative min-h-0">
                <span className="absolute top-2 left-2 z-10 font-mono text-[8px] tracking-[0.25em] uppercase
                                  text-foreground/30 pointer-events-none select-none">
                  Not Accepted
                </span>
                {examples.notAllowed.map((src, i) => (
                  <div
                    key={`no-${i}`}
                    className="relative overflow-hidden border-r border-border/10 last:border-r-0"
                  >
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-cover grayscale opacity-[0.10]"
                    />
                    {/* Not-accepted badge */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1
                                    bg-background/80 border border-destructive/40 px-1.5 py-0.5">
                      <X className="w-2.5 h-2.5 text-destructive flex-shrink-0" strokeWidth={2.5} />
                    </div>
                  </div>
                ))}
              </div>

              {/*
               * Radial vignette — keeps the very centre open and clear
               * for the Drag & Drop CTA which is the primary action.
               */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 55% 55% at 50% 50%, hsl(var(--background)/0.72) 0%, transparent 100%)',
                }}
              />
            </div>
          )}

          {/* ── FOREGROUND — drop zone (empty state) ────────────────── */}
          {!jewelryImage && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              style={{ zIndex: 10 }}
              onClick={() => jewelryInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileUpload(f); }}
              onDragOver={(e) => e.preventDefault()}
            >
              {/*
               * CTA block — intentionally NO frosted backdrop so the
               * watermark examples stay perceptible behind it.
               * Typography carries the visual weight.
               */}
              <div className="flex flex-col items-center text-center px-8 select-none">

                {/* Upload icon — minimal outline */}
                <div className="mb-5 w-12 h-12 flex items-center justify-center border border-foreground/20">
                  <Upload className="h-5 w-5 text-foreground/60" strokeWidth={1.5} />
                </div>

                {/* Primary CTA — dominant typographic element */}
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

          {/* ── FOREGROUND — image preview (uploaded state) ──────────── */}
          {jewelryImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <img
                src={jewelryImage}
                alt="Jewelry"
                className="max-w-full max-h-full object-contain"
              />

              {/* Remove */}
              <button
                onClick={onClearImage}
                className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm
                           flex items-center justify-center border border-border/40
                           hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Validation badge */}
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

          {/* Hidden file input */}
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
                         text-background hover:opacity-90 transition-opacity border-0
                         disabled:opacity-60"
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

        {/* Column header — same typographic system, same vertical position */}
        <div>
          <span className="marta-label block mb-1">Library</span>
          <h3 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">
            My Products
          </h3>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Previously uploaded jewelry
          </p>
        </div>

        {/*
         * Product grid — constrained to the same height token as the canvas
         * so the bottom edges of both columns stay aligned.
         * Overflow scrolls internally without pushing column height.
         */}
        <div className={`overflow-y-auto ${CANVAS_H}`}>

          {/* Loading skeleton — same 3-col grid as content */}
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

          {!isLoading && !error && products.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center
                            border border-dashed border-border/25 h-full px-6 py-10">
              <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground/60 uppercase">
                No products yet
              </p>
            </div>
          )}

          {!isLoading && !error && products.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {products.map((asset, index) => (
                <div
                  key={asset.id}
                  className="relative aspect-square overflow-hidden border border-border/20 bg-muted/10
                             group"
                >
                  <img
                    src={asset.thumbnail_url}
                    alt={asset.name ?? `Product ${index + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Sequential index badge */}
                  <span
                    className="absolute bottom-1 left-1 font-mono text-[8px] leading-none
                               bg-background/80 text-foreground/70 px-1 py-0.5 tabular-nums"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
