import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';

import ringA1            from '@/assets/examples/ring-allowed-1.webp';
import earringA1         from '@/assets/examples/earring-allowed-1.webp';
import necklaceA1        from '@/assets/examples/necklace-allowed-1.webp';
import braceletA1        from '@/assets/examples/bracelet-allowed-1.webp';
import watchA1           from '@/assets/examples/watch-allowed-1.webp';
import ringN1            from '@/assets/examples/ring-notallowed-1.webp';
import earringN1         from '@/assets/examples/earring-notallowed-1.webp';
import necklaceN1        from '@/assets/examples/necklace-notallowed-1.webp';
import braceletN1        from '@/assets/examples/bracelet-notallowed-1.webp';
import watchN1           from '@/assets/examples/watch-notallowed-1.webp';
import multipleAndPacked from '@/assets/examples/multile-and-packed.webp';
import screenshotExample from '@/assets/examples/screenshot.webp';
import scaleBefore       from '@/assets/examples/not_worn_scale_before.webp';
import scaleAfter        from '@/assets/examples/not-wonr-scale-output.webp';
import syntheticBefore   from '@/assets/examples/synthetic-before.webp';
import syntheticAfter    from '@/assets/examples/synthetic-after.webp';
import realisticBefore   from '@/assets/examples/realistic-model-input.webp';
import realisticAfter    from '@/assets/examples/realistic-output.webp';

// ─── Step titles ──────────────────────────────────────────────────────────────

const STEP_TITLES = [
  'Getting your photos right',
  'What not to upload — product shots',
  'What not to upload — screenshots & multiple',
  'Fake looking models produce fake looking results',
  'Low quality input, low quality result',
] as const;

const TOTAL = STEP_TITLES.length;

// ─── Step content ─────────────────────────────────────────────────────────────

function Step1() {
  return (
    <div className="border border-border bg-card p-5">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-formanova-success" />
        We recommend
      </p>
      <p className="mb-4 mt-1 text-base font-semibold leading-snug text-foreground">
        Upload images of jewelry worn on the body
      </p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[ringA1, earringA1, necklaceA1, braceletA1, watchA1].map((src, i) => (
          <div key={i} className="aspect-square overflow-hidden border border-border/30 bg-muted/20">
            <img src={src} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      <p className="text-justify text-sm leading-relaxed text-muted-foreground">
        Worn jewelry is how the AI understands real-world scale, fit, and proportions.
        A ring on a finger, an earring on an ear. This is the single biggest factor
        in result quality.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        <li className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs leading-relaxed sm:text-sm">
            <span className="font-medium text-foreground">Clear, even or diffuse light.</span>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs leading-relaxed sm:text-sm">
            <span className="font-medium text-foreground">HD resolution or higher, in sharp focus.</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

function Step2() {
  return (
    <div className="space-y-5">
      <div className="border border-border bg-card p-5">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
          We do not recommend
        </p>
        <p className="mb-4 mt-1 text-base font-semibold leading-snug text-foreground">
          Product shots, jewelry flat on surfaces or display trays
        </p>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[ringN1, earringN1, necklaceN1, braceletN1, watchN1].map((src, i) => (
            <div key={i} className="aspect-square overflow-hidden border border-border/30 bg-muted/20">
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        <p className="text-justify text-sm leading-relaxed text-muted-foreground">
          Without a body reference the AI cannot determine real-world scale. Ring size,
          pendant drop length, earring proportions on the face, all become guesswork,
          leading to sizing errors.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          When jewelry is not worn
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="overflow-hidden border border-border/30 bg-muted/20">
              <img src={scaleBefore} alt="Input: earrings not worn" className="w-full object-cover" />
            </div>
            <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
              Input: earrings not worn
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="overflow-hidden border border-border/30 bg-muted/20">
              <img src={scaleAfter} alt="Output: proportions are off" className="w-full object-cover" />
            </div>
            <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
              Output: proportions are off
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-justify leading-relaxed text-muted-foreground">
          In this example the earrings were not worn. The output looks visually pretty but the
          proportions are wrong, so this may or may not work for you.
        </p>
      </div>
    </div>
  );
}

function Step3() {
  return (
    <div className="border border-border bg-card p-5">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
        We do not recommend
      </p>
      <p className="mb-4 mt-1 text-base font-semibold leading-snug text-foreground">
        Social media screenshots, or multiple items and packed jewelry
      </p>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="overflow-hidden border border-border/30 bg-muted/20">
          <img src={screenshotExample} alt="Social media screenshot" className="w-full object-contain" />
        </div>
        <div className="overflow-hidden border border-border/30 bg-muted/20">
          <img src={multipleAndPacked} alt="Multiple and packed jewelry" className="w-full object-contain" />
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Input similar to these may change your design.
      </p>
    </div>
  );
}

function Step4() {
  return (
    <div className="space-y-4">
      <p className="text-justify text-sm leading-relaxed text-muted-foreground">
        Submit a synthetic or illustrated model and the output will match that style. Submit a
        real photo and the output will be photorealistic. The lighting and mood of your model
        carry through to the result. Upload with intention.
      </p>

      <div className="border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
          Synthetic input
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="overflow-hidden border border-border/30 bg-muted/20">
              <img src={syntheticBefore} alt="Input: synthetic model" className="w-full object-cover" />
            </div>
            <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
              Input: synthetic model
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="overflow-hidden border border-border/30 bg-muted/20">
              <img src={syntheticAfter} alt="Output: synthetic-style, not photorealistic" className="w-full object-cover" />
            </div>
            <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
              Output: synthetic-style, not photorealistic
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-justify leading-relaxed text-muted-foreground">
          A synthetic or illustration-style model produces output in that same style. It will not look photorealistic.
        </p>
      </div>

      <div className="border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-formanova-success" />
          Realistic input
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="overflow-hidden border border-border/30 bg-muted/20">
              <img src={realisticBefore} alt="Input: realistic model photo" className="w-full object-cover" />
            </div>
            <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
              Input: realistic model photo
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="overflow-hidden border border-border/30 bg-muted/20">
              <img src={realisticAfter} alt="Output: realistic-looking result" className="w-full object-cover" />
            </div>
            <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
              Output: realistic-looking result
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-justify leading-relaxed text-muted-foreground">
          A real, well-lit model photo gives the AI what it needs to produce a realistic-looking, natural result.
        </p>
      </div>

      <div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-4">
        <Lightbulb className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        <p className="text-sm leading-relaxed text-foreground">
          Make sure your model is not already wearing the jewelry type you are shooting for.
        </p>
      </div>
    </div>
  );
}

function Step5() {
  return (
    <div className="border border-border bg-card p-5">
      <p className="mb-3 text-justify text-sm leading-relaxed text-foreground">
        We cannot guarantee quality output for inputs that do not follow these guidelines.
        Low-quality inputs produce low-quality results, and inputs we do not recommend may
        produce unpredictable results.
      </p>
      <p className="text-justify text-sm leading-relaxed text-muted-foreground">
        AI can make mistakes. We are constantly working to make Formanova better for you
        and we take every case of incorrect output seriously.
      </p>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function StudioOnboardingModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);

  const close = () => {
    setStep(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-2xl w-full shadow-none p-0 flex flex-col max-h-[90vh] overflow-hidden gap-0">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
              Read this to get started
            </p>
            <DialogTitle className="font-display text-xl sm:text-2xl tracking-wide [text-shadow:none]">
              {STEP_TITLES[step]}
            </DialogTitle>
          </div>
          <span className="font-mono text-sm text-muted-foreground shrink-0 ml-6 mt-1">
            {step + 1} / {TOTAL}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && <Step1 />}
          {step === 1 && <Step2 />}
          {step === 2 && <Step3 />}
          {step === 3 && <Step4 />}
          {step === 4 && <Step5 />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === step
                    ? 'w-5 h-1.5 bg-foreground'
                    : i < step
                    ? 'w-1.5 h-1.5 bg-foreground/40'
                    : 'w-1.5 h-1.5 bg-muted-foreground/25'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>
                Back
              </Button>
            )}
            <Button
              size="sm"
              className="min-w-[72px]"
              onClick={() => { if (step < TOTAL - 1) setStep(s => s + 1); else close(); }}
            >
              {step === TOTAL - 1 ? 'Got it' : 'Next'}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
