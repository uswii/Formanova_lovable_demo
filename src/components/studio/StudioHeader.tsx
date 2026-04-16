/**
 * StudioHeader — mode switcher + step progress bar.
 *
 * Extracted from UnifiedStudio.tsx (phase 35) to reduce the page file size.
 * Has NO state of its own — all values flow in as props from UnifiedStudio.
 */

import React from 'react';
import { trackStudioModeSwitched } from '@/lib/posthog-events';

type StudioStep = 'upload' | 'model' | 'generating' | 'results';

interface StudioHeaderProps {
  currentStep: StudioStep;
  isProductShot: boolean;
  jewelryImage: string | null;
  setIsProductShot: (v: boolean) => void;
  setCurrentStep: (s: StudioStep) => void;
}

export function StudioHeader({
  currentStep,
  isProductShot,
  jewelryImage,
  setIsProductShot,
  setCurrentStep,
}: StudioHeaderProps) {
  if (currentStep === 'generating') return null;

  const stepOrder: Record<StudioStep, number> = { upload: 0, model: 1, generating: 2, results: 2 };
  const current = stepOrder[currentStep];

  const steps = [
    { step: 1, label: 'Upload', id: 'upload' as const },
    { step: 2, label: isProductShot ? 'Choose inspiration' : 'Choose model', id: 'model' as const },
    { step: 3, label: 'Results', id: 'results' as const },
  ];

  return (
    <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-3 relative z-10 flex flex-col items-center gap-3">

      {/* Mode Switcher — only for gated users */}
      {(
        <div className="flex items-center border border-formanova-hero-accent/40 shadow-[0_0_20px_-4px_hsl(var(--formanova-hero-accent)/0.3)]">
          <button
            onClick={() => { trackStudioModeSwitched('model-shot'); setIsProductShot(false); }}
            className={`w-40 py-2.5 font-mono text-xs tracking-[0.18em] uppercase font-bold text-center transition-all duration-200 ${
              !isProductShot
                ? 'bg-formanova-hero-accent text-primary-foreground'
                : 'bg-muted text-foreground/50 hover:text-foreground hover:bg-muted/80'
            }`}
          >
            Model Shot
          </button>
          <button
            onClick={() => { trackStudioModeSwitched('product-shot'); setIsProductShot(true); }}
            className={`w-40 py-2.5 font-mono text-xs tracking-[0.18em] uppercase font-bold text-center transition-all duration-200 ${
              isProductShot
                ? 'bg-formanova-hero-accent text-primary-foreground'
                : 'bg-muted text-foreground/50 hover:text-foreground hover:bg-muted/80'
            }`}
          >
            Product Shot
          </button>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1">
        {steps.map((s, index, arr) => {
          const isDone = s.step - 1 < current;
          const isActive =
            (s.id === 'results' &&
              ((currentStep as string) === 'generating' || currentStep === 'results')) ||
            currentStep === s.id;
          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => {
                  if (s.id === 'upload' && (currentStep as string) !== 'generating')
                    setCurrentStep('upload');
                  else if (s.id === 'model' && !!jewelryImage && (currentStep as string) !== 'generating')
                    setCurrentStep('model');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-all ${
                  isActive
                    ? 'text-foreground'
                    : isDone
                    ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                    : 'text-muted-foreground/40 cursor-default'
                }`}
              >
                <div
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-mono font-bold border transition-all ${
                    isActive
                      ? 'bg-foreground text-background border-foreground'
                      : isDone
                      ? 'border-foreground/40 text-foreground/60'
                      : 'border-border/30 text-muted-foreground/40'
                  }`}
                >
                  {s.step}
                </div>
                <span className="font-mono text-[10px] tracking-[0.15em] uppercase hidden sm:inline">
                  {s.label}
                </span>
              </button>
              {index < arr.length - 1 && (
                <div
                  className={`w-10 h-px mx-1 transition-colors ${
                    isDone || isActive ? 'bg-foreground/30' : 'bg-border/30'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
