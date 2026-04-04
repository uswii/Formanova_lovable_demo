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
      <div className="bg-background border border-border/30 shadow-2xl w-[calc(100vw-2rem)] max-w-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
              Model input guide
            </p>
            <h4 className="font-display text-xl sm:text-2xl tracking-wide">Fake looking models, fake looking results</h4>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 h-[calc((100vw-5rem)/2+120px)] max-h-[440px] min-h-[260px] overflow-hidden space-y-4">

          <div className="grid grid-cols-4 gap-3">
            {[
              { src: syntheticBefore, label: 'Synthetic input',  caption: 'Input: synthetic model',           color: 'text-destructive',       icon: <XCircle className="h-3 w-3 shrink-0" /> },
              { src: syntheticAfter,  label: 'Synthetic output', caption: 'Output: not photorealistic',       color: 'text-muted-foreground',  icon: null },
              { src: realisticBefore, label: 'Realistic input',  caption: 'Input: realistic model photo',     color: 'text-formanova-success', icon: <CheckCircle2 className="h-3 w-3 shrink-0" /> },
              { src: realisticAfter,  label: 'Realistic output', caption: 'Output: realistic-looking result', color: 'text-muted-foreground',  icon: null },
            ].map(({ src, label, caption, color, icon }) => (
              <div key={label} className="space-y-1.5">
                <p className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest ${color}`}>
                  {icon}
                  {label}
                </p>
                <div className="aspect-square overflow-hidden border border-border/20 bg-muted/10">
                  <img src={src} alt={caption} draggable={false} className="w-full h-full object-cover" />
                </div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">{caption}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-3.5">
            <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p className="text-xs leading-relaxed text-foreground">
              Make sure your model is not already wearing the jewelry type you are shooting for.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end shrink-0">
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
