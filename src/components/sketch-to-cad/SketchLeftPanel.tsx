import { useRef, useCallback } from "react";
import { ImagePlus } from "lucide-react";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import { useEstimatedCost } from "@/hooks/use-estimated-cost";
import { SKETCH_TO_CAD_WORKFLOW } from "@/lib/sketch-to-cad-workflows";

interface SketchLeftPanelProps {
  previewUrl: string | null;
  description: string;
  onDescriptionChange: (d: string) => void;
  isGenerating: boolean;
  hasModel: boolean;
  onRegenerate: () => void;
  onNewSketch: (file: File) => void;
  onGlbUpload: (file: File) => void;
  onReset?: () => void;
  creditBlock?: React.ReactNode;
}

export default function SketchLeftPanel({
  previewUrl,
  description,
  onDescriptionChange,
  isGenerating,
  hasModel,
  onRegenerate,
  onNewSketch,
  onGlbUpload,
  onReset,
  creditBlock,
}: SketchLeftPanelProps) {
  const sketchInputRef = useRef<HTMLInputElement>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);
  const { cost: estimatedCost, loading: costLoading } = useEstimatedCost({ workflowName: SKETCH_TO_CAD_WORKFLOW });

  const handleSketchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) onNewSketch(file);
    e.target.value = '';
  }, [onNewSketch]);

  const handleGlbInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onGlbUpload(file);
    e.target.value = '';
  }, [onGlbUpload]);

  return (
    <div className="flex flex-col bg-card border-r border-border h-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 lg:px-6 pt-6 pb-5 border-b border-border min-w-0">
        <h1 className="font-display text-xl lg:text-2xl tracking-[0.15em] text-foreground uppercase truncate">
          Sketch to 3D
        </h1>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-6 scrollbar-thin min-w-0"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Sketch thumbnail */}
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Sketch
          </h3>
          <div className="relative border border-border bg-muted/10 overflow-hidden" style={{ minHeight: 120 }}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Your sketch"
                className="w-full object-contain max-h-[200px]"
              />
            ) : (
              <div className="flex items-center justify-center h-24">
                <ImagePlus className="w-6 h-6 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <input
            ref={sketchInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSketchInput}
          />
          <button
            onClick={() => sketchInputRef.current?.click()}
            className="mt-2 w-full font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 py-2 transition-colors"
          >
            Upload New Sketch
          </button>
        </section>

        {/* Description */}
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Description
          </h3>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Optional hints (e.g. rose gold, add diamond accents)"
            rows={3}
            disabled={isGenerating}
            className="w-full px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 resize-none font-body leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring bg-muted/20 border border-border disabled:opacity-50"
          />
        </section>

        {/* Credit block */}
        {creditBlock && <div>{creditBlock}</div>}

        {/* Regenerate */}
        {!creditBlock && (
          <section>
            <button
              onClick={onRegenerate}
              disabled={isGenerating || !previewUrl}
              className="w-full py-3 text-[11px] font-bold uppercase tracking-[0.2em] transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isGenerating ? "Generating\u2026" : (
                <>
                  Regenerate
                  <span className="inline-flex items-center gap-1 opacity-80">
                    <span className="font-mono font-semibold">&le;</span>
                    <img src={creditCoinIcon} alt="" className="w-4 h-4" />
                    <span className="font-mono font-semibold">
                      {costLoading ? "\u2026" : (estimatedCost !== null ? estimatedCost : "\u2014")}
                    </span>
                  </span>
                </>
              )}
            </button>
          </section>
        )}

        {/* Load GLB part */}
        <section>
          <input
            ref={glbInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={handleGlbInput}
          />
          <button
            onClick={() => glbInputRef.current?.click()}
            className="w-full font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 py-2 transition-colors"
          >
            Load GLB / Merge Part
          </button>
        </section>

        {/* Reset */}
        {onReset && hasModel && (
          <section>
            <button
              onClick={onReset}
              className="w-full font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 hover:text-foreground py-2 transition-colors"
            >
              Reset Model
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
