import { useRef, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Diamond, X, Maximize2, ImageIcon } from "lucide-react";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import { useEstimatedCost } from "@/hooks/use-estimated-cost";
import { useAuth } from "@/contexts/AuthContext";
import { listMyWorkflows, fetchCadResult, type WorkflowSummary } from "@/lib/generation-history-api";
import { WorkflowCard } from "@/components/generations/WorkflowCard";
import { ScissorGLBGrid } from "@/components/generations/ScissorGLBGrid";
import CADRuntimeErrorBoundary from "@/components/cad/CADRuntimeErrorBoundary";

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
  secondReferenceImagePreviewUrl: string | null;
  onSecondReferenceImageChange: (file: File | null, previewUrl: string | null) => void;
  onGlbUpload?: (file: File) => void;
}

export default function ImagePromptScreen({
  model, prompt, setPrompt,
  isGenerating, onGenerate, creditBlock,
  referenceImagePreviewUrl, onReferenceImageChange,
  secondReferenceImagePreviewUrl, onSecondReferenceImageChange,
  onGlbUpload,
}: ImagePromptScreenProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const secondImageInputRef = useRef<HTMLInputElement>(null);
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

  const handleSecondImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    if (secondReferenceImagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(secondReferenceImagePreviewUrl);
    onSecondReferenceImageChange(file, url);
  }, [secondReferenceImagePreviewUrl, onSecondReferenceImageChange]);

  const handleClearSecondImage = useCallback(() => {
    if (secondReferenceImagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(secondReferenceImagePreviewUrl);
    onSecondReferenceImageChange(null, null);
  }, [secondReferenceImagePreviewUrl, onSecondReferenceImageChange]);

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

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (file) handleImageFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleImageFile]);

  const canGenerate = !!referenceImagePreviewUrl;

  const { user } = useAuth();
  const [historyItems, setHistoryItems] = useState<WorkflowSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setHistoryLoading(true);
    (async () => {
      try {
        const all = await listMyWorkflows(40, 0);
        const sketches = all.filter(w => w.source_type === 'cad_sketch').slice(0, 6);
        if (cancelled || sketches.length === 0) { setHistoryLoading(false); return; }
        setHistoryItems(sketches);
        setHistoryLoading(false);
        const enriched = await Promise.all(sketches.map(async w => {
          const { glb_url } = await fetchCadResult(w.workflow_id);
          const glb_filename = glb_url ? (glb_url.split('/').pop() ?? 'model.glb') : null;
          return { ...w, glb_url: glb_url ?? null, glb_filename };
        }));
        if (!cancelled) setHistoryItems(enriched);
      } catch {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

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
            Upload your inspiration image to generate
          </p>
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInputChange} />
        <input
          ref={secondImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSecondImageFile(f); e.target.value = ""; }}
        />

        {/* Image upload canvas — two cards side by side */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full mb-3 p-3 border transition-all duration-200 ${
            isDragging ? "border-primary/60 bg-primary/5" : "border-border/30 bg-muted/5"
          }`}
        >
          <div className="grid grid-cols-2 gap-3">

            {/* Primary card — front view */}
            <div
              onClick={() => !referenceImagePreviewUrl && imageInputRef.current?.click()}
              className={`relative flex items-center justify-center transition-all duration-200 border-2 ${
                referenceImagePreviewUrl
                  ? "border-primary/70 bg-muted/10"
                  : "border-primary cursor-pointer hover:bg-primary/5 bg-muted/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
              }`}
              style={{ minHeight: 200 }}
            >
              {referenceImagePreviewUrl ? (
                <>
                  <img
                    src={referenceImagePreviewUrl}
                    alt="Front view reference"
                    className="w-full object-contain p-2"
                    style={{ maxHeight: 220 }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearImage(); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3 text-foreground/70" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                    className="absolute top-1.5 right-9 w-6 h-6 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                    aria-label="Expand image"
                  >
                    <Maximize2 className="w-3 h-3 text-foreground/70" />
                  </button>
                  <span className="absolute bottom-1.5 right-2 font-mono text-[9px] uppercase tracking-[0.1em] text-primary/60">
                    Front view
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center text-center px-4 py-8">
                  <div className="relative mx-auto w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                    <div className="absolute inset-0 rounded-full bg-primary/5 border-2 border-primary/30 flex items-center justify-center">
                      <Diamond className="h-7 w-7 text-primary" />
                    </div>
                  </div>
                  <p className="font-display text-sm tracking-[0.1em] text-foreground uppercase mb-1">
                    Front view
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/60 mb-3">
                    Drop, paste or click
                  </p>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary/70 border border-primary/30 px-2 py-0.5">
                    Required
                  </span>
                </div>
              )}
            </div>

            {/* Secondary card — side view */}
            <div
              onClick={() => secondImageInputRef.current?.click()}
              className={`relative flex items-center justify-center transition-all duration-200 border border-dashed cursor-pointer ${
                secondReferenceImagePreviewUrl
                  ? "border-border/60 bg-muted/10"
                  : "border-border/40 hover:border-border/70 bg-muted/5 hover:bg-muted/10"
              }`}
              style={{ minHeight: 200 }}
            >
              {secondReferenceImagePreviewUrl ? (
                <>
                  <img
                    src={secondReferenceImagePreviewUrl}
                    alt="Side view reference"
                    className="w-full object-contain p-2"
                    style={{ maxHeight: 220 }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearSecondImage(); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                    aria-label="Remove side view"
                  >
                    <X className="w-3 h-3 text-foreground/70" />
                  </button>
                  <span className="absolute bottom-1.5 right-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/40">
                    Side view
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center text-center px-4 py-8">
                  <div className="w-16 h-16 mb-4 border border-dashed border-border/40 flex items-center justify-center">
                    <ImageIcon className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <p className="font-display text-sm tracking-[0.1em] text-muted-foreground/60 uppercase mb-1">
                    Side view
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/40 mb-3">
                    Improves accuracy
                  </p>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/40 border border-border/30 px-2 py-0.5">
                    Optional
                  </span>
                </div>
              )}
            </div>

          </div>
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
            className={`w-full min-h-[52px] max-h-[200px] px-5 py-2.5 pb-7 text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none font-body leading-relaxed transition-all duration-200 focus:outline-none bg-muted/20 border overflow-y-auto ${referenceImagePreviewUrl ? "border-border focus:ring-1 focus:ring-border" : "border-border/30 pointer-events-none"}`}
          />
          {prompt.length > 0 && (
            <button
              onClick={() => { setPrompt(""); textareaRef.current?.focus(); }}
              className="absolute bottom-2.5 right-8 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors duration-150 cursor-pointer z-10"
            >
              Clear
            </button>
          )}
        </div>

        {/* Credit block */}
        {creditBlock && <div className="mb-3">{creditBlock}</div>}

        {/* Generate button */}
        {!creditBlock && (
          <>
            <p className="font-mono text-[10px] text-muted-foreground/40 text-center tracking-wide mb-3">
              Results are inspired by your reference, not an exact replica
            </p>
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
          </>
        )}

        {/* Example designs */}
        <div className="mt-6">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Examples
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

        {/* Generation history */}
        {(historyLoading || historyItems.length > 0) && (
          <div className="mt-8">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Your generations
            </h3>
            {historyLoading && historyItems.length === 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {[0, 1].map(i => (
                  <div key={i} className="marta-frame p-4">
                    <div className="w-full aspect-[4/3] bg-muted/30 animate-pulse mb-3" />
                    <div className="h-8 bg-muted/20 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <CADRuntimeErrorBoundary>
                <ScissorGLBGrid>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid gap-3 md:grid-cols-2"
                  >
                    {historyItems.map((w, i) => (
                      <WorkflowCard
                        key={w.workflow_id}
                        workflow={w}
                        index={i + 1}
                        onClick={() => {}}
                      />
                    ))}
                  </motion.div>
                </ScissorGLBGrid>
              </CADRuntimeErrorBoundary>
            )}
          </div>
        )}

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
