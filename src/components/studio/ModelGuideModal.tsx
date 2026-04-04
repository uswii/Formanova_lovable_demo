import { Lightbulb, CheckCircle2, XCircle } from 'lucide-react';

import syntheticBefore from '@/assets/examples/synthetic-before.webp';
import syntheticAfter  from '@/assets/examples/synthetic-after.webp';
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

        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
              Model input guide
            </p>
            <h4 className="font-display text-lg sm:text-2xl leading-tight tracking-wide">Fake models give fake results</h4>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 h-[calc((100vw-5rem)/2+120px)] max-h-[440px] min-h-[260px] overflow-hidden flex flex-col gap-3">

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
                  <div className="aspect-square w-full overflow-hidden border border-border/30 bg-muted/10">
                    <img src={syntheticBefore} alt="Synthetic input" draggable={false} className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Input</p>
                </div>
                <div className="space-y-1.5">
                  <div className="aspect-square w-full overflow-hidden border border-border/30 bg-muted/10">
                    <img src={syntheticAfter} alt="Synthetic output" draggable={false} className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Output</p>
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
                  <div className="aspect-square w-full overflow-hidden border border-border/30 bg-muted/10">
                    <img src={realisticBefore} alt="Realistic input" draggable={false} className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Input</p>
                </div>
                <div className="space-y-1.5">
                  <div className="aspect-square w-full overflow-hidden border border-border/30 bg-muted/10">
                    <img src={realisticAfter} alt="Realistic output" draggable={false} className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Output</p>
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

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-6 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-w-[80px]"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
}
