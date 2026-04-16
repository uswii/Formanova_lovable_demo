/**
 * SketchToCAD — Phase 1: multi-sketch upload + optional per-sketch hints.
 * Phase 2 (studio workspace): routes into TextToCAD with mode='sketch'
 * via URL state so the full viewport is reused without duplication.
 *
 * Max 10 sketches per batch.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PenTool, X, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { toast } from "sonner";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import { useEstimatedCost } from "@/hooks/use-estimated-cost";
import { SKETCH_TO_CAD_WORKFLOW } from "@/lib/sketch-to-cad-workflows";
import { TOOL_COSTS } from "@/lib/credits-api";

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

  // Revoke object URLs on unmount to avoid memory leaks
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
        toast.warning(`Only ${remaining} sketch${remaining === 1 ? "" : "es"} added — batch limit is ${MAX_SKETCHES}`);
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
    // Only clear if leaving the drop container itself
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
    // Pass sketches via sessionStorage so TextToCAD can pick them up without prop drilling
    // Files can't go in sessionStorage, so we store IDs and keep blobs in a module-level map
    sketchSessionStore.set(sketches);
    navigate("/text-to-cad?mode=sketch");
  }, [sketches, navigate]);

  const canGenerate = sketches.length > 0;

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-background flex flex-col">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-border px-4 sm:px-6 md:px-10 py-5 flex items-center gap-3">
        <PenTool className="w-5 h-5 text-foreground/60 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl md:text-3xl uppercase tracking-[0.15em] text-foreground leading-none">
            Sketch to 3D
          </h1>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
            Upload jewelry sketches — generate 3D models
          </p>
        </div>
      </div>

      {/* ── Main layout: drop zone + asset grid / credit sidebar ──────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Left: drop zone + grid */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 py-6 min-w-0">

          {/* Drop zone — always visible, shrinks once items added */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed transition-colors duration-200 flex flex-col items-center justify-center gap-3 cursor-pointer select-none
              ${sketches.length > 0 ? "py-5" : "py-16"}
              ${isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-foreground/30 bg-muted/10 hover:bg-muted/20"
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
            <div className={`w-12 h-12 border border-border flex items-center justify-center flex-shrink-0 transition-colors ${isDragging ? "border-primary" : ""}`}>
              <Plus className={`w-5 h-5 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground/50"}`} />
            </div>
            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                {sketches.length > 0
                  ? `Add more sketches (${sketches.length}/${MAX_SKETCHES})`
                  : "Drop sketches here, or click to browse"}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground/40 mt-1">PNG, JPG, WEBP — up to {MAX_SKETCHES} at once</p>
            </div>
          </div>

          {/* Sketch grid */}
          <AnimatePresence initial={false}>
            {sketches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3"
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

        {/* Right sidebar: credit estimate + generate — desktop */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-l border-border px-6 py-6 gap-6 flex-shrink-0">
          <CreditSidebar
            sketchCount={sketches.length}
            costPerSketch={costPerSketch}
            totalCost={totalCost}
            costLoading={costLoading}
            canGenerate={canGenerate}
            onGenerate={handleGenerate}
          />
        </aside>
      </div>

      {/* ── Mobile sticky footer: credit estimate + generate ──────────── */}
      <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <CreditLine
            sketchCount={sketches.length}
            costPerSketch={costPerSketch}
            totalCost={totalCost}
            costLoading={costLoading}
          />
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

/* ── SketchCard ──────────────────────────────────────────────────────── */

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
      className="flex flex-col border border-border bg-card overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-muted/20 overflow-hidden group">
        <img
          src={sketch.previewUrl}
          alt={sketch.file.name}
          className="w-full h-full object-contain"
          draggable={false}
        />
        {/* Remove button */}
        <button
          onClick={() => onRemove(sketch.id)}
          className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-background/80 border border-border opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-destructive hover:border-destructive hover:text-destructive-foreground"
          aria-label="Remove sketch"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Filename + hint toggle */}
      <div className="px-2 py-1.5 border-t border-border">
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

        {/* Inline hint input — expands on toggle */}
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
                className="w-full mt-1.5 px-2 py-1.5 text-[11px] font-body bg-muted/20 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 text-foreground"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── Credit sidebar (desktop) ───────────────────────────────────────── */

interface CreditSidebarProps {
  sketchCount: number;
  costPerSketch: number | null;
  totalCost: number | null;
  costLoading: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}

function CreditSidebar({ sketchCount, costPerSketch, totalCost, costLoading, canGenerate, onGenerate }: CreditSidebarProps) {
  return (
    <>
      <div className="space-y-4">
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
              Sketches&nbsp;
              <span className="text-foreground">{sketchCount}</span>
            </span>
            <span className="font-mono text-[11px] text-foreground flex items-center gap-1">
              <img src={creditCoinIcon} alt="" className="w-4 h-4" />
              {costLoading
                ? "\u2026"
                : sketchCount === 0
                  ? "\u2014"
                  : totalCost !== null
                    ? `\u2264 ${totalCost}`
                    : "\u2014"}
            </span>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-semibold text-foreground uppercase tracking-[0.1em]">Total</span>
          <span className="font-mono text-[13px] font-semibold text-foreground flex items-center gap-1">
            <img src={creditCoinIcon} alt="" className="w-4 h-4" />
            {costLoading
              ? "\u2026"
              : sketchCount === 0
                ? "\u2014"
                : totalCost !== null
                  ? `\u2264 ${totalCost}`
                  : "\u2014"}
          </span>
        </div>
      </div>

      <div className="mt-auto">
        {sketchCount === 0 && (
          <p className="font-mono text-[10px] text-muted-foreground/50 text-center mb-3">
            Upload at least one sketch to generate
          </p>
        )}
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="w-full py-4 text-[12px] font-bold uppercase tracking-[0.2em] bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <PenTool className="w-4 h-4" />
          Generate {sketchCount > 1 ? `${sketchCount} Models` : "Model"}
        </button>
      </div>
    </>
  );
}

/* ── Credit line (mobile footer) ────────────────────────────────────── */

function CreditLine({ sketchCount, costPerSketch, totalCost, costLoading }: Omit<CreditSidebarProps, "canGenerate" | "onGenerate">) {
  if (sketchCount === 0) {
    return (
      <p className="font-mono text-[10px] text-muted-foreground/50">
        Upload sketches to start
      </p>
    );
  }
  return (
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
        for {sketchCount} sketch{sketchCount !== 1 ? "es" : ""}
      </span>
    </div>
  );
}

/* ── Session store: pass File objects to TextToCAD across navigation ── */
// Files can't be serialized to sessionStorage, so we use a module-level map.

export interface SketchSession {
  id: string;
  file: File;
  previewUrl: string;
  hint: string;
}

class SketchSessionStore {
  private items: SketchSession[] = [];

  set(sketches: SketchItem[]) {
    // Revoke old preview URLs managed by this store (new ones already exist on items)
    this.items = sketches.map((s) => ({
      id: s.id,
      file: s.file,
      previewUrl: s.previewUrl,
      hint: s.hint,
    }));
  }

  get(): SketchSession[] {
    return this.items;
  }

  clear() {
    this.items = [];
  }
}

export const sketchSessionStore = new SketchSessionStore();
