import { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Diamond, ImagePlus } from "lucide-react";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import { useEstimatedCost } from "@/hooks/use-estimated-cost";
import { SKETCH_TO_CAD_WORKFLOW } from "@/lib/sketch-to-cad-workflows";

interface SketchUploadScreenProps {
  sketchFile: File | null;
  previewUrl: string | null;
  isGenerating: boolean;
  description: string;
  onDescriptionChange: (d: string) => void;
  onSketchSelect: (file: File) => void;
  onGenerate: () => void;
  creditBlock?: React.ReactNode;
}

export default function SketchUploadScreen({
  sketchFile,
  previewUrl,
  isGenerating,
  description,
  onDescriptionChange,
  onSketchSelect,
  onGenerate,
  creditBlock,
}: SketchUploadScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { cost: estimatedCost, loading: costLoading } = useEstimatedCost({ workflowName: SKETCH_TO_CAD_WORKFLOW });

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    onSketchSelect(file);
  }, [onSketchSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && sketchFile && !isGenerating) onGenerate();
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background" onKeyDown={handleKeyDown} tabIndex={-1}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[680px] px-6"
      >
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl md:text-5xl tracking-[0.2em] text-foreground uppercase mb-2">
            Sketch to 3D
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground tracking-[0.15em] uppercase">
            Upload a jewelry sketch to generate a 3D model
          </p>
        </div>

        {/* Drop zone / Preview */}
        <div
          className={`relative mb-3 border-2 border-dashed transition-colors duration-200 ${
            sketchFile
              ? "border-primary/40 bg-muted/10"
              : "border-border hover:border-foreground/30 bg-muted/10 cursor-pointer"
          }`}
          style={{ minHeight: 220 }}
          onClick={() => !sketchFile && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleInputChange}
          />

          {previewUrl ? (
            <div className="relative flex items-center justify-center p-4">
              <img
                src={previewUrl}
                alt="Sketch preview"
                className="max-h-[320px] max-w-full object-contain"
              />
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground bg-card/90 border border-border px-3 py-1.5 transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <div className="w-16 h-16 border border-border flex items-center justify-center">
                <ImagePlus className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 text-center">
                Drop your sketch here, or click to browse
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/40 text-center">
                PNG, JPG, WEBP
              </p>
            </div>
          )}
        </div>

        {/* Optional description */}
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional: describe the sketch or add specific requirements (e.g. add diamond accents, rose gold finish)"
          rows={2}
          className="w-full mb-3 px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 resize-none font-body leading-relaxed transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring bg-muted/20 border border-border"
        />

        {/* Credit block */}
        {creditBlock && <div className="mb-3">{creditBlock}</div>}

        {/* Generate button */}
        {!creditBlock && (
          <button
            onClick={onGenerate}
            disabled={isGenerating || !sketchFile}
            className="w-full py-4 text-[13px] font-bold uppercase tracking-[0.2em] transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isGenerating ? "Generating\u2026" : (
              <>
                <Diamond className="w-4 h-4" />
                Generate 3D Model
                <span className="inline-flex items-center gap-1 ml-1 opacity-80">
                  <span className="text-[13px] font-mono font-semibold">&le;</span>
                  <img src={creditCoinIcon} alt="" className="w-5 h-5" />
                  <span className="text-[13px] font-mono font-semibold">
                    {costLoading ? "\u2026" : (estimatedCost !== null ? estimatedCost : "\u2014")}
                  </span>
                </span>
              </>
            )}
          </button>
        )}
      </motion.div>
    </div>
  );
}
