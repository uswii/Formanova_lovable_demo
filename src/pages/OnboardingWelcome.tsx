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

import multipleAndPacked from '@/assets/examples/multile-and-packed.webp';
import screenshotExample from '@/assets/examples/screenshot.webp';
import ringN1      from '@/assets/examples/ring-notallowed-1.webp';
import earringN1   from '@/assets/examples/earring-notallowed-1.webp';
import necklaceN1  from '@/assets/examples/necklace-notallowed-1.webp';
import braceletN1  from '@/assets/examples/bracelet-notallowed-1.webp';
import watchN1     from '@/assets/examples/watch-notallowed-1.webp';

import scaleBefore from '@/assets/examples/not_worn_scale_before.webp';
import scaleAfter  from '@/assets/examples/not-wonr-scale-output.webp';

import syntheticBefore  from '@/assets/examples/synthetic-before.webp';
import syntheticAfter   from '@/assets/examples/synthetic-after.webp';
import realisticBefore  from '@/assets/examples/realistic-model-input.webp';
import realisticAfter   from '@/assets/examples/realistic-output.webp';

// ---------------------------------------------------------------------------
// Data — each topic owns its images and its do/avoid explanation
// ---------------------------------------------------------------------------

const TOPICS = [
  {
    id: 'worn',
    title: 'Worn jewelry, not product shots',
    do: {
      img: ringA1,
      label: 'Ring worn on finger',
      point: 'Jewelry worn on the body.',
      why: 'A ring on a finger, an earring on an ear. Worn context is how the AI understands real-world scale, fit, and proportions. This is the single biggest factor in result quality.',
    },
    avoid: {
      img: ringN1,
      label: 'Ring flat on a surface',
      point: 'Product shots flat on surfaces or display trays.',
      why: 'Without a body reference the AI cannot determine real-world scale. Ring size, pendant drop length, earring proportions on the face — all become guesswork, leading to sizing errors.',
    },
  },
  {
    id: 'lighting',
    title: 'Clear, even lighting',
    do: {
      img: earringA1,
      label: 'Soft, even light',
      point: 'Natural daylight or soft studio light.',
      why: 'Good lighting reveals metal finish, stone clarity, and surface texture — all the detail the AI reads to produce accurate output.',
    },
    avoid: {
      img: earringN1,
      label: 'Harsh shadows or glare',
      point: 'Harsh shadows, low light, or strong flash glare.',
      why: 'Bad lighting hides finish and texture. The AI cannot reconstruct detail it cannot see. Overexposed or underexposed shots produce washed-out or muddy results.',
    },
  },
  {
    id: 'resolution',
    title: 'Sharp, high-resolution photos',
    do: {
      img: necklaceA1,
      label: 'HD, in-focus photo',
      point: 'HD resolution or higher, in sharp focus.',
      why: 'The AI generates output at the quality level of the input. More detail in means more detail out.',
    },
    avoid: {
      img: necklaceN1,
      label: 'Blurry or low-resolution',
      point: 'Blurry, out-of-focus, or low-resolution photos.',
      why: 'Blurry input produces blurry, inaccurate output. Always submit the sharpest, highest-resolution photo you have.',
    },
  },
  {
    id: 'single',
    title: 'One item per photo',
    do: {
      img: braceletA1,
      label: 'Single bracelet, clearly visible',
      point: 'One jewelry item per photo, in a clear standard pose.',
      why: 'Ensures the AI focuses on exactly the right piece with no ambiguity. Hand flat or slightly angled for rings. Profile or front-facing for earrings. Straight-on for necklaces and bracelets.',
    },
    avoid: {
      img: multipleAndPacked,
      label: 'Multiple or packed pieces',
      point: 'Multiple pieces in one frame, or jewelry packed in bags.',
      why: 'Multiple pieces cause the AI to pick the wrong one, blend them, or fail entirely. Packaging obscures shape, surface detail, and material — remove packaging and photograph each piece separately.',
    },
  },
  {
    id: 'screenshot',
    title: 'Original photos, not screenshots',
    do: {
      img: watchA1,
      label: 'Original photo file',
      point: 'Submit the original, uncompressed photo.',
      why: 'Original files retain full resolution and all the fine edge and surface detail the AI relies on.',
    },
    avoid: {
      img: screenshotExample,
      label: 'Social media screenshot',
      point: 'Social media screenshots.',
      why: 'Screenshots are compressed, often cropped, and may carry overlaid text, filters, or borders. Compression alone destroys the fine edge and surface detail the AI relies on.',
    },
  },
] as const;

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
      <div
        className="relative max-h-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
        <img
          src={src}
          alt="Enlarged view"
          className="max-h-[85vh] w-auto rounded-md object-contain"
        />
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
      className="overflow-hidden rounded border border-border cursor-pointer"
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

/** A self-contained card: paired DO/AVOID image + both explanations together. */
function TopicCard({
  topic,
  onImageClick,
}: {
  topic: typeof TOPICS[number];
  onImageClick: (src: string) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-foreground sm:text-xs">
        {topic.title}
      </h3>
      {/* Images side by side */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="relative">
            <ClickableImage src={topic.do.img} alt={topic.do.label} onClick={onImageClick} />
            <span className="absolute left-1.5 top-1.5 rounded bg-formanova-success/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Do
            </span>
          </div>
          <p className="text-center text-[10px] leading-snug text-muted-foreground">{topic.do.label}</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="relative">
            <ClickableImage src={topic.avoid.img} alt={topic.avoid.label} onClick={onImageClick} />
            <span className="absolute left-1.5 top-1.5 rounded bg-destructive/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Avoid
            </span>
          </div>
          <p className="text-center text-[10px] leading-snug text-muted-foreground">{topic.avoid.label}</p>
        </div>
      </div>
      {/* Explanations — same card, right below the images */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-formanova-success" />
          <span className="text-xs leading-relaxed sm:text-sm">
            <span className="font-medium text-foreground">{topic.do.point} </span>
            <span className="text-muted-foreground">{topic.do.why}</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <span className="text-xs leading-relaxed sm:text-sm">
            <span className="font-medium text-foreground">{topic.avoid.point} </span>
            <span className="text-muted-foreground">{topic.avoid.why}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function BeforeAfterBlock({
  before, after, beforeLabel, afterLabel, note, onImageClick, heading, headingColor,
}: {
  before: string; after: string;
  beforeLabel: string; afterLabel: string;
  note: string;
  onImageClick: (src: string) => void;
  heading?: string;
  headingColor?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 sm:p-5">
      {heading && (
        <p className={`mb-3 text-xs font-semibold uppercase tracking-widest ${headingColor ?? 'text-muted-foreground'}`}>
          {heading}
        </p>
      )}
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
      <p className="mt-3 text-justify text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {note}
      </p>
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

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">

        {/* ── Header ── */}
        <div className="mb-10 text-center sm:mb-12">
          <h1 className="font-display text-4xl leading-tight tracking-wide sm:text-5xl lg:text-6xl">
            Welcome to Formanova
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Read through, then confirm at the bottom to continue.
          </p>
        </div>

        {/* ── Section 1: Photo guidelines ── */}
        <section className="mb-10 sm:mb-12">
          <h2 className="font-display mb-3 text-2xl tracking-wide sm:text-3xl">
            Getting your photos right.
          </h2>
          <p className="mb-6 text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
            The quality of your output depends almost entirely on the quality of what you submit.
            These guidelines exist because of how the AI reads your input — not arbitrary rules.
            Each one is explained below with a paired example.
          </p>

          <div className="flex flex-col gap-4">

            {/* Topic 1: Worn vs product shot */}
            <TopicCard topic={TOPICS[0]} onImageClick={openLightbox} />

            {/* Scale before/after — lives right after the worn vs product shot topic */}
            <BeforeAfterBlock
              heading="What a product shot actually produces"
              before={scaleBefore}
              after={scaleAfter}
              beforeLabel="Input: product shot"
              afterLabel="Output: wrong proportions"
              note="When the AI has no body reference it guesses scale. The result is often a ring that looks oversized, an earring that is out of proportion, or a necklace that does not sit naturally. Worn inputs eliminate this guesswork."
              onImageClick={openLightbox}
            />

            {/* Remaining topics */}
            {TOPICS.slice(1).map((topic) => (
              <TopicCard key={topic.id} topic={topic} onImageClick={openLightbox} />
            ))}

          </div>
        </section>

        {/* ── Section 2: Model photo ── */}
        <section className="mb-10 sm:mb-12">
          <h2 className="font-display mb-3 text-2xl tracking-wide sm:text-3xl">
            Choose your model photo carefully.
          </h2>
          <p className="mb-5 text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
            Think of it like casting for a shoot. The model photo sets the realism and mood of
            your output. A photorealistic model produces a photorealistic result. A synthetic render
            or illustration will match that style. For hyperrealistic output, use a real model photo
            or choose one from Formanova's built-in library. The lighting and mood carry over too.
            Upload with intention.
          </p>

          <div className="flex flex-col gap-4 sm:gap-5">
            <BeforeAfterBlock
              heading="Synthetic input"
              headingColor="text-destructive"
              before={syntheticBefore}
              after={syntheticAfter}
              beforeLabel="Input: synthetic model"
              afterLabel="Output: synthetic-style, not photorealistic"
              note="A synthetic or illustration-style model produces output in that same style. It will not look photorealistic."
              onImageClick={openLightbox}
            />
            <BeforeAfterBlock
              heading="Realistic input"
              headingColor="text-formanova-success"
              before={realisticBefore}
              after={realisticAfter}
              beforeLabel="Input: real model photo"
              afterLabel="Output: photorealistic result"
              note="A real, well-lit model photo gives the AI what it needs to produce a hyperrealistic, natural-looking result."
              onImageClick={openLightbox}
            />
          </div>
        </section>

        {/* ── Section 3: What to expect ── */}
        <section className="mb-10 sm:mb-12">
          <h2 className="font-display mb-3 text-2xl tracking-wide sm:text-3xl">
            What to expect.
          </h2>
          <div className="rounded-md border border-border bg-card p-5 sm:p-6">
            <p className="mb-3 text-justify text-sm leading-relaxed text-foreground sm:text-base">
              Your results depend on the quality and type of input you submit. We cannot guarantee
              quality output for inputs that do not follow these guidelines. Low-quality inputs
              produce low-quality results, and inputs we do not recommend may produce
              unpredictable results.
            </p>
            <p className="text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
              AI can make mistakes. We are constantly working to make Formanova better for you
              and we take every case of incorrect output seriously.
            </p>
          </div>
        </section>

        {/* ── ToS acknowledgment ── */}
        <div className="rounded-md border border-border bg-card p-5 sm:p-6">
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
              .
              <span className="ml-1 text-xs text-muted-foreground">(Opens in a new tab. Return here to complete your acknowledgment.)</span>
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
    </>
  );
}
