import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';

import psDimInput               from '@/assets/examples/ps-lighting-dim-input.webp';
import psDimResult              from '@/assets/examples/ps-lighting-dim-result.webp';
import psBrightInput            from '@/assets/examples/ps-lighting-bright-input.webp';
import psBrightResult           from '@/assets/examples/ps-lighting-bright-result.webp';
import psBlurInput              from '@/assets/examples/ps-blur-input.webp';
import psBlurResult             from '@/assets/examples/ps-blur-result.webp';
import psBlurClearInput         from '@/assets/examples/ps-blur-clear-input.webp';
import psBlurClearResult        from '@/assets/examples/ps-blur-clear-result.webp';
import screenshotExample        from '@/assets/examples/screenshot.webp';
import multipleAndPacked        from '@/assets/examples/multile-and-packed.webp';

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Your photo in. Product shot out.' },
  { title: 'Lighting affects your jewelry' },
  { title: 'Blur in, blur out' },
  { title: 'Avoid these inputs' },
  { title: 'You are ready' },
] as const;

const TOTAL = STEPS.length;

// ─── Shared image cell ────────────────────────────────────────────────────────

function Img({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className="aspect-square w-full overflow-hidden border border-border/30 bg-muted/10">
      <img src={src} alt={alt} className={`w-full h-full object-contain ${className}`} />
    </div>
  );
}

// ─── Step 0: Intro ────────────────────────────────────────────────────────────

function Step0() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <p className="font-display text-xl sm:text-3xl tracking-wide leading-tight">YOUR PHOTO IN. PRODUCT SHOT OUT.</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Here's how to get the best results from FormaNova
      </p>
    </div>
  );
}

// ─── Step 1: Lighting ─────────────────────────────────────────────────────────

function Step1() {
  return (
    <div className="flex flex-col gap-5 h-full">
      <p className="font-display text-2xl sm:text-3xl tracking-wide leading-tight text-center">
        LIGHTING AFFECTS YOUR JEWELRY
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Dim */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 h-8">
            <XCircle className="h-6 w-6 text-destructive shrink-0" />
            <span className="text-sm font-semibold uppercase tracking-widest text-destructive">Dim light</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Img src={psDimInput} alt="Dim input" className="brightness-75" />
            <Img src={psDimResult} alt="Dim result" />
          </div>
          <p className="text-xs text-center text-muted-foreground">Dark in. Dark out.</p>
        </div>
        {/* Bright */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 h-8">
            <CheckCircle2 className="h-6 w-6 text-formanova-success shrink-0" />
            <span className="text-sm font-semibold uppercase tracking-widest text-formanova-success">Bright light</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Img src={psBrightInput} alt="Bright input" />
            <Img src={psBrightResult} alt="Bright result" />
          </div>
          <p className="text-xs text-center text-muted-foreground">Bright in. Sharp out.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Blur ─────────────────────────────────────────────────────────────

function Step2() {
  return (
    <div className="flex flex-col gap-5 h-full">
      <p className="font-display text-2xl sm:text-3xl tracking-wide leading-tight text-center">
        BLUR CHANGES YOUR DESIGN
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Blurry */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 h-8">
            <XCircle className="h-6 w-6 text-destructive shrink-0" />
            <span className="text-sm font-semibold uppercase tracking-widest text-destructive">Blurry photo</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Img src={psBlurInput} alt="Blurry input" className="blur-[3px]" />
            <Img src={psBlurResult} alt="Blurry result" />
          </div>
          <p className="text-xs text-center text-muted-foreground">Blurry in. Wrong design out.</p>
        </div>
        {/* Sharp */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 h-8">
            <CheckCircle2 className="h-6 w-6 text-formanova-success shrink-0" />
            <span className="text-sm font-semibold uppercase tracking-widest text-formanova-success">Sharp photo</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Img src={psBlurClearInput} alt="Sharp input" />
            <Img src={psBlurClearResult} alt="Sharp result" />
          </div>
          <p className="text-xs text-center text-muted-foreground">Clear photo. Correct design out.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Avoid these inputs ───────────────────────────────────────────────

function Step3() {
  return (
    <div className="flex flex-col gap-5 h-full">
      <p className="font-display text-2xl sm:text-3xl tracking-wide leading-tight text-center">
        AVOID THESE INPUTS
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Screenshot */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 h-8">
            <XCircle className="h-6 w-6 text-destructive shrink-0" />
            <span className="text-sm font-semibold uppercase tracking-widest text-destructive">Screenshot</span>
          </div>
          <Img src={screenshotExample} alt="Social media screenshot" />
          <p className="text-xs text-center text-muted-foreground">UI noise. Wrong output.</p>
        </div>
        {/* Packaged */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 h-8">
            <XCircle className="h-6 w-6 text-destructive shrink-0" />
            <span className="text-sm font-semibold uppercase tracking-widest text-destructive">Packaged / bundle</span>
          </div>
          <Img src={multipleAndPacked} alt="Multiple and packed jewelry" />
          <p className="text-xs text-center text-muted-foreground">Bundles confuse the AI.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Ready ────────────────────────────────────────────────────────────

function Step4({ checked, onCheck, shake }: { checked: boolean; onCheck: () => void; shake: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-2">
      <p className="font-display text-xl sm:text-3xl tracking-wide leading-tight">You are ready</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Thanks for reading. Now go get some great product shots.
      </p>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onCheck}
          className={`inline-flex items-start gap-3 focus:outline-none group ${shake ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}
        >
          <div className={`mt-0.5 h-5 w-5 shrink-0 border-2 flex items-center justify-center transition-colors ${checked ? 'bg-primary border-primary' : shake ? 'bg-background border-destructive' : 'bg-background border-foreground group-hover:border-primary'}`}>
            {checked && (
              <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className={`text-sm font-semibold leading-snug ${shake && !checked ? 'text-destructive' : 'text-foreground'}`}>
            I understand bad photos give bad results.
          </span>
        </button>
        <p className={`text-xs text-destructive transition-opacity duration-200 ${shake && !checked ? 'opacity-100' : 'opacity-0'}`}>
          Please confirm to continue.
        </p>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProductShotGuideModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => {
    setStep(0);
    setChecked(false);
    setShake(false);
    onClose();
  };

  const triggerShake = () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShake(true);
    shakeTimer.current = setTimeout(() => setShake(false), 1200);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && step < TOTAL - 1) setStep(s => s + 1);
    if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
    if (e.key === 'Enter' && step === TOTAL - 1) close();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-2xl max-h-[100dvh] shadow-none p-0 flex flex-col overflow-hidden gap-0 [&>button:last-of-type]:hidden"
        onKeyDown={handleKey}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border shrink-0">
          <DialogTitle className="sr-only">{STEPS[step].title}</DialogTitle>
          <span className="font-mono text-sm text-muted-foreground ml-auto">
            {step + 1} / {TOTAL}
          </span>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 h-[540px] max-h-[calc(100dvh-10rem)] min-h-[320px] overflow-hidden">
          {step === 0 && <Step0 />}
          {step === 1 && <Step1 />}
          {step === 2 && <Step2 />}
          {step === 3 && <Step3 />}
          {step === 4 && <Step4 checked={checked} onCheck={() => setChecked(c => !c)} shake={shake} />}
        </div>

        {/* Tip — reserved space, invisible unless needed */}
        <div className="px-4 sm:px-6 -mt-px flex items-start gap-3 border-y py-3 border-transparent">
          <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 invisible" />
          <p className="text-xs leading-relaxed invisible">placeholder</p>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex items-center justify-end gap-4 shrink-0">
          {step > 0 && (
            <Button variant="ghost" size="default" className="min-w-[130px]" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          <Button
            size="default"
            className="min-w-[130px]"
            onClick={() => {
              if (step < TOTAL - 1) setStep(s => s + 1);
              else if (!checked) triggerShake();
              else close();
            }}
          >
            {step === TOTAL - 1 ? "Let's go" : step === 0 ? 'Show me' : 'Next'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
