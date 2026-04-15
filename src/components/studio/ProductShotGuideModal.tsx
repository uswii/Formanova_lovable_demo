import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Lightbulb, ArrowDown } from 'lucide-react';

import psClearProductExample    from '@/assets/examples/ps-clear-product-example.webp';
import psClearProductExample2   from '@/assets/examples/ps-clear-product-example-2.webp';
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
  { title: 'Upload clear product only images' },
  { title: 'Lighting affects your jewelry' },
  { title: 'Blur in, blur out' },
  { title: 'Avoid these inputs' },
  { title: 'You are ready' },
] as const;

const TOTAL = STEPS.length;

// ─── Shared column label ──────────────────────────────────────────────────────

function ColLabel({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 h-7 sm:h-8 shrink-0">
      {ok
        ? <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-formanova-success shrink-0" />
        : <XCircle      className="h-4 w-4 sm:h-5 sm:w-5 text-destructive shrink-0" />
      }
      <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-widest truncate ${ok ? 'text-formanova-success' : 'text-destructive'}`}>
        {children}
      </span>
    </div>
  );
}

// ─── Shared image slot ────────────────────────────────────────────────────────

function ImgSlot({ src, alt, imgClass = '' }: { src: string; alt: string; imgClass?: string }) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden bg-muted/10">
      <img src={src} alt={alt} className={`w-full h-full object-contain ${imgClass}`} />
    </div>
  );
}

// ─── Two-column layout with input→arrow→output ────────────────────────────────

interface PairColProps {
  ok: boolean;
  label: string;
  inputSrc: string;
  outputSrc: string;
  inputClass?: string;
  caption: string;
}

function PairCol({ ok, label, inputSrc, outputSrc, inputClass = '', caption }: PairColProps) {
  return (
    <div className={`flex flex-col gap-1 sm:gap-1.5 p-1.5 sm:p-2 border overflow-hidden ${ok ? 'border-formanova-success/40' : 'border-destructive/40'}`}>
      <ColLabel ok={ok}>{label}</ColLabel>
      <ImgSlot src={inputSrc} alt="input" imgClass={inputClass} />
      <ArrowDown className="shrink-0 mx-auto h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
      <ImgSlot src={outputSrc} alt="output" />
      <p className="text-[10px] sm:text-xs text-center text-muted-foreground shrink-0 leading-tight">{caption}</p>
    </div>
  );
}

// ─── Single-image column (no arrow) ──────────────────────────────────────────

interface SingleColProps {
  ok: boolean;
  label: string;
  src: string;
  caption: string;
}

function SingleCol({ ok, label, src, caption }: SingleColProps) {
  return (
    <div className={`flex flex-col gap-1 sm:gap-1.5 p-1.5 sm:p-2 border overflow-hidden ${ok ? 'border-formanova-success/40' : 'border-destructive/40'}`}>
      <ColLabel ok={ok}>{label}</ColLabel>
      <ImgSlot src={src} alt={label} />
      <p className="text-[10px] sm:text-xs text-center text-muted-foreground shrink-0 leading-tight">{caption}</p>
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

// ─── Step 1: Clear product only ───────────────────────────────────────────────

function Step1ClearProduct() {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 h-full">
      <p className="font-display text-xl sm:text-3xl tracking-wide leading-tight text-center shrink-0">
        WORKS BEST WITH CLEAR PRODUCT IMAGES
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
        <div className="overflow-hidden bg-muted/10">
          <img src={psClearProductExample} alt="Clear product example" className="w-full h-full object-contain" />
        </div>
        <div className="overflow-hidden bg-muted/10">
          <img src={psClearProductExample2} alt="Clear product example 2" className="w-full h-full object-contain" />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Lighting ─────────────────────────────────────────────────────────

function Step2Lighting() {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 h-full">
      <p className="font-display text-xl sm:text-3xl tracking-wide leading-tight text-center shrink-0">
        LIGHTING AFFECTS YOUR JEWELRY
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
        <PairCol
          ok={false}
          label="Dim light"
          inputSrc={psDimInput}
          outputSrc={psDimResult}
          inputClass="brightness-[0.55]"
          caption="Dim light in. Dull jewelry out."
        />
        <PairCol
          ok={true}
          label="Bright light"
          inputSrc={psBrightInput}
          outputSrc={psBrightResult}
          caption="Bright in. Sharp out."
        />
      </div>
    </div>
  );
}

// ─── Step 3: Blur ─────────────────────────────────────────────────────────────

function Step3Blur() {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 h-full">
      <p className="font-display text-xl sm:text-3xl tracking-wide leading-tight text-center shrink-0">
        BLUR CHANGES YOUR DESIGN
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
        <PairCol
          ok={false}
          label="Blurry photo"
          inputSrc={psBlurInput}
          outputSrc={psBlurResult}
          inputClass="blur-[1.8px]"
          caption="Blurry in. Wrong design out."
        />
        <PairCol
          ok={true}
          label="Clear photo"
          inputSrc={psBlurClearInput}
          outputSrc={psBlurClearResult}
          caption="Clear photo. Correct design out."
        />
      </div>
    </div>
  );
}

// ─── Step 4: Avoid these inputs ───────────────────────────────────────────────

function Step4Avoid() {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 h-full">
      <p className="font-display text-xl sm:text-3xl tracking-wide leading-tight text-center shrink-0">
        AVOID THESE INPUTS
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
        <SingleCol
          ok={false}
          label="Screenshot"
          src={screenshotExample}
          caption="UI noise. Wrong output."
        />
        <SingleCol
          ok={false}
          label="Packaged / bundle"
          src={multipleAndPacked}
          caption="Bundles confuse the AI."
        />
      </div>
    </div>
  );
}

// ─── Step 5: Ready ────────────────────────────────────────────────────────────

function Step5Ready({ checked, onCheck, shake }: { checked: boolean; onCheck: () => void; shake: boolean }) {
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
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
          <DialogTitle className="sr-only">{STEPS[step].title}</DialogTitle>
          <span className="font-mono text-sm text-muted-foreground ml-auto">
            {step + 1} / {TOTAL}
          </span>
        </div>

        {/* Content */}
        <div className="px-3 sm:px-6 py-3 sm:py-5 h-[480px] max-h-[calc(100dvh-14rem)] min-h-[280px] overflow-hidden">
          {step === 0 && <Step0 />}
          {step === 1 && <Step1ClearProduct />}
          {step === 2 && <Step2Lighting />}
          {step === 3 && <Step3Blur />}
          {step === 4 && <Step4Avoid />}
          {step === 5 && <Step5Ready checked={checked} onCheck={() => setChecked(c => !c)} shake={shake} />}
        </div>

        {/* Tip — reserved space, always invisible */}
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
