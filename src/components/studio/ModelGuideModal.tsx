import { Lightbulb, CheckCircle2, XCircle, X } from 'lucide-react';

import fakeModelInput  from '@/assets/examples/fake-model-input.webp';
import fakeModelOutput from '@/assets/examples/fake-model-output.webp';
import realModelInput  from '@/assets/examples/real-model-input-2.webp';
import realModelOutput from '@/assets/examples/real-model-output-2.webp';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ModelGuideModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="bg-background border border-border/30 shadow-2xl max-w-md w-full mx-4 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div>
            <h4 className="font-display text-2xl uppercase tracking-tight">Model Guide</h4>
            <p className="text-muted-foreground text-sm mt-0.5">Fake models give fake results.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center border border-border/40 hover:bg-foreground/5 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-3">
          <div className="border border-border/30 flex flex-col overflow-hidden">

            <div className="px-4 pt-3 pb-2">
              <div className="grid grid-cols-2 gap-4">

                {/* Fake model */}
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-destructive">
                    <XCircle className="h-3 w-3 shrink-0" /> Fake model
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[fakeModelInput, fakeModelOutput].map((src, i) => (
                      <div key={i} className="relative aspect-square overflow-hidden border border-destructive/20 bg-muted/20">
                        <img src={src} alt="" draggable={false} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real photo */}
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-formanova-success">
                    <CheckCircle2 className="h-3 w-3 shrink-0" /> Real photo
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[realModelInput, realModelOutput].map((src, i) => (
                      <div key={i} className="relative aspect-square overflow-hidden border border-formanova-success/20 bg-muted/20">
                        <img src={src} alt="" draggable={false} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Tip */}
            <div className="px-4 pt-2 pb-3 flex items-start gap-2 flex-shrink-0">
              <Lightbulb className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">Pro Tip:</span> Make sure your model is not already wearing the same type of jewelry you want to add.
              </p>
            </div>

          </div>
        </div>

        <div className="pb-4" />

      </div>
    </div>
  );
}
