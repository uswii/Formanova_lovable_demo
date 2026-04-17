import { useRef, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Diamond, X } from "lucide-react";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import { useEstimatedCost } from "@/hooks/use-estimated-cost";
import { AI_MODELS } from "./types";

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
    prompt: "Wide dome cluster ring with central oval stone surrounded by six oval accent stones in circular arrangement, filigree openwork shoulders, thin plain band",
  },
];

interface InitialPromptScreenProps {
  model: string;
  setModel: (m: string) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onGlbUpload?: (file: File) => void;
  creditBlock?: React.ReactNode;
  referenceImagePreviewUrl: string | null;
  onReferenceImageChange: (file: File | null, previewUrl: string | null) => void;
}

export default function InitialPromptScreen({
  model, setModel, prompt, setPrompt,
  isGenerating, onGenerate, onGlbUpload, creditBlock,
  referenceImagePreviewUrl, onReferenceImageChange,
}: InitialPromptScreenProps) {
  const glbInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredExample, setHoveredExample] = useState<number | null>(null);
  const { cost: estimatedCost, loading: costLoading } = useEstimatedCost({ workflowName: 'ring_generate_v1', model });

  const handleGlbUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onGlbUpload) onGlbUpload(file);
  }, [onGlbUpload]);

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
      const canGenerate = prompt.trim() || referenceImagePreviewUrl;
      if (canGenerate && !isGenerating) onGenerate();
    }
  };

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [prompt, autoResize]);

  const canGenerate = !!(prompt.trim() || referenceImagePreviewUrl);

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[1100px] px-6"
      >
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl md:text-5xl tracking-[0.2em] text-foreground uppercase mb-2">
            Generate Ring Design
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground tracking-[0.15em] uppercase">
            Upload a photo, describe your design, or both
          </p>
        </div>

        {/* Two-column input area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 max-w-[900px] mx-auto">
          {/* Left: Image upload zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !referenceImagePreviewUrl && imageInputRef.current?.click()}
            className={`relative min-h-[160px] border flex items-center justify-center transition-all duration-200 ${
              referenceImagePreviewUrl
                ? "border-primary/40 bg-muted/10"
                : isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/20 hover:bg-accent/20 bg-muted/10"
            } ${!referenceImagePreviewUrl ? "cursor-pointer" : ""}`}
          >
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageInputChange}
            />

            {referenceImagePreviewUrl ? (
              <>
                <img
                  src={referenceImagePreviewUrl}
                  alt="Reference ring"
                  className="w-full h-full object-contain max-h-[220px] p-2"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleClearImage(); }}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3 text-foreground/70" />
                </button>
                <div className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 bg-card/70 px-1.5 py-0.5">
                  Reference image
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <span className="w-10 h-10 rounded-full border border-primary/60 flex items-center justify-center shadow-[0_0_12px_hsl(var(--primary)/0.35)] text-primary">
                  <Diamond className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    Upload or drop a photo
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground/50 mt-1 tracking-wide">
                    Sketch, photo, or reference image
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Text prompt */}
          <div className="relative min-h-[160px] flex flex-col">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your ring design — e.g. Oval solitaire with a tapered split shank and halo setting"
              rows={4}
              className="flex-1 w-full min-h-[160px] max-h-[60vh] px-5 py-4 pb-9 text-[15px] text-foreground placeholder:text-muted-foreground/40 resize-none font-body leading-relaxed transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring bg-muted/20 border border-border overflow-y-auto"
            />
            {prompt.length > 0 && (
              <button
                onClick={() => {
                  setPrompt("");
                  textareaRef.current?.focus();
                }}
                className="absolute bottom-2.5 right-5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors duration-150 cursor-pointer z-10"
                aria-label="Clear prompt"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Credit block */}
        {creditBlock && <div className="mb-3 max-w-[900px] mx-auto">{creditBlock}</div>}

        {/* Generate button */}
        {!creditBlock && (
          <div className="max-w-[900px] mx-auto">
            <button
              onClick={onGenerate}
              disabled={isGenerating || !canGenerate}
              className="w-full py-4 text-[13px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isGenerating ? "Generating…" : (
                <>
                  Generate Ring
                  <span className="inline-flex items-center gap-1 ml-1 opacity-80">
                    <span className="text-[13px] font-mono font-semibold">≤</span>
                    <img src={creditCoinIcon} alt="" className="w-5 h-5" />
                    <span className="text-[13px] font-mono font-semibold">{costLoading ? '…' : (estimatedCost !== null ? estimatedCost : '—')}</span>
                  </span>
                </>
              )}
            </button>
          </div>
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
                <img
                  src={ex.image}
                  alt={`Ring example ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className={`absolute inset-0 bg-background/85 flex items-center justify-center p-3 transition-opacity duration-200 ${hoveredExample === i ? 'opacity-100' : 'opacity-0'}`}>
                  <p className="font-mono text-[10px] text-foreground/80 leading-[1.6] text-center">
                    {ex.prompt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upload CAD File -- gated */}
        {onGlbUpload && (
          <div className="mt-4 max-w-[900px] mx-auto text-center">
            <input
              ref={glbInputRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={handleGlbUpload}
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
