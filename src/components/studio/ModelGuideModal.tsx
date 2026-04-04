import { Lightbulb, CheckCircle2, XCircle } from 'lucide-react';

import fakeModelInput  from '@/assets/examples/fake-model-input.webp';
import fakeModelOutput from '@/assets/examples/fake-model-output.webp';
import syntheticBefore from '@/assets/examples/synthetic-before.webp';
import syntheticAfter  from '@/assets/examples/synthetic-after.webp';
import realModelInput  from '@/assets/examples/real-model-input-2.webp';
import realModelOutput from '@/assets/examples/real-model-output-2.webp';
import realisticBefore from '@/assets/examples/realistic-model-input.webp';
import realisticAfter  from '@/assets/examples/realistic-output.webp';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ModelGuideModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-4">
      <div className="bg-background border border-border/30 shadow-2xl w-[calc(100vw-2rem)] max-w-2xl max-h-[100dvh] flex flex-col overflow-hidden">

        {/* Header — fixed height matches StudioOnboardingModal */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-border shrink-0">
          <div className="min-w-0 h-[3rem] sm:h-[4rem] overflow-hidden">
            <h4 className="font-display text-lg sm:text-2xl leading-tight tracking-wide">
              Fake models give fake results
            </h4>
          </div>
        </div>

        {/* Content — same height formula as StudioOnboardingModal */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 h-[calc((100vw-5rem)/2+165px)] max-h-[440px] min-h-[280px] overflow-hidden">
          <div className="grid grid-cols-2 gap-3">

            {/* Fake model */}
            <div className="flex flex-col gap-2">
              <div className="min-h-[2.75rem]">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-destructive">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> Fake model
                </p>
                <p className="text-sm font-medium text-foreground leading-snug">Fake in, fake out</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[fakeModelInput, fakeModelOutput, syntheticBefore, syntheticAfter].map((src, i) => (
                  <div key={i} className="aspect-square w-full overflow-hidden border border-destructive/20 bg-muted/10">
                    <img src={src} alt="" draggable={false} className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            </div>

            {/* Real photo */}
            <div className="flex flex-col gap-2">
              <div className="min-h-[2.75rem]">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-formanova-success">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Real photo
                </p>
                <p className="text-sm font-medium text-foreground leading-snug">Real in, real out</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[realModelInput, realModelOutput, realisticBefore, realisticAfter].map((src, i) => (
                  <div key={i} className="aspect-square w-full overflow-hidden border border-formanova-success/20 bg-muted/10">
                    <img src={src} alt="" draggable={false} className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Tip — same structure as StudioOnboardingModal */}
        <div className="-mt-px flex items-start gap-3 border-y border-primary/30 bg-primary/5 px-4 sm:px-6 py-3">
          <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <p className="text-xs leading-relaxed text-foreground">
            Make sure your model is not already wearing the same type of jewelry you want to add.
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-6 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-w-[130px]"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
}
