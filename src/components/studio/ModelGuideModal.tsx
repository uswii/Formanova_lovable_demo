import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';

import syntheticBefore from '@/assets/examples/synthetic-before.webp';
import syntheticAfter  from '@/assets/examples/synthetic-after.webp';
import realisticBefore from '@/assets/examples/realistic-model-input.webp';
import realisticAfter  from '@/assets/examples/realistic-output.webp';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ModelGuideModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-full shadow-none p-0 flex flex-col max-h-[90vh] overflow-hidden gap-0">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
            Model guide
          </p>
          <DialogTitle className="font-display text-xl sm:text-2xl tracking-wide [text-shadow:none]">
            Fake looking models produce fake looking results
          </DialogTitle>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-justify text-sm leading-relaxed text-muted-foreground">
            Submit a synthetic or illustrated model and the output will match that style. Submit a
            real photo and the output will be photorealistic. The lighting and mood of your model
            carry through to the result. Upload with intention.
          </p>

          <div className="border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              Synthetic input
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="overflow-hidden border border-border/30 bg-muted/20">
                  <img src={syntheticBefore} alt="Input: synthetic model" className="w-full object-cover" />
                </div>
                <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
                  Input: synthetic model
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="overflow-hidden border border-border/30 bg-muted/20">
                  <img src={syntheticAfter} alt="Output: synthetic-style, not photorealistic" className="w-full object-cover" />
                </div>
                <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
                  Output: synthetic-style, not photorealistic
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-justify leading-relaxed text-muted-foreground">
              A synthetic or illustration-style model produces output in that same style. It will not look photorealistic.
            </p>
          </div>

          <div className="border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-formanova-success" />
              Realistic input
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="overflow-hidden border border-border/30 bg-muted/20">
                  <img src={realisticBefore} alt="Input: realistic model photo" className="w-full object-cover" />
                </div>
                <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
                  Input: realistic model photo
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="overflow-hidden border border-border/30 bg-muted/20">
                  <img src={realisticAfter} alt="Output: realistic-looking result" className="w-full object-cover" />
                </div>
                <p className="text-[10px] text-center font-mono tracking-widest text-muted-foreground uppercase">
                  Output: realistic-looking result
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-justify leading-relaxed text-muted-foreground">
              A real, well-lit model photo gives the AI what it needs to produce a realistic-looking, natural result.
            </p>
          </div>

          <div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-4">
            <Lightbulb className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <p className="text-sm leading-relaxed text-foreground">
              Make sure your model is not already wearing the jewelry type you are shooting for.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end shrink-0">
          <Button size="sm" onClick={onClose}>Got it</Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
