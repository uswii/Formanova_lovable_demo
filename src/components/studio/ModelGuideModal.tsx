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
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div>
            <h4 className="font-display text-2xl uppercase tracking-tight">Model Guide</h4>
            <p className="text-muted-foreground text-sm mt-0.5">Fake looking models produce fake looking results.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center border border-border/40
                       hover:bg-foreground/5 transition-colors flex-shrink-0"
            aria-label="Close guide"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">

          {/* Synthetic */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-destructive">
              <XCircle className="h-3 w-3 shrink-0" />
              Synthetic input
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={syntheticBefore} alt="Input: synthetic model" draggable={false} className="w-full h-full object-cover" />
                </div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Input: synthetic model</p>
              </div>
              <div className="space-y-1">
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={syntheticAfter} alt="Output: synthetic-style, not photorealistic" draggable={false} className="w-full h-full object-cover" />
                </div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Output: synthetic-style, not photorealistic</p>
              </div>
            </div>
          </div>

          {/* Realistic */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-formanova-success">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              Realistic input
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={realisticBefore} alt="Input: realistic model photo" draggable={false} className="w-full h-full object-cover" />
                </div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Input: realistic model photo</p>
              </div>
              <div className="space-y-1">
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={realisticAfter} alt="Output: realistic-looking result" draggable={false} className="w-full h-full object-cover" />
                </div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Output: realistic-looking result</p>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2">
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
