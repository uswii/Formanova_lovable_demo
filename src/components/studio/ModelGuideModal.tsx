import { X, Lightbulb } from 'lucide-react';

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
        <div className="px-6 pb-6">
          <div className="border border-border/30 flex flex-col overflow-hidden">

            {/* Synthetic row */}
            <p className="px-4 pt-3 pb-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex-shrink-0">
              Synthetic input → synthetic result
            </p>
            <div className="px-4 overflow-hidden">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="relative aspect-square overflow-hidden border border-border/30 bg-muted/20">
                    <img src={syntheticBefore} alt="Synthetic model input" draggable={false} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Input</p>
                </div>
                <div className="space-y-1">
                  <div className="relative aspect-square overflow-hidden border border-border/30 bg-muted/20">
                    <img src={syntheticAfter} alt="Synthetic output" draggable={false} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Output</p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-4 my-3 border-t border-border/20" />

            {/* Realistic row */}
            <p className="px-4 pb-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex-shrink-0">
              Real photo → photorealistic result
            </p>
            <div className="px-4 overflow-hidden">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="relative aspect-square overflow-hidden border border-border/30 bg-muted/20">
                    <img src={realisticBefore} alt="Realistic model input" draggable={false} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Input</p>
                </div>
                <div className="space-y-1">
                  <div className="relative aspect-square overflow-hidden border border-border/30 bg-muted/20">
                    <img src={realisticAfter} alt="Realistic output" draggable={false} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">Output</p>
                </div>
              </div>
            </div>

            {/* Tip */}
            <div className="px-4 pt-2 pb-3 flex items-start gap-2 flex-shrink-0">
              <Lightbulb className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">Pro Tip:</span> Make sure your model is not already wearing the jewelry type you are shooting for.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
