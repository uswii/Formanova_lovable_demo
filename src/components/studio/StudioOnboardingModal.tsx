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
  { title: 'Without a body, scale breaks' },
  { title: 'Screenshots and packed shots fail too' },
  { title: 'Fake looking models, fake looking results' },
  { title: 'Low quality input, low quality result' },
] as const;

const TOTAL = STEPS.length;

// ─── Shared clickable image cell ──────────────────────────────────────────────

function Img({
  src, alt, h = 'h-48', onZoom,
}: { src: string; alt: string; h?: string; onZoom: (s: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onZoom(src)}
      className={`${h} w-full overflow-hidden border border-border/30 bg-muted/10 block focus:outline-none`}
    >
      <img src={src} alt={alt} className="w-full h-full object-contain" />
    </button>
  );
}

// ─── Step 1: Do / Don't side by side ─────────────────────────────────────────

function Step1({ onZoom }: { onZoom: (s: string) => void }) {
  return (
    <div className="space-y-3">
      {/* Labels row */}
      <div className="grid grid-cols-2 gap-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-formanova-success">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Do this
        </p>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-destructive">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          Avoid this
        </p>
      </div>

      {/* Image container — fixed height, same as all other steps */}
      <div className="h-[200px] grid grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-3 h-full">
          {[ringA1, earringA1, watchA1, braceletA1].map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onZoom(src)}
              className="h-full w-full overflow-hidden border border-formanova-success/20 bg-muted/10 focus:outline-none"
            >
              <img src={src} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 h-full">
          {[ringN1, earringN1, watchN1, braceletN1].map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onZoom(src)}
              className="h-full w-full overflow-hidden border border-destructive/20 bg-muted/10 focus:outline-none"
            >
              <img src={src} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
      </div>

      {/* Text below */}
      <div className="grid grid-cols-2 gap-4">
        <ul className="space-y-1">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground leading-relaxed">Clear, even or diffuse light</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground leading-relaxed">HD resolution, sharp focus</span>
          </li>
        </ul>
        <p className="text-xs text-justify text-muted-foreground leading-relaxed">
          Without a body reference, AI guesses scale. Proportions become unreliable.
        </p>
      </div>
    </div>
  );
}

// ─── Step 2: Scale consequence ────────────────────────────────────────────────

function Step2({ onZoom }: { onZoom: (s: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="h-[200px] grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2 h-full">
          <Img src={scaleBefore} alt="Input: earrings not worn" onZoom={onZoom} h="h-full" />
          <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase shrink-0">
            Input: earrings not worn
          </p>
        </div>
        <div className="flex flex-col gap-2 h-full">
          <Img src={scaleAfter} alt="Output: proportions are off" onZoom={onZoom} h="h-full" />
          <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase shrink-0">
            Output: proportions are off
          </p>
        </div>
      </div>
      <p className="text-sm text-justify text-muted-foreground leading-relaxed">
        Worn jewelry is how the AI understands real-world scale, fit, and proportions.
        The output looks visually pretty but the proportions are wrong.
      </p>
    </div>
  );
}

// ─── Step 3: Screenshots + multiple ──────────────────────────────────────────

function Step3({ onZoom }: { onZoom: (s: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="h-[200px] grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2 h-full">
          <Img src={screenshotExample} alt="Social media screenshot" onZoom={onZoom} h="h-full" />
          <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase shrink-0">
            Social media screenshot
          </p>
        </div>
        <div className="flex flex-col gap-2 h-full">
          <Img src={multipleAndPacked} alt="Multiple and packed jewelry" onZoom={onZoom} h="h-full" />
          <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase shrink-0">
            Multiple or packed jewelry
          </p>
        </div>
      </div>
      <p className="text-sm text-justify text-muted-foreground leading-relaxed">
        Input similar to these may change your design in unpredictable ways.
      </p>
    </div>
  );
}

// ─── Step 4: Synthetic vs realistic model ────────────────────────────────────

function Step4({ onZoom }: { onZoom: (s: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="h-[200px] grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-2 h-full">
          <Img src={syntheticBefore} alt="Synthetic model" onZoom={onZoom} h="h-full" />
          <p className="text-[9px] text-center font-mono tracking-widest text-destructive uppercase shrink-0">Synthetic in</p>
        </div>
        <div className="flex flex-col gap-2 h-full">
          <Img src={syntheticAfter} alt="Synthetic output" onZoom={onZoom} h="h-full" />
          <p className="text-[9px] text-center font-mono tracking-widest text-muted-foreground uppercase shrink-0">Synthetic out</p>
        </div>
        <div className="flex flex-col gap-2 h-full">
          <Img src={realisticBefore} alt="Realistic model" onZoom={onZoom} h="h-full" />
          <p className="text-[9px] text-center font-mono tracking-widest text-formanova-success uppercase shrink-0">Realistic in</p>
        </div>
        <div className="flex flex-col gap-2 h-full">
          <Img src={realisticAfter} alt="Realistic output" onZoom={onZoom} h="h-full" />
          <p className="text-[9px] text-center font-mono tracking-widest text-muted-foreground uppercase shrink-0">Realistic out</p>
        </div>
      </div>
      <p className="text-sm text-justify text-muted-foreground leading-relaxed">
        Submit a synthetic or illustrated model and the output will match that style. Submit a
        real photo and the output will be photorealistic. Upload with intention.
      </p>
      <div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-3.5">
        <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <p className="text-xs leading-relaxed text-foreground">
          Make sure your model is not already wearing the jewelry type you are shooting for.
        </p>
      </div>
    </div>
  );
}

// ─── Step 5: Low quality in / low quality out ─────────────────────────────────

function Step5() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-justify text-foreground leading-relaxed">
        We cannot guarantee quality output for inputs that do not follow these guidelines.
        Low-quality inputs produce low-quality results, and inputs we do not recommend may
        produce unpredictable results.
      </p>
      <p className="text-sm text-justify text-muted-foreground leading-relaxed">
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
        <DialogContent className="max-w-2xl w-full shadow-none p-0 flex flex-col overflow-hidden gap-0" onKeyDown={handleKey}>

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
          <div className="px-6 py-5 h-[360px] overflow-y-auto">
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
