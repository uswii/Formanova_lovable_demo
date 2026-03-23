/**
 * AlternateUploadStep — internal experiment (uswa@raresense.so only).
 *
 * Two-column layout for Step 1 of UnifiedStudio:
 *   Left  (2/3) — upload canvas with ambient guide-image background
 *   Right (1/3) — My Products library (same data as Dashboard vault)
 *
 * All upload behaviour, validation, and state are unchanged — this file
 * only restructures the visual presentation.
 */

import React from 'react';
import {
  Check,
  Diamond,
  Image as ImageIcon,
  Loader2,
  X,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserAssets } from '@/hooks/useUserAssets';
import type { ImageValidationResult } from '@/hooks/use-image-validation';
import type { StudioStep } from '@/pages/UnifiedStudio';

// ── Example images ────────────────────────────────────────────────────────────
import necklaceAllowed1 from '@/assets/examples/necklace-allowed-1.jpg';
import necklaceAllowed2 from '@/assets/examples/necklace-allowed-2.jpg';
import necklaceAllowed3 from '@/assets/examples/necklace-allowed-3.jpg';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.png';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.png';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.png';
import earringAllowed1 from '@/assets/examples/earring-allowed-1.jpg';
import earringAllowed2 from '@/assets/examples/earring-allowed-2.jpg';
import earringAllowed3 from '@/assets/examples/earring-allowed-3.jpg';
import earringNotAllowed1 from '@/assets/examples/earring-notallowed-1.png';
import earringNotAllowed2 from '@/assets/examples/earring-notallowed-2.png';
import earringNotAllowed3 from '@/assets/examples/earring-notallowed-3.png';
import braceletAllowed1 from '@/assets/examples/bracelet-allowed-1.jpg';
import braceletAllowed2 from '@/assets/examples/bracelet-allowed-2.jpg';
import braceletAllowed3 from '@/assets/examples/bracelet-allowed-3.jpg';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.png';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.png';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.png';
import ringAllowed1 from '@/assets/examples/ring-allowed-1.png';
import ringAllowed2 from '@/assets/examples/ring-allowed-2.png';
import ringAllowed3 from '@/assets/examples/ring-allowed-3.jpg';
import ringNotAllowed1 from '@/assets/examples/ring-notallowed-1.png';
import ringNotAllowed2 from '@/assets/examples/ring-notallowed-2.png';
import ringNotAllowed3 from '@/assets/examples/ring-notallowed-3.png';
import watchAllowed1 from '@/assets/examples/watch-allowed-1.jpg';
import watchAllowed2 from '@/assets/examples/watch-allowed-2.jpg';
import watchAllowed3 from '@/assets/examples/watch-allowed-3.png';
import watchNotAllowed1 from '@/assets/examples/watch-notallowed-1.png';
import watchNotAllowed2 from '@/assets/examples/watch-notallowed-2.png';
import watchNotAllowed3 from '@/assets/examples/watch-notallowed-3.png';

const CATEGORY_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace:  { allowed: [necklaceAllowed1, necklaceAllowed2, necklaceAllowed3],   notAllowed: [necklaceNotAllowed1, necklaceNotAllowed2, necklaceNotAllowed3] },
  earrings:  { allowed: [earringAllowed1, earringAllowed2, earringAllowed3],       notAllowed: [earringNotAllowed1, earringNotAllowed2, earringNotAllowed3] },
  bracelets: { allowed: [braceletAllowed1, braceletAllowed2, braceletAllowed3],   notAllowed: [braceletNotAllowed1, braceletNotAllowed2, braceletNotAllowed3] },
  rings:     { allowed: [ringAllowed1, ringAllowed2, ringAllowed3],               notAllowed: [ringNotAllowed1, ringNotAllowed2, ringNotAllowed3] },
  watches:   { allowed: [watchAllowed1, watchAllowed2, watchAllowed3],            notAllowed: [watchNotAllowed1, watchNotAllowed2, watchNotAllowed3] },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AlternateUploadStepProps {
  jewelryType: string;
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
  const { assets, isLoading, error } = useUserAssets('jewelry_photo', 24);

  return (
    /*
     * Outer grid — 3 columns (canvas 2/3, library 1/3).
     * items-stretch ensures both columns share identical top + bottom edges.
     * On small screens the columns stack.
     */
    <div className="grid lg:grid-cols-3 gap-6 lg:gap-10 items-stretch">

      {/* ══════════════════════════════════════════════════════════════
          LEFT COLUMN — Upload Canvas  (2 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-2 flex flex-col">

        {/* Section header — mirrors the right-column header typographically */}
        <div className="mb-4 flex-shrink-0">
          <span className="marta-label block mb-1">Step 1</span>
          <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">
            Upload Your Jewelry
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Upload a photo of your jewelry{' '}
            <strong>worn on a person or mannequin</strong>
          </p>
        </div>

        {/* Canvas — flex-1 so it stretches to fill remaining column height */}
        <div className="flex-1 relative border border-dashed border-border/40 overflow-hidden min-h-[460px] md:min-h-[580px]">

          {/* ── AMBIENT BACKGROUND — guide mosaic (empty state only) ── */}
          {!jewelryImage && (
            <div
              aria-hidden="true"
              className="absolute inset-0 grid grid-rows-2"
              style={{ zIndex: 0 }}
            >
              {/* Row 1 — Accepted */}
              <div className="grid grid-cols-3 relative">
                {/* Row label */}
                <span
                  className="absolute top-2 left-2 z-10 font-mono text-[8px] tracking-[0.2em] uppercase
                             px-1.5 py-0.5 bg-background/50 text-foreground/40 pointer-events-none"
                >
                  Accepted
                </span>
                {examples.allowed.map((src, i) => (
                  <div key={`ok-${i}`} className="relative overflow-hidden">
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover opacity-[0.18]"
                      draggable={false}
                    />
                    {/* Indicator — higher opacity than image to stay legible */}
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-green-500
                                    flex items-center justify-center opacity-50 pointer-events-none">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    {/* Hairline separator between cells */}
                    {i < 2 && (
                      <div className="absolute inset-y-0 right-0 w-px bg-border/10 pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>

              {/* Row divider */}
              <div className="absolute left-0 right-0 h-px bg-border/10 pointer-events-none"
                   style={{ top: '50%' }} />

              {/* Row 2 — Not Accepted */}
              <div className="grid grid-cols-3 relative">
                <span
                  className="absolute top-2 left-2 z-10 font-mono text-[8px] tracking-[0.2em] uppercase
                             px-1.5 py-0.5 bg-background/50 text-foreground/40 pointer-events-none"
                >
                  Not Accepted
                </span>
                {examples.notAllowed.map((src, i) => (
                  <div key={`no-${i}`} className="relative overflow-hidden">
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover opacity-[0.13]"
                      draggable={false}
                    />
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-destructive
                                    flex items-center justify-center opacity-50 pointer-events-none">
                      <X className="w-3 h-3 text-white" />
                    </div>
                    {i < 2 && (
                      <div className="absolute inset-y-0 right-0 w-px bg-border/10 pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── FOREGROUND — empty state drop zone ── */}
          {!jewelryImage && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              style={{ zIndex: 10 }}
              onClick={() => jewelryInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileUpload(f); }}
              onDragOver={(e) => e.preventDefault()}
            >
              {/*
               * Frosted panel — gives foreground elements strong contrast
               * against the ambient imagery behind them.
               */}
              <div className="flex flex-col items-center text-center
                              bg-background/70 backdrop-blur-[3px]
                              border border-border/25
                              px-10 py-9 mx-6">

                {/* Pulsing diamond icon */}
                <div className="relative w-20 h-20 mb-6 flex-shrink-0">
                  <div
                    className="absolute inset-0 rounded-full bg-primary/10 animate-ping"
                    style={{ animationDuration: '2.5s' }}
                  />
                  <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                    <Diamond className="h-9 w-9 text-primary" />
                  </div>
                </div>

                <p className="text-lg font-display font-medium mb-1.5">
                  Drop your jewelry image here
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Drag &amp; drop · click to browse · paste (Ctrl+V)
                </p>

                <Button variant="outline" size="lg" className="gap-2 pointer-events-none">
                  <ImageIcon className="h-4 w-4" />
                  Browse Files
                </Button>
              </div>
            </div>
          )}

          {/* ── FOREGROUND — uploaded image preview ── */}
          {jewelryImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <img
                src={jewelryImage}
                alt="Jewelry"
                className="max-w-full max-h-[540px] object-contain"
              />

              {/* Remove button */}
              <button
                onClick={onClearImage}
                className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm
                           flex items-center justify-center border border-border/40
                           hover:bg-destructive hover:text-destructive-foreground transition-colors z-10 rounded-sm"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Validation badge */}
              {isValidating && (
                <div className="absolute top-3 left-3 bg-muted/90 backdrop-blur-sm px-2.5 py-1
                                flex items-center gap-1.5 rounded-sm">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                    Validating…
                  </span>
                </div>
              )}
              {!isValidating && validationResult && !isFlagged && (
                <div className="absolute top-3 left-3 backdrop-blur-sm px-2.5 py-1
                                flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-sm">
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

        {/* Next button — appears below canvas after image is loaded */}
        {jewelryImage && (
          <div className="flex items-center justify-end gap-3 pt-4 flex-shrink-0">
            <Button
              size="lg"
              onClick={onNextStep}
              disabled={!canProceed}
              className="gap-2.5 font-display text-base uppercase tracking-wide px-10
                         bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))]
                         text-background hover:opacity-90 transition-opacity border-0
                         disabled:opacity-60 disabled:from-[hsl(var(--formanova-hero-accent))] disabled:to-[hsl(var(--formanova-glow))]"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating…
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          RIGHT COLUMN — My Products Library  (1 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col">

        {/*
         * Header — same typographic system as the left-column header.
         * Sits at the top of the right column, horizontally aligned with
         * "Step 1 / Upload Your Jewelry" on the left.
         */}
        <div className="mb-4 flex-shrink-0">
          <span className="marta-label block mb-1">Library</span>
          <h3 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">
            My Products
          </h3>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Previously uploaded jewelry
          </p>
        </div>

        {/*
         * Grid container — flex-1 + overflow-y-auto ensures the grid height
         * exactly matches whatever height the left canvas occupies, keeping
         * the two-column bottom edge perfectly aligned.
         */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <p className="text-sm text-destructive py-8 text-center">{error}</p>
          )}

          {!isLoading && !error && assets.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center
                            border border-dashed border-border/30 h-full min-h-[200px] px-6 py-10">
              <p className="text-sm text-muted-foreground max-w-[24ch]">
                No jewelry photos yet. Upload a product to build your library.
              </p>
            </div>
          )}

          {!isLoading && !error && assets.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pb-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="aspect-square overflow-hidden border border-border/20 bg-muted/10"
                >
                  <img
                    src={asset.thumbnail_url}
                    alt={asset.name ?? 'Product'}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
