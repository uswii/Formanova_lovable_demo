import { useState, useEffect, useId, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { checkTosAgreement, signTosAgreement, markTosAgreed } from '@/lib/onboarding-api';
import { useAuth } from '@/contexts/AuthContext';

import ringA1      from '@/assets/examples/ring-allowed-1.webp';
import earringA1   from '@/assets/examples/earring-allowed-1.webp';
import necklaceA1  from '@/assets/examples/necklace-allowed-1.webp';
import braceletA1  from '@/assets/examples/bracelet-allowed-1.webp';
import watchA1     from '@/assets/examples/watch-allowed-1.webp';

import ringN1      from '@/assets/examples/ring-notallowed-1.webp';
import earringN1   from '@/assets/examples/earring-notallowed-1.webp';
import necklaceN1  from '@/assets/examples/necklace-notallowed-1.webp';
import braceletN1  from '@/assets/examples/bracelet-notallowed-1.webp';
import watchN1     from '@/assets/examples/watch-notallowed-1.webp';

import multipleAndPacked from '@/assets/examples/multile-and-packed.webp';
import screenshotExample from '@/assets/examples/screenshot.webp';

import scaleBefore from '@/assets/examples/not_worn_scale_before.webp';
import scaleAfter  from '@/assets/examples/not-wonr-scale-output.webp';

import syntheticBefore  from '@/assets/examples/synthetic-before.webp';
import syntheticAfter   from '@/assets/examples/synthetic-after.webp';
import realisticBefore  from '@/assets/examples/realistic-model-input.webp';
import realisticAfter   from '@/assets/examples/realistic-output.webp';

// ---------------------------------------------------------------------------

const CATEGORIES = ['Ring', 'Earring', 'Necklace', 'Bracelet', 'Watch'];
const DO_IMAGES   = [ringA1, earringA1, necklaceA1, braceletA1, watchA1];
const AVOID_IMAGES = [ringN1, earringN1, necklaceN1, braceletN1, watchN1];

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
        <img src={src} alt="Enlarged view" className="max-h-[85vh] w-auto object-contain" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ClickableImage({
  src, alt, onClick, imgClass = '',
}: {
  src: string; alt: string; onClick: (src: string) => void; imgClass?: string;
}) {
  return (
    <div
      className="overflow-hidden border border-border cursor-pointer"
      onClick={() => onClick(src)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(src); }}
      aria-label={`Enlarge: ${alt}`}
    >
      <img src={src} alt={alt} className={`aspect-square w-full object-cover ${imgClass}`} loading="lazy" />
    </div>
  );
}

function ImageGrid({
  images, onImageClick,
}: {
  images: string[]; onImageClick: (src: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 grid grid-cols-5 gap-2">
        {CATEGORIES.map((cat) => (
          <p key={cat} className="truncate text-center text-[10px] text-muted-foreground">{cat}</p>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {images.map((src, i) => (
          <ClickableImage key={src} src={src} alt={CATEGORIES[i]} onClick={onImageClick} />
        ))}
      </div>
    </div>
  );
}

function BeforeAfterBlock({
  before, after, beforeLabel, afterLabel, note, onImageClick,
}: {
  before: string; after: string;
  beforeLabel: string; afterLabel: string;
  note: string;
  onImageClick: (src: string) => void;
}) {
  return (
    <div className="border border-border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="flex flex-col gap-1">
          <ClickableImage src={before} alt={beforeLabel} onClick={onImageClick} imgClass="object-top" />
          <p className="text-center text-[11px] font-medium text-muted-foreground">{beforeLabel}</p>
        </div>
        <div className="flex flex-col gap-1">
          <ClickableImage src={after} alt={afterLabel} onClick={onImageClick} imgClass="object-top" />
          <p className="text-center text-[11px] font-medium text-muted-foreground">{afterLabel}</p>
        </div>
      </div>
      <p className="mt-3 text-justify text-xs leading-relaxed text-muted-foreground sm:text-sm">{note}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tosCheckboxId = useId();

  const [checking, setChecking]     = useState(true);
  const [agreed, setAgreed]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lightbox, setLightbox]     = useState<string | null>(null);

  const openLightbox = useCallback((src: string) => setLightbox(src), []);

  useEffect(() => {
    checkTosAgreement()
      .then((signed) => {
        if (signed) {
          if (user) markTosAgreed(user.id);
          navigate('/studio', { replace: true });
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [navigate, user]);

  const handleAcknowledge = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signTosAgreement();
      if (user) markTosAgreed(user.id);
      navigate('/studio', { replace: true });
    } catch {
      setSubmitting(false);
      setError('Something went wrong. Please try again.');
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <div className="relative bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

        {/* ── Header ── */}
        <div className="mb-10 text-center sm:mb-12">
          <h1 className="font-display text-4xl leading-tight tracking-wide [text-shadow:none] sm:text-5xl lg:text-6xl">
            Welcome to Formanova
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Read through, then confirm at the bottom to continue.
          </p>
        </div>

        {/* ── Section 1: Photo guidelines ── */}
        <section className="mb-10 sm:mb-12">
          <h2 className="font-display mb-8 text-2xl tracking-wide [text-shadow:none] sm:text-3xl">
            Getting your photos right
          </h2>

          <div className="flex flex-col gap-6">

            {/* ── We recommend ── */}
            <div className="border border-border bg-card p-6 sm:p-8">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-formanova-success" />
                We recommend
              </p>
              <p className="mb-6 mt-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
                Upload images of jewelry worn on the body
              </p>

              <ImageGrid images={DO_IMAGES} onImageClick={openLightbox} />

              <p className="mt-5 mb-5 text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
                Worn jewelry is how the AI understands real-world scale, fit, and proportions.
                A ring on a finger, an earring on an ear. This is the single biggest factor
                in result quality.
              </p>

              <ul className="flex flex-col gap-3">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs leading-relaxed sm:text-sm">
                    <span className="font-medium text-foreground">Clear, even or diffuse light. </span>
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs leading-relaxed sm:text-sm">
                    <span className="font-medium text-foreground">HD resolution or higher, in sharp focus. </span>
                  </span>
                </li>
              </ul>
            </div>

            {/* ── We do not recommend: product shots ── */}
            <div className="border border-border bg-card p-6 sm:p-8">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                We do not recommend
              </p>
              <p className="mb-6 mt-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
                Product shots, jewelry flat on surfaces or display trays
              </p>

              <ImageGrid images={AVOID_IMAGES} onImageClick={openLightbox} />

              <p className="mt-5 mb-5 text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
                Without a body reference the AI cannot determine real-world scale. Ring size,
                pendant drop length, earring proportions on the face, all become guesswork,
                leading to sizing errors.
              </p>

              {/* Scale before/after — right here where it is being discussed */}
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                When jewelry is not worn
              </p>
              <BeforeAfterBlock
                before={scaleBefore}
                after={scaleAfter}
                beforeLabel="Input: earrings not worn"
                afterLabel="Output: proportions are off"
                note="In this example the earrings were not worn. The output looks visually pretty but the proportions are wrong, so this may or may not work for you."
                onImageClick={openLightbox}
              />
            </div>

            {/* ── We do not recommend: screenshots + multiple/packed (combined) ── */}
            <div className="border border-border bg-card p-5 sm:p-6 isolate">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                We do not recommend
              </p>
              <p className="mb-6 mt-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
                Social media screenshots, or multiple items and packed jewelry
              </p>

              <div className="grid grid-cols-2 gap-6 sm:gap-8">
                <ClickableImage src={screenshotExample} alt="Social media screenshot" onClick={openLightbox} />
                <ClickableImage src={multipleAndPacked} alt="Multiple and packed jewelry" onClick={openLightbox} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Input similar to these may change your design.
              </p>
            </div>

          </div>
        </section>

        {/* ── Section 2: Model photo ── */}
        <section className="mb-10 sm:mb-12">
          <h2 className="font-display mb-6 text-2xl tracking-wide [text-shadow:none] sm:text-3xl">
            Fake looking models produce fake looking results
          </h2>
          <p className="mb-5 text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
            Submit a synthetic or illustrated model and the output will match that style. Submit a
            real photo and the output will be photorealistic. The lighting and mood of your model
            carry through to the result. Upload with intention.
          </p>

          <div className="flex flex-col gap-5">
            <div className="border border-border bg-card p-4 sm:p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                Synthetic input
              </p>
              <BeforeAfterBlock
                before={syntheticBefore}
                after={syntheticAfter}
                beforeLabel="Input: synthetic model"
                afterLabel="Output: synthetic-style, not photorealistic"
                note="A synthetic or illustration-style model produces output in that same style. It will not look photorealistic."
                onImageClick={openLightbox}
              />
            </div>
            <div className="border border-border bg-card p-4 sm:p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-formanova-success" />
                Realistic input
              </p>
              <BeforeAfterBlock
                before={realisticBefore}
                after={realisticAfter}
                beforeLabel="Input: realistic model photo"
                afterLabel="Output: realistic-looking result"
                note="A real, well-lit model photo gives the AI what it needs to produce a realistic-looking, natural result."
                onImageClick={openLightbox}
              />
            </div>
          </div>
        </section>

        {/* ── Section 3: What to expect ── */}
        <section className="mb-10 sm:mb-12">
          <h2 className="font-display mb-6 text-2xl tracking-wide [text-shadow:none] sm:text-3xl">
            Low quality input, low quality result
          </h2>
          <div className="border border-border bg-card p-5 sm:p-6">
            <p className="mb-3 text-justify text-sm leading-relaxed text-foreground sm:text-base">
              We cannot guarantee quality output for inputs that do not follow these guidelines.
              Low-quality inputs produce low-quality results, and inputs we do not recommend may
              produce unpredictable results.
            </p>
            <p className="text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
              AI can make mistakes. We are constantly working to make Formanova better for you
              and we take every case of incorrect output seriously.
            </p>
          </div>
        </section>

        {/* ── ToS acknowledgment ── */}
        <div className="border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <Checkbox
              id={tosCheckboxId}
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5 shrink-0"
            />
            <label
              htmlFor={tosCheckboxId}
              className="text-sm leading-relaxed text-foreground sm:text-base"
            >
              I have read and agree to Formanova&rsquo;s{' '}
              <a
                href="https://formanova.ai/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
              >
                Terms of Service
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>

            </label>
          </div>

          {error && (
            <p className="mb-3 text-sm text-destructive">{error}</p>
          )}

          <Button
            size="lg"
            className="w-full sm:w-auto sm:min-w-[220px] sm:px-10"
            disabled={!agreed || submitting}
            onClick={handleAcknowledge}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            I Acknowledge
          </Button>
        </div>

      </div>
      </div>
    </>
  );
}
