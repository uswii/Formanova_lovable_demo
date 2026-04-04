import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Lightbulb, X as XIcon } from 'lucide-react';

import ringA1            from '@/assets/examples/ring-allowed-1.webp';
import earringA1         from '@/assets/examples/earring-allowed-1.webp';
import watchA1           from '@/assets/examples/watch-allowed-1.webp';
import braceletA1        from '@/assets/examples/bracelet-allowed-1.webp';
import ringN1            from '@/assets/examples/ring-notallowed-1.webp';
import earringN1         from '@/assets/examples/earring-notallowed-1.webp';
import watchN1           from '@/assets/examples/watch-notallowed-1.webp';
import braceletN1        from '@/assets/examples/bracelet-notallowed-1.webp';
import multipleAndPacked from '@/assets/examples/multile-and-packed.webp';
import screenshotExample from '@/assets/examples/screenshot.webp';
import scaleBefore       from '@/assets/examples/not_worn_scale_before.webp';
import scaleAfter        from '@/assets/examples/not-wonr-scale-output.webp';
import syntheticBefore   from '@/assets/examples/synthetic-before.webp';
import syntheticAfter    from '@/assets/examples/synthetic-after.webp';
import realisticBefore   from '@/assets/examples/realistic-model-input.webp';
import realisticAfter    from '@/assets/examples/realistic-output.webp';

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Wear your jewelry. Always.' },
  { title: 'Without a body, size goes wrong' },
  { title: 'Screenshots and packaged jewelry don\'t work' },
  { title: 'Fake models give fake results' },
  { title: 'Bad photo in, bad photo out' },
] as const;

const TOTAL = STEPS.length;

// ─── Shared clickable image cell ──────────────────────────────────────────────

function Img({
  src, alt, onZoom,
}: { src: string; alt: string; onZoom: (s: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onZoom(src)}
      className="aspect-square w-full overflow-hidden border border-border/30 bg-muted/10 block focus:outline-none"
    >
      <img src={src} alt={alt} className="w-full h-full object-contain" />
    </button>
  );
}

// ─── Step 1: Do / Don't side by side ─────────────────────────────────────────

function Step1({ onZoom }: { onZoom: (s: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* DO */}
      <div className="flex flex-col gap-2">
        <div className="min-h-[2.75rem]">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-formanova-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Do this
          </p>
          <p className="text-sm font-medium text-foreground leading-snug">Jewelry worn on the body</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[ringA1, earringA1, watchA1, braceletA1].map((src, i) => (
            <button key={i} type="button" onClick={() => onZoom(src)}
              className="aspect-square w-full overflow-hidden border border-formanova-success/20 bg-muted/10 focus:outline-none">
              <img src={src} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground leading-relaxed">Clear, diffuse light</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground leading-relaxed">Sharp, HD photo</span>
          </li>
        </ul>
      </div>

      {/* DON'T */}
      <div className="flex flex-col gap-2">
        <div className="min-h-[2.75rem]">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-destructive">
            <XCircle className="h-3.5 w-3.5 shrink-0" /> Avoid this
          </p>
          <p className="text-sm font-medium text-foreground leading-snug">Jewelry lying on a surface</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[ringN1, earringN1, watchN1, braceletN1].map((src, i) => (
            <button key={i} type="button" onClick={() => onZoom(src)}
              className="aspect-square w-full overflow-hidden border border-destructive/20 bg-muted/10 focus:outline-none">
              <img src={src} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground leading-relaxed">Harsh or uneven light</span>
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground leading-relaxed">Blurry or low-res photo</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─── Step 2: Scale consequence ────────────────────────────────────────────────

function Step2({ onZoom }: { onZoom: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="min-h-[2.75rem]">
        <p className="text-sm text-justify text-muted-foreground leading-relaxed">
          The AI needs to see the jewelry on a body to know how big it is. Here is what happens when it can't.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Img src={scaleBefore} alt="Input: earrings not worn" onZoom={onZoom} />
          <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
            Input: earrings not worn
          </p>
        </div>
        <div className="space-y-1.5">
          <Img src={scaleAfter} alt="Output: proportions are off" onZoom={onZoom} />
          <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
            Output: earrings look too big
          </p>
        </div>
      </div>
      <p className="text-xs text-justify text-muted-foreground leading-relaxed">
        The result can look nice but the jewelry ends up the wrong size.
      </p>
    </div>
  );
}

// ─── Step 3: Screenshots + multiple ──────────────────────────────────────────

function Step3({ onZoom }: { onZoom: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="min-h-[2.75rem]">
        <p className="text-sm text-justify text-muted-foreground leading-relaxed">
          These inputs confuse the AI and can change your jewelry design.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Img src={screenshotExample} alt="Social media screenshot" onZoom={onZoom} />
          <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
            Social media screenshot
          </p>
        </div>
        <div className="space-y-1.5">
          <Img src={multipleAndPacked} alt="Multiple and packed jewelry" onZoom={onZoom} />
          <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
            Jewelry in packaging or bundles
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Synthetic vs realistic model ────────────────────────────────────

function Step4({ onZoom }: { onZoom: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="min-h-[2.75rem]">
        <p className="text-sm text-justify text-muted-foreground leading-relaxed">
          The AI copies the style of your photo. Use a real photo, get a real result.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* Synthetic */}
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-destructive">
            <XCircle className="h-3.5 w-3.5 shrink-0" /> Synthetic model
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Img src={syntheticBefore} alt="Synthetic model" onZoom={onZoom} />
              <p className="text-[9px] text-center font-mono tracking-widest text-muted-foreground uppercase">Input</p>
            </div>
            <div className="space-y-1.5">
              <Img src={syntheticAfter} alt="Synthetic output" onZoom={onZoom} />
              <p className="text-[9px] text-center font-mono tracking-widest text-muted-foreground uppercase">Output</p>
            </div>
          </div>
        </div>

        {/* Realistic */}
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-formanova-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Realistic model
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Img src={realisticBefore} alt="Realistic model" onZoom={onZoom} />
              <p className="text-[9px] text-center font-mono tracking-widest text-muted-foreground uppercase">Input</p>
            </div>
            <div className="space-y-1.5">
              <Img src={realisticAfter} alt="Realistic output" onZoom={onZoom} />
              <p className="text-[9px] text-center font-mono tracking-widest text-muted-foreground uppercase">Output</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-3.5">
        <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <p className="text-xs leading-relaxed text-foreground">
          Make sure your model is not already wearing the same type of jewelry you want to add.
        </p>
      </div>
    </div>
  );
}

// ─── Step 5: Low quality in / low quality out ─────────────────────────────────

function Step5() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-justify text-foreground leading-relaxed">
        A blurry, dark, or low-res photo will give you a blurry, bad result. We can't fix a bad input.
      </p>
      <p className="text-sm text-justify text-muted-foreground leading-relaxed">
        AI is not perfect. We are always working to make Formanova better and we take every bad result seriously.
      </p>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  isTest?: boolean;
}

export function StudioOnboardingModal({ open, onClose, isTest }: Props) {
  const [step, setStep] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const close = () => {
    setStep(0);
    onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (lightbox) return;
    if (e.key === 'ArrowRight' && step < TOTAL - 1) setStep(s => s + 1);
    if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
    if (e.key === 'Enter' && step === TOTAL - 1) close();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl shadow-none p-0 flex flex-col overflow-hidden gap-0 [&>button:last-of-type]:hidden" onKeyDown={handleKey}>

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
                Read this to get started
              </p>
              <DialogTitle className="font-display text-xl sm:text-2xl tracking-wide [text-shadow:none]">
                {STEPS[step].title}
              </DialogTitle>
            </div>
            <span className="font-mono text-sm text-muted-foreground shrink-0 ml-6 mt-1">
              {step + 1} / {TOTAL}
            </span>
          </div>

          {/* Content */}
          <div className="px-6 py-5 h-[calc((100vw-5rem)/2+120px)] max-h-[440px] min-h-[260px] overflow-hidden">
            {step === 0 && <Step1 onZoom={setLightbox} />}
            {step === 1 && <Step2 onZoom={setLightbox} />}
            {step === 2 && <Step3 onZoom={setLightbox} />}
            {step === 3 && <Step4 onZoom={setLightbox} />}
            {step === 4 && <Step5 />}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
            <div className="flex items-center">
              {isTest && (
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  ↩ restart
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {step > 0 && (
                <Button variant="ghost" size="default" className="min-w-[80px]" onClick={() => setStep(s => s - 1)}>
                  Back
                </Button>
              )}
              <Button
                size="default"
                className="min-w-[80px]"
                onClick={() => { if (step < TOTAL - 1) setStep(s => s + 1); else close(); }}
              >
                {step === TOTAL - 1 ? 'Got it' : 'Next'}
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
