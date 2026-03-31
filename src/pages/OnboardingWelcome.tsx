import { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { checkTosAgreement, signTosAgreement, markTosAgreed } from '@/lib/onboarding-api';
import { useAuth } from '@/contexts/AuthContext';

import ringAllowed from '@/assets/examples/ring-allowed-1.webp';
import earringAllowed from '@/assets/examples/earring-allowed-1.webp';
import necklaceAllowed from '@/assets/examples/necklace-allowed-1.webp';
import ringNotAllowed from '@/assets/examples/ring-notallowed-1.webp';
import earringNotAllowed from '@/assets/examples/earring-notallowed-1.webp';
import necklaceNotAllowed from '@/assets/examples/necklace-notallowed-1.webp';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const DO_IMAGES = [
  { src: ringAllowed,     alt: 'Ring worn on finger'   },
  { src: earringAllowed,  alt: 'Earring worn on ear'   },
  { src: necklaceAllowed, alt: 'Necklace worn on neck' },
];

const AVOID_IMAGES = [
  { src: ringNotAllowed,     alt: 'Ring flat on surface'     },
  { src: earringNotAllowed,  alt: 'Earring on display tray'  },
  { src: necklaceNotAllowed, alt: 'Necklace product shot'     },
];

const DO_TIPS = [
  'Worn on hands, ears, wrists, or neck',
  'One jewelry item per photo',
  'Clear, sharp, well-lit at HD resolution or higher',
  'Standard pose for the category',
];

const AVOID_TIPS = [
  'Flat product shots on surfaces or display trays',
  'Jewelry in bags or packaging',
  'Multiple items in a single frame (not supported yet)',
  'Blurry, low-resolution photos or social media screenshots',
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tosCheckboxId = useId();

  const [checking, setChecking]   = useState(true);
  const [agreed, setAgreed]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

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
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

      {/* ── Header ── */}
      <div className="mb-10 text-center sm:mb-12">
        <h1 className="font-display text-4xl leading-tight tracking-wide sm:text-5xl lg:text-6xl">
          Welcome to Formanova
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Read through, then confirm at the bottom to continue.
        </p>
      </div>

      {/* ── Section 1: Wear it, don't stage it ── */}
      <section className="mb-10 sm:mb-12">
        <h2 className="font-display mb-3 text-2xl tracking-wide sm:text-3xl">
          Wear it. Don't stage it.
        </h2>
        <p className="mb-6 text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
          Worn images give the AI what it needs to understand real-world scale and proportions.
          Product flats leave it guessing, which is where sizing errors come from, especially for
          rings and earrings. Think of it like a fitting room: a ring on a finger tells the AI
          far more than a ring sitting on a table. Worn inputs consistently produce better,
          more accurate results.
        </p>

        {/* Image comparison grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6">

          {/* DO column */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-formanova-success">
              Do this
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DO_IMAGES.map(({ src, alt }) => (
                <div key={alt} className="overflow-hidden rounded-md border border-border">
                  <img
                    src={src}
                    alt={alt}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <ul className="flex flex-col gap-1.5">
              {DO_TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-formanova-success" />
                  <span className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AVOID column */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
              Avoid
            </p>
            <div className="grid grid-cols-3 gap-2">
              {AVOID_IMAGES.map(({ src, alt }) => (
                <div key={alt} className="overflow-hidden rounded-md border border-border">
                  <img
                    src={src}
                    alt={alt}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <ul className="flex flex-col gap-1.5">
              {AVOID_TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{tip}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </section>

      {/* ── Sections 2 & 3 side by side ── */}
      <div className="mb-10 grid grid-cols-1 items-stretch gap-4 sm:mb-12 sm:grid-cols-2 sm:gap-6">

        {/* Model photos */}
        <div className="rounded-md border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display mb-3 text-xl tracking-wide sm:text-2xl">
            Choose your model photo carefully.
          </h2>
          <p className="mb-3 text-justify text-sm leading-relaxed text-foreground sm:text-base">
            Think of it like casting for a shoot. The model photo sets the realism and mood of
            your output. A photorealistic model photo produces a photorealistic result. A synthetic
            render or illustration will match that style. For hyperrealistic output, use a real
            model photo or choose one from Formanova's built-in library.
          </p>
          <p className="text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
            The lighting and mood of your model photo carry over into the final image. Upload
            with intention.
          </p>
        </div>

        {/* What to expect */}
        <div className="rounded-md border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display mb-3 text-xl tracking-wide sm:text-2xl">
            What to expect.
          </h2>
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

      </div>

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
  );
}
