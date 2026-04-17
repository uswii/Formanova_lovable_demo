import { useRef, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, X, Maximize2 } from "lucide-react";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import { useEstimatedCost } from "@/hooks/use-estimated-cost";

import cadExample1 from "@/assets/examples/cad-example-1.webp";
import cadExample2 from "@/assets/examples/cad-example-2.webp";
import cadExample3 from "@/assets/examples/cad-example-3.webp";
import cadExample4 from "@/assets/examples/cad-example-4.webp";

const EXAMPLE_DESIGNS = [
  {
    image: cadExample1,
    prompt: "Oval center stone with ball-tip prong setting, flanked by marquise side stones and small round accent clusters, tapered rounded band",
  },
  {
    image: cadExample2,
    prompt: "Asymmetric botanical ring with two large leaf forms rising from a split flowing band, small round center stone nestled between the leaves, accent stones along leaf edges",
  },
  {
    image: cadExample3,
    prompt: "Large oval center stone in four-prong setting surrounded by round halo, split shank band with accent stones running along each shank",
  },
  {
    image: cadExample4,
    prompt: "Wide dome cluster ring, oval center stone surrounded by six oval accents, filigree openwork shoulders",
  },
];

interface ImagePromptScreenProps {
  model: string;
  prompt: string;
  setPrompt: (p: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  creditBlock?: React.ReactNode;
  referenceImagePreviewUrl: string | null;
  onReferenceImageChange: (file: File | null, previewUrl: string | null) => void;
  onGlbUpload?: (file: File) => void;
}

export default function ImagePromptScreen({
  model, prompt, setPrompt,
  isGenerating, onGenerate, creditBlock,
  referenceImagePreviewUrl, onReferenceImageChange,
  onGlbUpload,
}: ImagePromptScreenProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredExample, setHoveredExample] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeWorkflow = referenceImagePreviewUrl ? 'sketch_generate_v1' : 'ring_generate_v1';
  const { cost: estimatedCost, loading: costLoading } = useEstimatedCost({ workflowName: activeWorkflow, model });

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const prevUrl = referenceImagePreviewUrl;
    const url = URL.createObjectURL(file);
    if (prevUrl?.startsWith("blob:")) URL.revokeObjectURL(prevUrl);
    onReferenceImageChange(file, url);
  }, [referenceImagePreviewUrl, onReferenceImageChange]);

  const handleImageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = "";
  }, [handleImageFile]);

  const handleClearImage = useCallback(() => {
    if (referenceImagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(referenceImagePreviewUrl);
    onReferenceImageChange(null, null);
  }, [referenceImagePreviewUrl, onReferenceImageChange]);

  const handleExampleClick = useCallback(async (example: typeof EXAMPLE_DESIGNS[0]) => {
    setPrompt(example.prompt);
    try {
      const res = await fetch(example.image);
      const blob = await res.blob();
      const file = new File([blob], "example-ring.webp", { type: "image/webp" });
      const url = URL.createObjectURL(file);
      if (referenceImagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(referenceImagePreviewUrl);
      onReferenceImageChange(file, url);
    } catch {
      // image load failed -- just set prompt
    }
  }, [setPrompt, referenceImagePreviewUrl, onReferenceImageChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canGenerate && !isGenerating) onGenerate();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [prompt]);

  const canGenerate = !!referenceImagePreviewUrl;

  return (
    <div className="flex-1 flex items-center justify-center bg-background overflow-y-auto">
      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && referenceImagePreviewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={referenceImagePreviewUrl}
              alt="Reference ring full view"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
            >
              <X className="w-4 h-4 text-foreground/70" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[680px] px-4 sm:px-6 py-6"
      >
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl md:text-5xl tracking-[0.2em] text-foreground uppercase mb-2">
            Generate 3D Ring
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground tracking-[0.15em] uppercase">
            Upload a photo or sketch of your design
          </p>
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInputChange} />

        {/* Image drop zone — primary */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !referenceImagePreviewUrl && imageInputRef.current?.click()}
          className={`relative w-full border border-dashed flex items-center justify-center transition-all duration-200 mb-3 ${
            referenceImagePreviewUrl
              ? "border-border/40 bg-muted/10"
              : isDragging
                ? "border-foreground/40 bg-foreground/5"
                : "border-border/40 hover:border-foreground/40 hover:bg-foreground/5"
          } ${!referenceImagePreviewUrl ? "cursor-pointer" : ""}`}
          style={{ minHeight: 240 }}
        >
          {referenceImagePreviewUrl ? (
            <>
              <img
                src={referenceImagePreviewUrl}
                alt="Reference ring"
                className="w-full object-contain p-3"
                style={{ maxHeight: 320 }}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleClearImage(); }}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                aria-label="Remove image"
              >
                <X className="w-3 h-3 text-foreground/70" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                className="absolute top-2 right-10 w-6 h-6 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                aria-label="Expand image"
              >
                <Maximize2 className="w-3 h-3 text-foreground/70" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); imageInputRef.current?.click(); }}
                className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 hover:text-foreground transition-colors bg-card/70 px-1.5 py-0.5 cursor-pointer"
              >
                Change
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center px-6 py-10">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                <div className="absolute inset-0 rounded-full bg-primary/5 border-2 border-primary/20 flex items-center justify-center">
                  <Diamond className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <p className="font-display text-lg tracking-[0.15em] text-foreground uppercase">
                  Drop your ring image here
                </p>
                <p className="font-mono text-[10px] text-muted-foreground mt-1.5 tracking-wide">
                  Drag &amp; drop · click to browse
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Text prompt — secondary */}
        <div className={`relative mb-3 transition-opacity duration-200 ${referenceImagePreviewUrl ? "opacity-100" : "opacity-40"}`}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add optional description"
            rows={2}
            className="w-full min-h-[52px] max-h-[200px] px-5 py-2.5 pb-7 text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none font-body leading-relaxed transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring bg-muted/20 border border-dashed border-border/40 overflow-y-auto"
          />
          {prompt.length > 0 && (
            <button
              onClick={() => { setPrompt(""); textareaRef.current?.focus(); }}
              className="absolute bottom-2.5 right-5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors duration-150 cursor-pointer z-10"
            >
              Clear
            </button>
          )}
        </div>

        {/* Credit block */}
        {creditBlock && <div className="mb-3">{creditBlock}</div>}

        {/* Generate button */}
        {!creditBlock && (
          <button
            onClick={onGenerate}
            disabled={isGenerating || !canGenerate}
            className="w-full py-4 text-[13px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isGenerating ? "Generating…" : (
              <>
                Generate 3D Ring
                <span className="inline-flex items-center gap-1 ml-1 opacity-80">
                  <span className="text-[13px] font-mono font-semibold">≤</span>
                  <img src={creditCoinIcon} alt="" className="w-5 h-5" />
                  <span className="text-[13px] font-mono font-semibold">{costLoading ? '…' : (estimatedCost !== null ? estimatedCost : '—')}</span>
                </span>
              </>
            )}
          </button>
        )}

        {/* Example designs */}
        <div className="mt-6">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Try an example
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {EXAMPLE_DESIGNS.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(ex)}
                onMouseEnter={() => setHoveredExample(i)}
                onMouseLeave={() => setHoveredExample(null)}
                className="relative aspect-square border border-border hover:border-foreground/20 overflow-hidden transition-all duration-150 bg-muted/10"
              >
                <img src={ex.image} alt={`Ring example ${i + 1}`} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-background/85 flex items-center justify-center p-3 transition-opacity duration-200 ${hoveredExample === i ? 'opacity-100' : 'opacity-0'}`}>
                  <p className="font-mono text-[10px] text-foreground/80 leading-[1.6] text-center">{ex.prompt}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upload GLB — gated */}
        {onGlbUpload && (
          <div className="mt-4 text-center">
            <input
              ref={glbInputRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onGlbUpload(f); e.target.value = ""; }}
            />
            <button
              onClick={() => glbInputRef.current?.click()}
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer underline underline-offset-4 decoration-border hover:decoration-foreground"
            >
              Or upload a CAD file (.glb)
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
