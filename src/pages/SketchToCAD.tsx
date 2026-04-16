/**
 * SketchToCAD -- Phase 1: multi-sketch upload + optional per-sketch hints.
 * Phase 2 (studio workspace): routes into TextToCAD with mode='sketch'
 * via URL state so the full viewport is reused without duplication.
 *
 * Max 10 sketches per batch.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PenTool, X, ChevronDown, ChevronUp, Diamond, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import { useEstimatedCost } from "@/hooks/use-estimated-cost";
import { SKETCH_TO_CAD_WORKFLOW } from "@/lib/sketch-to-cad-workflows";

const MAX_SKETCHES = 10;

interface SketchItem {
  id: string;
  file: File;
  previewUrl: string;
  hint: string;
  hintOpen: boolean;
}

function createSketchItem(file: File): SketchItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    hint: "",
    hintOpen: false,
  };
}

export default function SketchToCAD() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [sketches, setSketches] = useState<SketchItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { cost: costPerSketch, loading: costLoading } = useEstimatedCost({ workflowName: SKETCH_TO_CAD_WORKFLOW });

  useEffect(() => {
    return () => {
      sketches.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only on unmount
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) return;
    setSketches((prev) => {
      const remaining = MAX_SKETCHES - prev.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_SKETCHES} sketches per batch`);
        return prev;
      }
      const toAdd = incoming.slice(0, remaining);
      if (incoming.length > remaining) {
        toast.warning(`Only ${remaining} sketch${remaining === 1 ? "" : "es"} added -- batch limit is ${MAX_SKETCHES}`);
      }
      return [...prev, ...toAdd.map(createSketchItem)];
    });
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  }, [addFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const removeSketch = useCallback((id: string) => {
    setSketches((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const updateHint = useCallback((id: string, hint: string) => {
    setSketches((prev) => prev.map((s) => s.id === id ? { ...s, hint } : s));
  }, []);

  const toggleHint = useCallback((id: string) => {
    setSketches((prev) => prev.map((s) => s.id === id ? { ...s, hintOpen: !s.hintOpen } : s));
  }, []);

  const totalCost = costPerSketch !== null ? costPerSketch * sketches.length : null;

  const handleGenerate = useCallback(() => {
    if (!sketches.length) return;
    sketchSessionStore.set(sketches);
    navigate("/text-to-cad?mode=sketch");
  }, [sketches, navigate]);

  const canGenerate = sketches.length > 0;

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-background">
      {/* Header */}
      <div className="border-b border-border/40 px-4 sm:px-6 md:px-10 py-5">
        <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight text-foreground">
          Sketch to 3D
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload jewelry sketches or design drawings to generate 3D models
        </p>
      </div>

      {/* Main body */}
      <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">

          {/* Left column (2/3) -- drop zone + sketch grid */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Drop zone */}
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-200
                ${sketches.length > 0 ? "py-6 min-h-[120px]" : "min-h-[500px] md:min-h-[560px]"}
                ${isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border/30 hover:border-foreground/30 bg-muted/10 hover:bg-muted/20"
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />

              {sketches.length === 0 ? (
                /* Empty state -- prominent, like photo studio */
                <div className="flex flex-col items-center gap-4 px-6 text-center">
                  <div className="relative mx-auto w-20 h-20">
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2.5s" }} />
                    <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                      <Diamond className="h-9 w-9 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-display font-medium mb-1.5">Drop your sketches here</p>
                    <p className="text-sm text-muted-foreground">
                      Drag & drop or click to browse
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground/50 mt-1 uppercase tracking-wider">
                      PNG, JPG, WEBP -- up to {MAX_SKETCHES} at once
                    </p>
                  </div>
                </div>
              ) : (
                /* Compact add-more row */
                <div className="flex flex-col items-center gap-1.5">
                  <Diamond className={`h-5 w-5 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground/40"}`} />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                    Add more ({sketches.length}/{MAX_SKETCHES})
                  </p>
                </div>
              )}
            </div>

            {/* Sketch grid */}
            <AnimatePresence initial={false}>
              {sketches.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                >
                  {sketches.map((sketch) => (
                    <SketchCard
                      key={sketch.id}
                      sketch={sketch}
                      onRemove={removeSketch}
                      onHintChange={updateHint}
                      onToggleHint={toggleHint}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right column (1/3) -- guide + credits + generate */}
          <div className="flex flex-col gap-6">
            {/* Guide panel -- matches studio guide height on desktop */}
            <div className="border border-border/30 flex flex-col overflow-hidden">
              <p className="px-5 pt-4 pb-2 text-base font-bold text-foreground flex-shrink-0">
                What makes a good sketch?
              </p>
              <div className="px-5 flex-1 flex flex-col justify-center py-3">
                <ul className="space-y-3">
                  {[
                    "Clear linework on a plain background",
                    "Show the full piece with visible structure",
                    "Include stone placements or settings",
                    "Side/front view works best for rings",
                    "Pencil, pen, or digital sketch all work",
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span className="text-sm text-muted-foreground">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-5 pb-4 pt-2 flex items-start gap-2 flex-shrink-0">
                <Lightbulb className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-bold text-foreground">Hint tip:</span> Use the hint field on each sketch to add material preferences like "rose gold" or "add diamonds."
                </p>
              </div>
            </div>

            {/* Credit estimate */}
            <div className="border border-border/30 px-5 py-4 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Estimate
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground">Per sketch</span>
                  <span className="font-mono text-[11px] text-foreground flex items-center gap-1">
                    <img src={creditCoinIcon} alt="" className="w-4 h-4" />
                    {costLoading ? "\u2026" : (costPerSketch !== null ? `\u2264 ${costPerSketch}` : "\u2014")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Sketches <span className="text-foreground">{sketches.length}</span>
                  </span>
                  <span className="font-mono text-[11px] text-foreground flex items-center gap-1">
                    <img src={creditCoinIcon} alt="" className="w-4 h-4" />
                    {costLoading
                      ? "\u2026"
                      : sketches.length === 0
                        ? "\u2014"
                        : totalCost !== null
                          ? `\u2264 ${totalCost}`
                          : "\u2014"}
                  </span>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-foreground uppercase tracking-[0.1em]">Total</span>
                <span className="font-mono text-[13px] font-semibold text-foreground flex items-center gap-1">
                  <img src={creditCoinIcon} alt="" className="w-4 h-4" />
                  {costLoading
                    ? "\u2026"
                    : sketches.length === 0
                      ? "\u2014"
                      : totalCost !== null
                        ? `\u2264 ${totalCost}`
                        : "\u2014"}
                </span>
              </div>
            </div>

            {/* Generate button */}
            {sketches.length === 0 && (
              <p className="font-mono text-[10px] text-muted-foreground/50 text-center">
                Upload at least one sketch to generate
              </p>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full py-4 text-[13px] font-bold uppercase tracking-[0.2em] bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <PenTool className="w-4 h-4" />
              Generate {sketches.length > 1 ? `${sketches.length} Models` : "Model"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sticky footer */}
      <div className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {sketches.length === 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground/50">Upload sketches to start</p>
          ) : (
            <div className="flex items-center gap-1.5">
              <img src={creditCoinIcon} alt="" className="w-4 h-4 flex-shrink-0" />
              <span className="font-mono text-[11px] text-foreground">
                {costLoading
                  ? "\u2026"
                  : totalCost !== null
                    ? `\u2264 ${totalCost}`
                    : "\u2014"}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                for {sketches.length} sketch{sketches.length !== 1 ? "es" : ""}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="flex-shrink-0 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Generate
        </button>
      </div>
    </div>
  );
}

/* -- SketchCard ---------------------------------------------------------- */

interface SketchCardProps {
  sketch: SketchItem;
  onRemove: (id: string) => void;
  onHintChange: (id: string, hint: string) => void;
  onToggleHint: (id: string) => void;
}

function SketchCard({ sketch, onRemove, onHintChange, onToggleHint }: SketchCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sketch.hintOpen) inputRef.current?.focus();
  }, [sketch.hintOpen]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col border border-border/40 bg-card overflow-hidden"
    >
      <div className="relative aspect-square bg-muted/20 overflow-hidden group">
        <img
          src={sketch.previewUrl}
          alt={sketch.file.name}
          className="w-full h-full object-contain"
          draggable={false}
        />
        <button
          onClick={() => onRemove(sketch.id)}
          className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-background/80 border border-border/40 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-destructive hover:border-destructive hover:text-destructive-foreground"
          aria-label="Remove sketch"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="px-2 py-1.5 border-t border-border/40">
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span className="font-mono text-[9px] text-muted-foreground truncate flex-1 min-w-0">
            {sketch.file.name}
          </span>
          <button
            onClick={() => onToggleHint(sketch.id)}
            className="flex-shrink-0 flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60 hover:text-foreground transition-colors"
            title={sketch.hintOpen ? "Hide hint" : "Add hint"}
          >
            {sketch.hint && !sketch.hintOpen
              ? <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" title="Hint set" />
              : null}
            {sketch.hintOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {sketch.hintOpen && (
            <motion.div
              key="hint"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <input
                ref={inputRef}
                type="text"
                value={sketch.hint}
                onChange={(e) => onHintChange(sketch.id, e.target.value)}
                placeholder="e.g. rose gold, add diamonds"
                maxLength={200}
                className="w-full mt-1.5 px-2 py-1.5 text-[11px] font-body bg-muted/20 border border-border/40 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 text-foreground"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export { sketchSessionStore } from "@/lib/sketch-session-store";
export type { SketchSession } from "@/lib/sketch-session-store";
