import { X, Lightbulb, CheckCircle2, XCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="bg-background border border-border/30 shadow-2xl max-w-md w-full mx-4 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/30 flex-shrink-0">
          <div>
            <h4 className="font-display text-2xl uppercase tracking-tight">Model Guide</h4>
            <p className="text-muted-foreground text-sm mt-0.5">Fake looking models produce fake looking results.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center border border-border/40 hover:bg-foreground/5 transition-colors flex-shrink-0"
            aria-label="Close guide"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">

          {/* All 4 images — same grid as upload guide */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { src: syntheticBefore, label: 'Synthetic input',  caption: 'Input: synthetic model',              color: 'text-destructive',        icon: <XCircle className="h-3 w-3 shrink-0" /> },
              { src: syntheticAfter,  label: 'Synthetic output', caption: 'Output: not photorealistic',          color: 'text-muted-foreground',    icon: null },
              { src: realisticBefore, label: 'Realistic input',  caption: 'Input: realistic model photo',        color: 'text-formanova-success',   icon: <CheckCircle2 className="h-3 w-3 shrink-0" /> },
              { src: realisticAfter,  label: 'Realistic output', caption: 'Output: realistic-looking result',    color: 'text-muted-foreground',    icon: null },
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

          {/* Tip */}
          <div className="flex items-start gap-2 pt-1">
            <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Make sure your model is not already wearing the jewelry type you are shooting for.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
