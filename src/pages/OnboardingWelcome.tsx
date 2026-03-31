import { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { checkTosAgreement, signTosAgreement, markTosAgreed } from '@/lib/onboarding-api';
import { useAuth } from '@/contexts/AuthContext';

// Allowed (worn) — 4 per category, ordered by category so grid cols align
import ringA1      from '@/assets/examples/ring-allowed-1.webp';
import ringA2      from '@/assets/examples/ring-allowed-2.webp';
import ringA3      from '@/assets/examples/ring-allowed-3.webp';
import ringA4      from '@/assets/examples/ring-allowed-4.jpg';
import earringA1   from '@/assets/examples/earring-allowed-1.webp';
import earringA2   from '@/assets/examples/earring-allowed-2.webp';
import earringA3   from '@/assets/examples/earring-allowed-3.webp';
import earringA4   from '@/assets/examples/earring-allowed-4.jpg';
import necklaceA1  from '@/assets/examples/necklace-allowed-1.webp';
import necklaceA2  from '@/assets/examples/necklace-allowed-2.webp';
import necklaceA3  from '@/assets/examples/necklace-allowed-3.webp';
import necklaceA4  from '@/assets/examples/necklace-allowed-4.jpg';
import braceletA1  from '@/assets/examples/bracelet-allowed-1.webp';
import braceletA2  from '@/assets/examples/bracelet-allowed-2.webp';
import braceletA3  from '@/assets/examples/bracelet-allowed-3.webp';
import braceletA4  from '@/assets/examples/bracelet-allowed-4.jpg';
import watchA1     from '@/assets/examples/watch-allowed-1.webp';
import watchA2     from '@/assets/examples/watch-allowed-2.webp';
import watchA3     from '@/assets/examples/watch-allowed-3.webp';
import watchA4     from '@/assets/examples/watch-allowed-4.jpg';

// Not allowed (product shots) — 3 per category
import ringN1      from '@/assets/examples/ring-notallowed-1.webp';
import ringN2      from '@/assets/examples/ring-notallowed-2.webp';
import ringN3      from '@/assets/examples/ring-notallowed-3.webp';
import earringN1   from '@/assets/examples/earring-notallowed-1.webp';
import earringN2   from '@/assets/examples/earring-notallowed-2.webp';
import earringN3   from '@/assets/examples/earring-notallowed-3.webp';
import necklaceN1  from '@/assets/examples/necklace-notallowed-1.webp';
import necklaceN2  from '@/assets/examples/necklace-notallowed-2.webp';
import necklaceN3  from '@/assets/examples/necklace-notallowed-3.webp';
import braceletN1  from '@/assets/examples/bracelet-notallowed-1.webp';
import braceletN2  from '@/assets/examples/bracelet-notallowed-2.webp';
import braceletN3  from '@/assets/examples/bracelet-notallowed-3.webp';
import watchN1     from '@/assets/examples/watch-notallowed-1.webp';
import watchN2     from '@/assets/examples/watch-notallowed-2.webp';
import watchN3     from '@/assets/examples/watch-notallowed-3.webp';

// ---------------------------------------------------------------------------
// Image grids — each row is [ring, earring, necklace, bracelet, watch]
// so columns stay category-aligned in a grid-cols-5 layout
// ---------------------------------------------------------------------------

const CATEGORIES = ['Ring', 'Earring', 'Necklace', 'Bracelet', 'Watch'];

// 20 images, 4 rows × 5 categories
const DO_IMAGES: { src: string; alt: string }[] = [
  { src: ringA1,     alt: 'Ring worn on finger 1'    },
  { src: earringA1,  alt: 'Earring worn on ear 1'    },
  { src: necklaceA1, alt: 'Necklace worn on neck 1'  },
  { src: braceletA1, alt: 'Bracelet worn on wrist 1' },
  { src: watchA1,    alt: 'Watch worn on wrist 1'    },

  { src: ringA2,     alt: 'Ring worn on finger 2'    },
  { src: earringA2,  alt: 'Earring worn on ear 2'    },
  { src: necklaceA2, alt: 'Necklace worn on neck 2'  },
  { src: braceletA2, alt: 'Bracelet worn on wrist 2' },
  { src: watchA2,    alt: 'Watch worn on wrist 2'    },

  { src: ringA3,     alt: 'Ring worn on finger 3'    },
  { src: earringA3,  alt: 'Earring worn on ear 3'    },
  { src: necklaceA3, alt: 'Necklace worn on neck 3'  },
  { src: braceletA3, alt: 'Bracelet worn on wrist 3' },
  { src: watchA3,    alt: 'Watch worn on wrist 3'    },

  { src: ringA4,     alt: 'Ring worn on finger 4'    },
  { src: earringA4,  alt: 'Earring worn on ear 4'    },
  { src: necklaceA4, alt: 'Necklace worn on neck 4'  },
  { src: braceletA4, alt: 'Bracelet worn on wrist 4' },
  { src: watchA4,    alt: 'Watch worn on wrist 4'    },
];

// 15 images, 3 rows × 5 categories
const AVOID_IMAGES: { src: string; alt: string }[] = [
  { src: ringN1,     alt: 'Ring product shot 1'     },
  { src: earringN1,  alt: 'Earring on display 1'    },
  { src: necklaceN1, alt: 'Necklace product shot 1' },
  { src: braceletN1, alt: 'Bracelet product shot 1' },
  { src: watchN1,    alt: 'Watch product shot 1'    },

  { src: ringN2,     alt: 'Ring product shot 2'     },
  { src: earringN2,  alt: 'Earring on display 2'    },
  { src: necklaceN2, alt: 'Necklace product shot 2' },
  { src: braceletN2, alt: 'Bracelet product shot 2' },
  { src: watchN2,    alt: 'Watch product shot 2'    },

  { src: ringN3,     alt: 'Ring product shot 3'     },
  { src: earringN3,  alt: 'Earring on display 3'    },
  { src: necklaceN3, alt: 'Necklace product shot 3' },
  { src: braceletN3, alt: 'Bracelet product shot 3' },
  { src: watchN3,    alt: 'Watch product shot 3'    },
];

// ---------------------------------------------------------------------------
// Tips
// ---------------------------------------------------------------------------

const DO_TIPS: { point: string; why: string }[] = [
  {
    point: 'Jewelry worn on the body',
    why:   'A ring on a finger, an earring on an ear — worn context is how the AI understands real-world scale, fit, and proportions. This is the single biggest factor in result quality.',
  },
  {
    point: 'Clear, even lighting',
    why:   'Natural daylight or soft studio light works best. Good lighting reveals metal finish, stone clarity, and surface texture — all detail the AI reads to produce accurate output.',
  },
  {
    point: 'HD resolution or higher',
    why:   'The AI generates output at the quality level of the input. More detail in means more detail out.',
  },
  {
    point: 'One jewelry item per photo',
    why:   'Ensures the AI focuses on exactly the right piece with no ambiguity.',
  },
  {
    point: 'Standard pose for the category',
    why:   'Hand flat or slightly angled for rings. Profile or front-facing for earrings. Straight-on for necklaces and bracelets.',
  },
];

const AVOID_TIPS: { point: string; why: string }[] = [
  {
    point: 'Product shots flat on surfaces or display trays',
    why:   'Without a body reference, the AI cannot determine real-world scale. Ring size, pendant drop length, earring scale on the face — all become guesswork, leading to sizing errors.',
  },
  {
    point: 'Poor lighting — harsh shadows, low light, or strong flash glare',
    why:   'Bad lighting hides metal finish, stone clarity, and surface texture. The AI cannot reconstruct detail it cannot see. Overexposed or underexposed shots produce washed-out or muddy results.',
  },
  {
    point: 'Blurry, out-of-focus, or low-resolution photos',
    why:   'The AI reconstructs detail from what it sees. Blurry input produces blurry, inaccurate output. Always submit the sharpest, highest-resolution photo you have.',
  },
  {
    point: 'Jewelry packed in bags or containers',
    why:   'Packaging obscures true shape, surface detail, and material. The AI tries to reconstruct what is hidden and produces inaccurate textures and form. Remove it and photograph clearly. A translucent bag may still work, but unpacking gives better results.',
  },
  {
    point: 'Multiple jewelry items in a single frame',
    why:   'The AI generates one item per image. Multiple pieces cause it to pick the wrong one, blend them together, or fail entirely. Not supported yet.',
  },
  {
    point: 'Social media screenshots',
    why:   'Screenshots are compressed, often cropped, and may carry overlaid text, filters, or borders. Compression alone destroys the fine edge and surface detail the AI relies on.',
  },
];

// ---------------------------------------------------------------------------
// Sub-component: image grid with category column headers
// ---------------------------------------------------------------------------

function ExampleGrid({ images }: { images: { src: string; alt: string }[] }) {
  return (
    <div>
      {/* Category column headers */}
      <div className="mb-1 grid grid-cols-5 gap-1.5 sm:gap-2">
        {CATEGORIES.map((cat) => (
          <p key={cat} className="truncate text-center text-[10px] text-muted-foreground">
            {cat}
          </p>
        ))}
      </div>
      {/* Image grid — cols stay category-aligned */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {images.map(({ src, alt }) => (
          <div key={alt} className="overflow-hidden rounded border border-border">
            <img
              src={src}
              alt={alt}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
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
          rings and earrings where gem and band proportions are critical. Think of it like a
          fitting room: a ring on a finger tells the AI far more than a ring sitting on a table.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

          {/* DO column */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-formanova-success">
              Do this
            </p>
            <ExampleGrid images={DO_IMAGES} />
            <ul className="flex flex-col gap-3 pt-1">
              {DO_TIPS.map(({ point, why }) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-formanova-success" />
                  <span className="text-xs leading-relaxed sm:text-sm">
                    <span className="font-medium text-foreground">{point}. </span>
                    <span className="text-muted-foreground">{why}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* AVOID column */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
              Avoid
            </p>
            <ExampleGrid images={AVOID_IMAGES} />
            <ul className="flex flex-col gap-3 pt-1">
              {AVOID_TIPS.map(({ point, why }) => (
                <li key={point} className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span className="text-xs leading-relaxed sm:text-sm">
                    <span className="font-medium text-foreground">{point}. </span>
                    <span className="text-muted-foreground">{why}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </section>

      {/* ── Sections 2 & 3 side by side ── */}
      <div className="mb-10 grid grid-cols-1 items-stretch gap-4 sm:mb-12 sm:grid-cols-2 sm:gap-6">

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
