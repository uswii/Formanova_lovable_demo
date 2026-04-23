import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, X, PanelRight, PanelRightClose, Upload, Loader2, Trash2, ArrowRight, Camera } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";

import "@/lib/pdp-flat-materials";
import CADCanvas from "@/components/text-to-cad/CADCanvas";
import { invalidate } from "@react-three/fiber";
import CADRuntimeErrorBoundary from "@/components/cad/CADRuntimeErrorBoundary";
import type { CADCanvasHandle, CanvasSnapshot } from "@/components/text-to-cad/CADCanvas";
import type { MeshItemData } from "@/components/text-to-cad/types";
import PDPMeshPanel from "@/components/cad-to-pdp/PDPMeshPanel";
import { ViewportSideTools } from "@/components/text-to-cad/ViewportOverlays";
import { WorkspacePopupModal, LightboxModal, KeyboardShortcutsModal, type Screenshot } from "@/components/cad-to-pdp/CADToPDPModals";

const HAS_SEEN_FINAL_LOOK_KEY = 'hasSeenFinalLookPreview';

interface WorkspacePopup {
  title: string;
  message: string;
}

export default function CADToPDP() {
  const [inWorkspace, setInWorkspace] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [meshes, setMeshes] = useState<MeshItemData[]>([]);
  const [appliedMaterials, setAppliedMaterials] = useState<Record<string, string>>({});
  const [transformMode] = useState("orbit");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [lightboxShot, setLightboxShot] = useState<Screenshot | null>(null);
  const [glbThumbnail, setGlbThumbnail] = useState<string | null>(null);
  const [workspacePopup, setWorkspacePopup] = useState<WorkspacePopup | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const [showFinalLookPreview, setShowFinalLookPreview] = useState(false);
  const [isCanvasInteracting, setIsCanvasInteracting] = useState(false);
  const [captureWarning, setCaptureWarning] = useState(false);
  const [showViewportGizmo, setShowViewportGizmo] = useState(true);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasRef = useRef<CADCanvasHandle>(null);

  interface UndoEntry { snapshot: CanvasSnapshot; materials: Record<string, string>; }
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasModel = !!glbUrl;

  const selectedMeshNames = useMemo(
    () => new Set(meshes.filter((m) => m.selected).map((m) => m.name)),
    [meshes]
  );
  const selectedNames = useMemo(() => meshes.filter((m) => m.selected).map((m) => m.name), [meshes]);

  const showWorkspacePopup = useCallback((title: string, message: string) => {
    setWorkspacePopup({ title, message });
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const current = canvasRef.current?.getSnapshot() ?? null;
    const currentMaterials = { ...appliedMaterials };
    if (current) redoStack.current.push({ snapshot: current, materials: currentMaterials });
    const entry = undoStack.current.pop()!;
    canvasRef.current?.restoreSnapshot(entry.snapshot);
    setAppliedMaterials(entry.materials);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
  }, [appliedMaterials]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const current = canvasRef.current?.getSnapshot() ?? null;
    const currentMaterials = { ...appliedMaterials };
    if (current) undoStack.current.push({ snapshot: current, materials: currentMaterials });
    const entry = redoStack.current.pop()!;
    canvasRef.current?.restoreSnapshot(entry.snapshot);
    setAppliedMaterials(entry.materials);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
  }, [appliedMaterials]);

  useEffect(() => {
    if (!inWorkspace) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && e.shiftKey && key === "z") { e.preventDefault(); handleRedo(); return; }
      if (mod && key === "y") { e.preventDefault(); handleRedo(); return; }
      if (mod && key === "z") { e.preventDefault(); handleUndo(); return; }
      if (mod && key === "a") {
        e.preventDefault();
        setMeshes((p) => p.map((m) => ({ ...m, selected: true })));
        return;
      }
      if (mod) return;
      if (e.key === "?" || e.key === "/") { setShowShortcuts((s) => !s); return; }
      if (key === "escape") {
        setShowShortcuts(false);
        setMeshes((p) => p.map((m) => ({ ...m, selected: false })));
        return;
      }
      if (!hasModel || isModelLoading) return;
      if (key === "f") { canvasRef.current?.resetCamera(); return; }
      if (key === "+" || e.key === "=") { canvasRef.current?.zoomIn(); return; }
      if (key === "-") { canvasRef.current?.zoomOut(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [inWorkspace, hasModel, isModelLoading, handleUndo, handleRedo]);

  const loadFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "glb" && ext !== "gltf") {
      showWorkspacePopup("Unsupported file", "Please upload a GLB or GLTF file.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (glbUrl?.startsWith("blob:")) URL.revokeObjectURL(glbUrl);
    setGlbUrl(url);
    setFileName(file.name);
    setInWorkspace(true);
    setIsModelLoading(true);
    setMeshes([]);
    setAppliedMaterials({});
    setScreenshots([]);
    setGlbThumbnail(null);
    undoStack.current = [];
    redoStack.current = [];
    setUndoCount(0);
    setRedoCount(0);
  }, [glbUrl, showWorkspacePopup]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const fileItem = items.find((i) => i.kind === "file");
      if (!fileItem) return;
      const file = fileItem.getAsFile();
      if (file) loadFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [loadFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  }, [loadFile]);

  // Clears the model but stays in workspace — thumbnail slot and viewport become upload zones
  const clearModel = useCallback(() => {
    if (glbUrl?.startsWith("blob:")) URL.revokeObjectURL(glbUrl);
    setGlbUrl(undefined);
    setFileName("");
    setMeshes([]);
    setAppliedMaterials({});
    setScreenshots([]);
    setGlbThumbnail(null);
    setIsModelLoading(false);
    undoStack.current = [];
    redoStack.current = [];
    setUndoCount(0);
    setRedoCount(0);
  }, [glbUrl]);

  const handleMeshesDetected = useCallback((detected: { name: string; verts: number; faces: number }[]) => {
    setMeshes(detected.map((d) => ({ ...d, visible: true, selected: false })));
  }, []);

  const captureViewportDataUrl = useCallback((maxSize?: number) => {
    return canvasRef.current?.captureStyledViewport(maxSize ? { maxSize } : undefined) ?? null;
  }, []);

  const capturePlainViewportThumbnail = useCallback(() => {
    const canvas = viewportRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  }, []);

  const handleModelReady = useCallback(() => {
    setTimeout(() => {
      setIsModelLoading(false);
      flushSync(() => setShowViewportGizmo(false));
      invalidate();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const thumbnailDataUrl = capturePlainViewportThumbnail();
          if (thumbnailDataUrl) setGlbThumbnail(thumbnailDataUrl);
          flushSync(() => setShowViewportGizmo(true));
          invalidate();
        });
      });
    }, 800);
  }, [capturePlainViewportThumbnail]);

  const handleSelectMesh = useCallback((name: string, multi: boolean) => {
    if (!name) { setMeshes((p) => p.map((m) => ({ ...m, selected: false }))); return; }
    setMeshes((p) => p.map((m) =>
      m.name === name ? { ...m, selected: multi ? !m.selected : true } : multi ? m : { ...m, selected: false }
    ));
  }, []);

  const handleApplyMaterial = useCallback((matId: string) => {
    if (!selectedNames.length) {
      showWorkspacePopup("Select a layer first", "Choose a model layer before applying a material.");
      return;
    }
    const snap = canvasRef.current?.getSnapshot() ?? null;
    if (snap) {
      undoStack.current.push({ snapshot: snap, materials: { ...appliedMaterials } });
      redoStack.current = [];
      setUndoCount(undoStack.current.length);
      setRedoCount(0);
    }
    canvasRef.current?.applyMaterial(matId, selectedNames);
    setAppliedMaterials((prev) => {
      const next = { ...prev };
      selectedNames.forEach((name) => { next[name] = matId; });
      return next;
    });
    if (!localStorage.getItem(HAS_SEEN_FINAL_LOOK_KEY)) {
      localStorage.setItem(HAS_SEEN_FINAL_LOOK_KEY, 'true');
      setShowFinalLookPreview(true);
    }
  }, [selectedNames, appliedMaterials, showWorkspacePopup]);

  const handleCanvasPointerDown = useCallback(() => {
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    setIsCanvasInteracting(true);
  }, []);

  const handleCanvasPointerUp = useCallback(() => {
    interactionTimerRef.current = setTimeout(() => setIsCanvasInteracting(false), 800);
  }, []);

  const captureScreenshot = useCallback(() => {
    const canvas = viewportRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      showWorkspacePopup("Viewport not ready", "Load a model before taking a screenshot.");
      return;
    }
    // Block capture if any selected mesh has no material assigned yet
    const selectedWithNoMaterial = meshes.filter(m => m.selected && !appliedMaterials[m.name]);
    if (selectedWithNoMaterial.length > 0) {
      if (captureWarningTimer.current) clearTimeout(captureWarningTimer.current);
      setCaptureWarning(true);
      captureWarningTimer.current = setTimeout(() => setCaptureWarning(false), 2500);
      return;
    }
    setCaptureWarning(false);
    // Deselect so selection highlights don't appear in the capture
    const prevSelection = meshes.filter(m => m.selected).map(m => m.name);
    flushSync(() => {
      if (prevSelection.length > 0) {
        setMeshes(p => p.map(m => ({ ...m, selected: false })));
      }
      setShowViewportGizmo(false);
    });
    invalidate();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dataUrl = captureViewportDataUrl();
        if (dataUrl) setScreenshots((p) => [...p, { id: Date.now(), dataUrl }]);
        flushSync(() => {
          setShowViewportGizmo(true);
          if (prevSelection.length > 0) {
            setMeshes(p => p.map(m => ({ ...m, selected: prevSelection.includes(m.name) })));
          }
        });
        invalidate();
      });
    });
  }, [meshes, appliedMaterials, showWorkspacePopup, captureViewportDataUrl]);

  const removeScreenshot = useCallback((id: number) => {
    setScreenshots((p) => p.filter((s) => s.id !== id));
    setLightboxShot((p) => (p?.id === id ? null : p));
  }, []);

  // ── Full-page upload screen (first visit only) ──
  if (!inWorkspace) {
    const STEPS = [
      { n: 1, label: "Upload 3D Ring File" },
      { n: 2, label: "Apply Material" },
      { n: 3, label: "Capture Screenshot" },
      { n: 4, label: "Submit for Product Shot" },
    ];
    return (
      <div className="min-h-[calc(100dvh-5rem)] bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-[580px] px-4 py-8"
        >
          <div className="text-center mb-10">
            <h1 className="font-display text-4xl md:text-5xl tracking-[0.2em] text-foreground uppercase mb-2">
              CAD to PDP
            </h1>
            <p className="font-mono text-[11px] text-muted-foreground tracking-[0.15em] uppercase">
              Turn your 3D ring file into studio-ready product images
            </p>
          </div>

          {/* 4-step guide */}
          <div className="flex items-start justify-center gap-0 mb-10">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-start">
                <div className="flex flex-col items-center gap-2 w-[110px]">
                  <div className={`w-5 h-5 flex-shrink-0 flex items-center justify-center font-mono text-[10px] font-bold border transition-all ${s.n === 1 ? "bg-foreground text-background border-foreground" : "border-border/40 text-muted-foreground/40"}`}>
                    {s.n}
                  </div>
                  <span className={`font-mono text-[9px] uppercase tracking-[0.12em] text-center leading-tight ${s.n === 1 ? "text-foreground" : "text-muted-foreground/40"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-10 h-px bg-border/30 mt-2.5 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative w-full border flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isDragging ? "border-foreground/60 bg-foreground/5" : "border-foreground/40 hover:border-foreground/60 hover:bg-foreground/5 bg-muted/10"
            }`}
            style={{ minHeight: 200 }}
          >
            <div className="flex flex-col items-center text-center px-6 py-10">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2.5s" }} />
                <div className="absolute inset-0 rounded-full bg-primary/5 border-2 border-primary/20 flex items-center justify-center">
                  <Diamond className="h-9 w-9 text-primary" />
                </div>
              </div>
              <p className="font-display text-lg tracking-[0.1em] text-foreground uppercase mb-1.5">
                Drop your 3D ring file here
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Drag &amp; drop · click to browse · paste (Ctrl+V)
              </p>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 border border-border/40 px-4 py-2">
                Browse 3D Ring Files
              </span>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept=".glb,.gltf" className="hidden" onChange={onInputChange} />
        </motion.div>
        <WorkspacePopupModal popup={workspacePopup} onClose={() => setWorkspacePopup(null)} />
      </div>
    );
  }

  // ── Workspace ──
  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full">

        {/* Left panel */}
        <ResizablePanel id="pdp-left" order={1} defaultSize={18} minSize={14} maxSize={28}>
          <div className="flex flex-col bg-card border-r border-border h-full">
            <div className="px-4 py-3 border-b border-border flex-shrink-0">
              <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">CAD to PDP</span>
            </div>

            {/* Thumbnail / upload slot */}
            <div className="px-3 pt-3 flex-shrink-0">
              <div className="relative w-full aspect-square border border-border overflow-hidden bg-muted/20">
                {isModelLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
                  </div>
                ) : glbThumbnail ? (
                  <>
                    <img src={glbThumbnail} alt="Model preview" className="w-full h-full object-contain" />
                    <button
                      onClick={clearModel}
                      className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-card/90 border border-border hover:bg-destructive hover:border-destructive transition-colors"
                      title="Remove model"
                    >
                      <X className="w-3 h-3 text-foreground" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full flex flex-col items-center justify-center gap-2 hover:bg-accent/30 transition-colors px-2"
                  >
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2.5s" }} />
                      <div className="absolute inset-0 rounded-full bg-primary/5 border-2 border-primary/20 flex items-center justify-center">
                        <Diamond className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <span className="font-display text-[10px] tracking-[0.1em] text-foreground/60 uppercase text-center leading-tight">
                      Drop your CAD file here
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Replace button — only when model is loaded */}
            {hasModel && (
              <div className="px-3 pt-2 pb-3 flex-shrink-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground border border-border hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Replace model
                </button>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept=".glb,.gltf" className="hidden" onChange={onInputChange} />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Viewport */}
        <ResizablePanel id="pdp-viewport" order={2} defaultSize={60} minSize={35}>
          <div className="flex flex-col h-full">
            <div
              ref={viewportRef}
              data-cad-viewport
              className="relative flex-1 min-h-0 border-x-2 border-primary/20 shadow-[inset_0_0_30px_-10px_hsl(var(--primary)/0.15)]"
              onPointerDown={handleCanvasPointerDown}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
            >
              {/* Step progress — top center of viewport */}
              {(() => {
                const currentStep = !hasModel ? 1 : Object.keys(appliedMaterials).length === 0 ? 2 : screenshots.length === 0 ? 3 : 4;
                const steps = [
                  { n: 1, label: "Upload" },
                  { n: 2, label: "Apply Material" },
                  { n: 3, label: "Capture" },
                  { n: 4, label: "Submit" },
                ];
                return (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center pointer-events-none">
                    {steps.map((s, i) => {
                      const done = s.n < currentStep;
                      const active = s.n === currentStep;
                      return (
                        <div key={s.n} className="flex items-center">
                          <div className="flex items-center gap-1.5 px-2 py-1">
                            <div className={`w-5 h-5 flex items-center justify-center font-mono text-[9px] font-bold border transition-all ${done || active ? "bg-foreground text-background border-foreground" : "bg-card/80 border-border/40 text-muted-foreground/40"}`}>
                              {done ? "✓" : s.n}
                            </div>
                            <span className={`font-mono text-[9px] uppercase tracking-[0.12em] hidden sm:inline transition-colors ${active ? "text-foreground" : done ? "text-muted-foreground/60" : "text-muted-foreground/30"}`}>
                              {s.label}
                            </span>
                          </div>
                          {i < steps.length - 1 && (
                            <div className={`w-8 h-px transition-colors ${done ? "bg-foreground/40" : "bg-border/30"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Right panel toggle */}
              <button
                onClick={() => {
                  const p = rightPanelRef.current;
                  if (p) { if (rightCollapsed) { p.expand(22); } else { p.collapse(); } }
                }}
                className="absolute top-2 right-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                title={rightCollapsed ? "Show layers" : "Hide layers"}
              >
                {rightCollapsed ? <PanelRight className="w-4 h-4 text-foreground/70" /> : <PanelRightClose className="w-4 h-4 text-foreground/70" />}
              </button>

              {/* Upload drop zone when no model is loaded */}
              {!hasModel && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`absolute inset-0 z-10 flex items-center justify-center transition-colors cursor-pointer ${
                    isDragging ? "bg-foreground/5" : "hover:bg-foreground/[0.03]"
                  }`}
                >
                  <div className="flex flex-col items-center text-center pointer-events-none">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2.5s" }} />
                      <div className="absolute inset-0 rounded-full bg-primary/5 border-2 border-primary/20 flex items-center justify-center">
                        <Diamond className="h-7 w-7 text-primary" />
                      </div>
                    </div>
                    <p className="font-display text-base tracking-[0.15em] text-foreground/70 uppercase mb-1">
                      Drop CAD file here
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em]">
                      GLB or GLTF
                    </p>
                  </div>
                </div>
              )}

              {hasModel && (
                <CADRuntimeErrorBoundary resetKeys={[glbUrl]}>
                  <CADCanvas
                    ref={canvasRef}
                    hasModel={hasModel}
                    glbUrl={glbUrl}
                    selectedMeshNames={selectedMeshNames}
                    onMeshClick={handleSelectMesh}
                    transformMode={transformMode}
                    onMeshesDetected={handleMeshesDetected}
                    lightIntensity={1}
                    onModelReady={handleModelReady}
                    qualityMode="balanced"
                    gemMode="simple"
                    showViewportGizmo={showViewportGizmo}
                  />
                </CADRuntimeErrorBoundary>
              )}

              {isModelLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <Diamond className="absolute inset-0 m-auto h-10 w-10 text-primary" />
                    </div>
                    <span className="font-display text-lg tracking-[0.12em] uppercase text-foreground/80">
                      Loading model into viewport
                    </span>
                  </div>
                </div>
              )}

              {/* Floating Capture CTA — fades on interaction like Photoshop/Figma */}
              <AnimatePresence>
                {hasModel && !isModelLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-2 z-50 pointer-events-none"
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onPointerLeave={(e) => e.stopPropagation()}
                  >
                    <AnimatePresence>
                      {captureWarning && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className="pointer-events-auto bg-card border border-border shadow-lg px-4 py-2.5"
                        >
                          <p className="font-mono text-[11px] text-foreground text-center">
                            Apply a material to the selected layer first, or unselect it
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      onClick={captureScreenshot}
                      className="pointer-events-auto flex items-center gap-3 px-12 py-4 bg-primary text-primary-foreground font-display text-sm tracking-[0.18em] uppercase hover:bg-primary/90 active:scale-[0.99] transition-all shadow-xl"
                    >
                      <Camera className="w-5 h-5 flex-shrink-0" />
                      Capture
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Final Render popup — inside viewport, top-center */}
              <AnimatePresence>
                {showFinalLookPreview && hasModel && !isModelLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-14 left-0 right-0 flex justify-center z-[60] pointer-events-none"
                  >
                    <div className="pointer-events-auto relative w-[560px] max-w-full bg-card border border-border shadow-xl">
                      <button
                        onClick={() => setShowFinalLookPreview(false)}
                        className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-colors z-10"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="px-5 pt-4 pb-5">
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4 pr-6">
                          Colors shown here are flat placeholders only. The final render will apply photorealistic materials, lighting and reflections.
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full aspect-square border border-border/40 overflow-hidden bg-muted/20">
                              <img src="/cad-to-pdp/final-look-before.webp" alt="Before" className="w-full h-full object-cover" />
                            </div>
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">Flat Preview</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                          <div className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full aspect-square border border-border/20 overflow-hidden bg-muted/20">
                              <img src="/cad-to-pdp/final-look-after.webp" alt="After" className="w-full h-full object-cover" />
                            </div>
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60">Final Render</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <ViewportSideTools
                visible={hasModel && !isModelLoading}
                onZoomIn={() => canvasRef.current?.zoomIn()}
                onZoomOut={() => canvasRef.current?.zoomOut()}
                onResetView={() => canvasRef.current?.resetCamera()}
                onUndo={handleUndo}
                onRedo={handleRedo}
                undoCount={undoCount}
                redoCount={redoCount}
                onKeyboardShortcuts={() => setShowShortcuts((s) => !s)}
                onDownload={async () => {
                  if (!canvasRef.current && !glbUrl) {
                    showWorkspacePopup("No model to download", "Load a model before exporting.");
                    return;
                  }
                  try {
                    let blob: Blob;
                    if (canvasRef.current) {
                      blob = await canvasRef.current.exportSceneBlob();
                    } else {
                      const response = await fetch(glbUrl!);
                      if (!response.ok) throw new Error("Fetch failed");
                      blob = await response.blob();
                    }
                    if (!blob || blob.size === 0) {
                      showWorkspacePopup("Export failed", "The exported model file was empty.");
                      return;
                    }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = fileName || `model-${Date.now()}.glb`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                  } catch {
                    showWorkspacePopup("Export failed", "The model could not be exported. Please try again.");
                  }
                }}
              />
            </div>

            {/* Screenshot strip */}
            <AnimatePresence>
              {screenshots.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 96, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0 bg-card border-t border-border flex items-center gap-3 px-4 overflow-x-auto scrollbar-thin"
                >
                  {screenshots.map((shot, i) => (
                    <div key={shot.id} className="relative group flex-shrink-0">
                      <button
                        onClick={() => setLightboxShot(shot)}
                        className="w-16 h-16 border border-border overflow-hidden hover:border-formanova-hero-accent transition-colors"
                        title={`Screenshot ${i + 1} — click to enlarge`}
                      >
                        <img src={shot.dataUrl} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                      <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeScreenshot(shot.id); }}
                          className="w-4 h-4 flex items-center justify-center bg-card/90 border border-border hover:bg-destructive hover:border-destructive transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-foreground" />
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel: mesh + material */}
        <ResizablePanel
          ref={rightPanelRef}
          id="pdp-right"
          order={3}
          defaultSize={22}
          minSize={15}
          maxSize={35}
          collapsible
          collapsedSize={0}
          onCollapse={() => setRightCollapsed(true)}
          onExpand={() => setRightCollapsed(false)}
        >
          {hasModel && !rightCollapsed && (
            <PDPMeshPanel
              meshes={meshes}
              appliedMaterials={appliedMaterials}
              onSelectMesh={handleSelectMesh}
              onApplyMaterial={handleApplyMaterial}
              onOpenFinalLookPreview={() => setShowFinalLookPreview(true)}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <LightboxModal shot={lightboxShot} onClose={() => setLightboxShot(null)} onRemove={removeScreenshot} />
      <WorkspacePopupModal popup={workspacePopup} onClose={() => setWorkspacePopup(null)} />
      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

    </div>
  );
}
