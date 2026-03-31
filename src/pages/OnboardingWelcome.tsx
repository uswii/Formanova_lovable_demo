import { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { checkTosAgreement, signTosAgreement, markTosAgreed } from '@/lib/onboarding-api';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const DO_TIPS = [
  {
    headline: 'Jewelry worn on the body',
    detail:
      'On a finger, ear, wrist, or neck. This is the single biggest factor in result quality. Think of it like a fitting room: a ring on a finger tells the AI far more than a ring on a table.',
  },
  {
    headline: 'One jewelry item per photo',
    detail:
      'Multiple pieces in a single frame are not supported yet. Keep it to one item at a time.',
  },
  {
    headline: 'Clear, sharp, well-lit shots at HD resolution or higher',
    detail:
      'Natural or studio light works well. The AI reads fine detail, so give it fine detail to work with. Low-resolution inputs produce low-resolution results.',
  },
  {
    headline: 'Standard poses for the category',
    detail:
      'Hand flat or slightly angled for rings. Profile or front-facing for earrings. Straight-on for necklaces and bracelets.',
  },
];

const AVOID_TIPS = [
  'Product shots flat on a surface or display tray',
  'Jewelry packed in bags or containers. If it is in a translucent bag it may still work, but unpacking it and photographing it clearly will give you better results.',
  'Multiple jewelry items in a single photo (not supported yet)',
  'Blurry photos, out-of-focus shots, or low-resolution images',
  'Social media screenshots',
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tosCheckboxId = useId();

  const [checking, setChecking] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8 sm:py-16 lg:max-w-3xl lg:px-10">

      {/* Header */}
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
          Worn images give the AI the context it needs to understand real-world scale and proportions.
          Product flats leave it guessing, and that is where sizing errors come from, especially for
          rings and earrings where gem and band proportions are critical. Worn inputs consistently
          produce better, more accurate results.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          {/* Do column */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-formanova-success">
              Do this
            </p>
            <div className="flex flex-col gap-3">
              {DO_TIPS.map(({ headline, detail }) => (
                <div
                  key={headline}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-formanova-success" />
                  <div>
                    <p className="text-sm font-medium leading-snug text-foreground">{headline}</p>
                    <p className="mt-1 text-justify text-xs leading-relaxed text-muted-foreground">
                      {detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Avoid column */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-destructive">
              Avoid
            </p>
            <div className="flex flex-col gap-3">
              {AVOID_TIPS.map((tip) => (
                <div
                  key={tip}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3"
                >
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-justify text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {tip}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Model photos ── */}
      <section className="mb-10 sm:mb-12">
        <h2 className="font-display mb-3 text-2xl tracking-wide sm:text-3xl">
          Choose your model photo carefully.
        </h2>
        <div className="rounded-md border border-border bg-card px-5 py-4 sm:px-6 sm:py-5">
          <p className="mb-3 text-justify text-sm leading-relaxed text-foreground sm:text-base">
            Think of it like casting for a shoot. The model photo sets the realism and mood of
            your output. If you submit a photorealistic model photo, you get a photorealistic
            result. Submit a synthetic render or illustration and the result will match that style.
            For hyperrealistic output, use a realistic model photo or choose one from
            Formanova&rsquo;s built-in library.
          </p>
          <p className="text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
            The lighting, tone, and mood of your model photo carry over into the final image.
            A moody, dark-lit model photo produces moody output. A bright, clean-lit model photo
            produces bright, clean output. Upload with intention.
          </p>
        </div>
      </section>

      {/* ── Section 3: What to expect ── */}
      <section className="mb-10 sm:mb-12">
        <h2 className="font-display mb-3 text-2xl tracking-wide sm:text-3xl">
          What to expect.
        </h2>
        <div className="rounded-md border border-border bg-card px-5 py-4 sm:px-6 sm:py-5">
          <p className="mb-3 text-justify text-sm leading-relaxed text-foreground sm:text-base">
            Your results depend on the quality and type of input you submit. We cannot guarantee
            quality output for inputs that do not follow these guidelines. Low-quality inputs
            produce low-quality results. Inputs we do not recommend will not be supported and
            may produce unpredictable results.
          </p>
          <p className="text-justify text-sm leading-relaxed text-muted-foreground sm:text-base">
            AI can make mistakes. We are constantly working to make Formanova better for you and
            we take every case of incorrect output seriously.
          </p>
        </div>
      </section>

      {/* ── ToS acknowledgment ── */}
      <div className="rounded-lg border border-border bg-card px-5 py-5 sm:px-6 sm:py-6">
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
