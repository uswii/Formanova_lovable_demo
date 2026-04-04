import { Lightbulb, X } from 'lucide-react';

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

        {/* Header — identical to upload guide popup */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div>
            <h4 className="font-display text-2xl uppercase tracking-tight">Model Guide</h4>
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

        {/* Content — pixel-identical structure to UploadGuidePanel */}
        <div className="px-6 pb-6">
          <div className="border border-border/30 flex flex-col overflow-hidden">

            {/* Top label */}
            <p className="px-12 pt-3 pb-2 text-base font-bold text-foreground flex-shrink-0">
              Fake models give fake results
            </p>

            {/* Grid — px-12, grid-cols-2, gap-4, aspect-square, object-cover */}
            <div className="px-12 overflow-hidden">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { src: fakeModelInput,  border: 'border-destructive' },
                  { src: fakeModelOutput, border: 'border-destructive' },
                  { src: realModelInput,  border: 'border-green-500' },
                  { src: realModelOutput, border: 'border-green-500' },
                ].map(({ src, border }, i) => (
                  <div key={i} className={`relative aspect-square overflow-hidden border-[3px] ${border} bg-muted/20`}>
                    <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Tip — px-12, pt-2, pb-3, same as UploadGuidePanel */}
            <div className="px-12 pt-2 pb-3 flex items-start gap-2 flex-shrink-0">
              <Lightbulb className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">Pro Tip:</span> Make sure your model is not already wearing the same type of jewelry you want to add.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
