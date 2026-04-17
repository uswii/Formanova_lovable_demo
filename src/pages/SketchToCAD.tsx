import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Diamond, X, Check, Loader2, Lightbulb, ImageIcon,
  ArrowRight, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { InsufficientCreditsInline } from "@/components/InsufficientCreditsInline";
import { useSketchToCadGeneration } from "@/hooks/use-sketch-to-cad-generation";
import GenerationProgress from "@/components/text-to-cad/GenerationProgress";
import { useEstimatedCost } from "@/hooks/use-estimated-cost";
import { SKETCH_TO_CAD_WORKFLOW } from "@/lib/sketch-to-cad-workflows";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import sketchExample1 from "@/assets/examples/sketch-allowed-1.webp";
import sketchExample2 from "@/assets/examples/sketch-allowed-2.webp";
import sketchExample3 from "@/assets/examples/sketch-notallowed-1.webp";
import sketchExample4 from "@/assets/examples/sketch-notallowed-2.webp";

const SKETCH_EXAMPLES = [sketchExample1, sketchExample2, sketchExample3, sketchExample4];

const CANVAS_H = "h-[500px] md:h-[640px]";

export default function SketchToCAD() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [progressStep, setProgressStep] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);
  const { cost: estimatedCost, loading: costLoading } = useEstimatedCost({ workflowName: SKETCH_TO_CAD_WORKFLOW });

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setSketchFile(file);
  }, []);

  const handleClear = useCallback(() => {
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setSketchFile(null);
    setStep("upload");
  }, []);

  const { generate, isGenerating, creditBlock, setCreditBlock } = useSketchToCadGeneration({
    onProgress: (s, retry) => {
      setProgressStep(s);
      setRetryAttempt(retry);
    },
    onSuccess: (result) => {
      navigate(`/text-to-cad?glb=${encodeURIComponent(result.glbUrl)}&workflow=${encodeURIComponent(result.workflowId)}`);
    },
    onFailed: () => {
      setProgressStep("failed");
    },
  });

  const handleGenerate = useCallback(() => {
    if (!sketchFile || isGenerating) return;
    generate(sketchFile, prompt || undefined);
  }, [sketchFile, isGenerating, prompt, generate]);

  const handleGuideImageLoad = useCallback(async (src: string) => {
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const filename = src.split('/').pop() || 'sketch.webp';
      const file = new File([blob], filename, { type: blob.type || 'image/webp' });
      handleFileSelect(file);
    } catch { /* silently ignore */ }
  }, [handleFileSelect]);

  /* ─── UPLOAD SCREEN ──────────────────────────────────────────────────────── */
  if (step === "upload") {
    return (
      <div className="min-h-[calc(100dvh-5rem)] bg-background">
        <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8">
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">

            {/* LEFT — Upload Canvas (2/3) */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div>
                <span className="marta-label block mb-1">Step 1</span>
                <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight mt-2">
                  Image to CAD
                </h1>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Upload a clear image of your ring — sketch, drawing, or reference photo
                </p>
              </div>

              {/* Empty drop zone */}
              {!sketchFile && (
                <div
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { handleFileSelect(f); return; } const url = e.dataTransfer.getData('text/plain'); if (url) handleGuideImageLoad(url); }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border border-dashed border-border/40 text-center cursor-pointer hover:border-foreground/40 hover:bg-foreground/5 transition-all flex flex-col items-center justify-center ${CANVAS_H}`}
                >
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2.5s" }} />
                    <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                      <Diamond className="h-9 w-9 text-primary" />
                    </div>
                  </div>
                  <p className="text-lg font-display font-medium mb-1.5">Drop your sketch here</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Drag &amp; drop · click to browse · paste (Ctrl+V)
                  </p>
                  <Button variant="outline" size="lg" className="gap-2 pointer-events-none">
                    <ImageIcon className="h-4 w-4" />
                    Browse sketch files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
                  />
                </div>
              )}

              {/* Uploaded preview */}
              {sketchFile && (
                <div className="space-y-4">
                  <div className={`relative border overflow-hidden flex items-center justify-center bg-muted/20 border-border/30 ${CANVAS_H}`}>
                    <img src={previewUrl ?? undefined} alt="Sketch" className="max-w-full max-h-full object-contain" />
                    <button
                      onClick={handleClear}
                      className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute top-3 left-3 px-2.5 py-1 flex items-center gap-1.5 bg-primary/10 border border-primary/20">
                      <Check className="h-3 w-3 text-primary" />
                      <span className="font-mono text-[9px] tracking-wider uppercase text-primary">Ready</span>
                    </div>
                  </div>

                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Optional: describe your design (e.g. rose gold, add diamond accents, pave setting)"
                    rows={2}
                    className="w-full px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 resize-none font-body leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring bg-muted/20 border border-border/40"
                  />

                  <div className="flex items-center justify-end">
                    <Button
                      size="lg"
                      onClick={() => setStep("review")}
                      className="gap-2.5 font-display text-base uppercase tracking-wide px-10 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — Upload Guide (1/3) */}
            <div className="flex flex-col gap-4 h-full">
              <div>
                <span className="marta-label block mb-1 invisible" aria-hidden="true">Step 1</span>
                <h3 className="font-display text-3xl md:text-4xl uppercase tracking-tight mt-2">
                  Upload Guide
                </h3>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  For best results, follow the guidelines below.
                </p>
              </div>

              <div className={`border border-border/30 flex flex-col overflow-hidden ${CANVAS_H}`}>
                <p className="px-12 pt-3 pb-2 text-lg font-bold text-foreground flex-shrink-0">
                  What makes a good sketch?
                </p>
                <div className="px-12 flex-1 overflow-hidden flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-4">
                    {SKETCH_EXAMPLES.map((src, i) => (
                      <div
                        key={i}
                        draggable
                        onClick={() => handleGuideImageLoad(src)}
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', src); e.dataTransfer.effectAllowed = 'copy'; }}
                        className="relative aspect-square overflow-hidden border border-border/30 bg-muted/20 cursor-grab active:cursor-grabbing group hover:border-foreground/40 transition-colors"
                      >
                        <img src={src} alt={`Sketch example ${i + 1}`} draggable={false} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-end justify-center pb-2">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[9px] tracking-[0.15em] uppercase text-background bg-foreground/70 px-2 py-1">
                            Use this
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-12 pt-2 pb-3 flex items-start gap-2 flex-shrink-0">
                  <Lightbulb className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground">Hint tip:</span> Use the prompt field to add material preferences like "rose gold" or "add diamonds."
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  /* ─── REVIEW SCREEN — same viewport layout as TextToCAD ─────────────────── */
  return (
    <div
      className="flex h-[calc(100vh-5rem)] overflow-hidden bg-background"
      tabIndex={-1}
    >
      <ResizablePanelGroup direction="horizontal" className="h-full">

        {/* Left panel — sketch details + generate */}
        <ResizablePanel
          ref={leftPanelRef}
          id="sketch-left-panel"
          order={1}
          defaultSize={25}
          minSize={18}
          maxSize={40}
          collapsible
          onCollapse={() => setLeftCollapsed(true)}
          onExpand={() => setLeftCollapsed(false)}
        >
          <div className="flex flex-col bg-card border-r border-border h-full min-w-0 overflow-hidden">
            {/* Header */}
            <div className="px-4 lg:px-6 pt-6 pb-5 border-b border-border min-w-0">
              <h1 className="font-display text-xl lg:text-2xl tracking-[0.15em] text-foreground uppercase truncate">
                Image to CAD
              </h1>
            </div>

            {/* Body */}
            <div
              className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-4 min-w-0"
              style={{ scrollbarWidth: "thin" }}
            >
              {/* Sketch thumbnail — object-contain, no crop */}
              <div className="border border-border/40 bg-muted/10 flex items-center justify-center relative" style={{ height: 200 }}>
                <img
                  src={previewUrl ?? undefined}
                  alt="Your sketch"
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: 200 }}
                />
                <button
                  onClick={handleClear}
                  className="absolute top-2 right-2 w-6 h-6 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  title="Remove sketch"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Prompt — auto-populated from upload screen */}
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  Design notes
                </h3>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Optional: describe your design (e.g. rose gold, add diamond accents, pave setting)"
                  rows={3}
                  disabled={isGenerating}
                  className="w-full px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 resize-none font-body leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring bg-muted/20 border border-border disabled:opacity-50"
                />
              </div>

              {/* Credit block */}
              {creditBlock && (
                <InsufficientCreditsInline
                  currentBalance={creditBlock.currentBalance}
                  requiredCredits={creditBlock.estimatedCredits}
                  onDismiss={() => setCreditBlock(null)}
                />
              )}

              {/* Generate button */}
              {!creditBlock && (
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !sketchFile}
                  className="w-full py-3.5 text-[13px] font-bold uppercase tracking-[0.2em] transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Diamond className="w-4 h-4" />
                      Generate 3D Ring
                      <span className="inline-flex items-center gap-1 ml-1 opacity-80">
                        <span className="font-mono text-[13px] font-semibold">&le;</span>
                        <img src={creditCoinIcon} alt="" className="w-5 h-5" />
                        <span className="font-mono text-[13px] font-semibold">
                          {costLoading ? "..." : (estimatedCost !== null ? estimatedCost : "--")}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Viewport */}
        <ResizablePanel id="sketch-viewport-panel" order={2} defaultSize={75} minSize={30}>
          <div
            className="relative h-full border-x-2 border-primary/20 shadow-[inset_0_0_30px_-10px_hsl(var(--primary)/0.15)]"
            style={{ background: "#000000" }}
          >
            {/* Panel collapse toggle */}
            <div className="absolute top-3 left-3 z-20 flex gap-1">
              <button
                onClick={() => {
                  const panel = leftPanelRef.current;
                  if (!panel) return;
                  leftCollapsed ? panel.expand() : panel.collapse();
                }}
                className="w-7 h-7 flex items-center justify-center bg-background/20 hover:bg-background/40 backdrop-blur-sm transition-colors border border-white/10"
              >
                {leftCollapsed
                  ? <PanelLeft className="w-4 h-4 text-foreground/70" />
                  : <PanelLeftClose className="w-4 h-4 text-foreground/70" />}
              </button>
            </div>

            {/* Empty viewport state */}
            {!isGenerating && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="font-display text-2xl text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">
                    Ready for Generation
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/25 tracking-[0.15em] uppercase">
                    3D model will appear here
                  </div>
                </div>
              </div>
            )}

            {/* Generation progress */}
            <GenerationProgress
              visible={isGenerating}
              currentStep={progressStep}
              retryAttempt={retryAttempt}
            />
          </div>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}

export type { SketchSession } from "@/lib/sketch-session-store";
