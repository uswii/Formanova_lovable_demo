import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, X, PanelRight, PanelRightClose, Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";

import CADCanvas from "@/components/text-to-cad/CADCanvas";
import CADRuntimeErrorBoundary from "@/components/cad/CADRuntimeErrorBoundary";
import type { CADCanvasHandle } from "@/components/text-to-cad/CADCanvas";
import type { MeshItemData } from "@/components/text-to-cad/types";
import PDPMeshPanel from "@/components/cad-to-pdp/PDPMeshPanel";
import { ViewportSideTools } from "@/components/text-to-cad/ViewportOverlays";

const MAX_SHOTS = 4;

interface Screenshot {
  id: number;
  dataUrl: string;
}

export default function CADToPDP() {
  const [inWorkspace, setInWorkspace] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [meshes, setMeshes] = useState<MeshItemData[]>([]);
  const [transformMode] = useState("orbit");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [lightboxShot, setLightboxShot] = useState<Screenshot | null>(null);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [glbThumbnail, setGlbThumbnail] = useState<string | null>(null);

  const canvasRef = useRef<CADCanvasHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasModel = !!glbUrl;

  const selectedMeshNames = useMemo(
    () => new Set(meshes.filter((m) => m.selected).map((m) => m.name)),
    [meshes]
  );
  const selectedNames = useMemo(() => meshes.filter((m) => m.selected).map((m) => m.name), [meshes]);

  const loadFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "glb" && ext !== "gltf") {
      toast.error("Please upload a GLB or GLTF file");
      return;
    }
    const url = URL.createObjectURL(file);
    if (glbUrl?.startsWith("blob:")) URL.revokeObjectURL(glbUrl);
    setGlbUrl(url);
    setFileName(file.name);
    setInWorkspace(true);
    setIsModelLoading(true);
    setMeshes([]);
    setScreenshots([]);
    setGlbThumbnail(null);
  }, [glbUrl]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
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
    setScreenshots([]);
    setGlbThumbnail(null);
    setIsModelLoading(false);
  }, [glbUrl]);

  const handleMeshesDetected = useCallback((detected: { name: string; verts: number; faces: number }[]) => {
    setMeshes(detected.map((d) => ({ ...d, visible: true, selected: false })));
  }, []);

  const handleModelReady = useCallback(() => {
    setIsModelLoading(false);
    toast.success("Model loaded");
    requestAnimationFrame(() => {
      const canvas = viewportRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
      if (canvas) {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          if (dataUrl && dataUrl !== "data:,") setGlbThumbnail(dataUrl);
        } catch { /* cross-origin or context lost */ }
      }
    });
  }, []);

  const handleSelectMesh = useCallback((name: string, multi: boolean) => {
    if (!name) { setMeshes((p) => p.map((m) => ({ ...m, selected: false }))); return; }
    setMeshes((p) => p.map((m) =>
      m.name === name ? { ...m, selected: multi ? !m.selected : true } : multi ? m : { ...m, selected: false }
    ));
  }, []);

  const handleApplyMaterial = useCallback((matId: string) => {
    if (!selectedNames.length) { toast.error("Select a layer first"); return; }
    canvasRef.current?.applyMaterial(matId, selectedNames);
  }, [selectedNames]);

  const captureScreenshot = useCallback(() => {
    if (screenshots.length >= MAX_SHOTS) { setLimitModalOpen(true); return; }
    const canvas = viewportRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) { toast.error("Viewport not ready"); return; }
    canvasRef.current?.zoomIn();
    canvasRef.current?.zoomOut();
    requestAnimationFrame(() => {
      try {
        const dataUrl = canvas.toDataURL("image/png");
        if (!dataUrl || dataUrl === "data:,") {
          toast.error("Interact with the model first, then try again.");
          return;
        }
        setScreenshots((p) => [...p, { id: Date.now(), dataUrl }]);
        toast.success("Screenshot saved");
      } catch { toast.error("Screenshot failed"); }
    });
  }, [screenshots.length]);

  const removeScreenshot = useCallback((id: number) => {
    setScreenshots((p) => p.filter((s) => s.id !== id));
    setLightboxShot((p) => (p?.id === id ? null : p));
  }, []);

  const downloadShot = useCallback((shot: Screenshot) => {
    const a = document.createElement("a");
    a.href = shot.dataUrl;
    a.download = `pdp-shot-${shot.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  // ── Full-page upload screen (first visit only) ──
  if (!inWorkspace) {
    return (
      <div className="min-h-[calc(100dvh-5rem)] bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-[540px] px-4 py-8"
        >
          <div className="text-center mb-8">
            <h1 className="font-display text-4xl md:text-5xl tracking-[0.2em] text-foreground uppercase mb-2">
              CAD to PDP
            </h1>
            <p className="font-mono text-[11px] text-muted-foreground tracking-[0.15em] uppercase">
              Upload your 3D model to inspect layers and capture product images
            </p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative w-full border flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isDragging ? "border-foreground/60 bg-foreground/5" : "border-foreground/40 hover:border-foreground/60 hover:bg-foreground/5 bg-muted/10"
            }`}
            style={{ minHeight: 220 }}
          >
            <div className="flex flex-col items-center text-center px-6 py-10">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2.5s" }} />
                <div className="absolute inset-0 rounded-full bg-primary/5 border-2 border-primary/20 flex items-center justify-center">
                  <Diamond className="h-9 w-9 text-primary" />
                </div>
              </div>
              <p className="font-display text-lg tracking-[0.1em] text-foreground uppercase mb-1.5">
                Drop your CAD file here
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Drag and drop, or click to browse
              </p>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 border border-border/40 px-4 py-2">
                GLB or GLTF
              </span>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept=".glb,.gltf" className="hidden" onChange={onInputChange} />
        </motion.div>
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
                    className="w-full h-full flex flex-col items-center justify-center gap-1.5 hover:bg-accent/30 transition-colors"
                  >
                    <Diamond className="w-7 h-7 text-primary/60" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Load model</span>
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
              style={{ background: "#000000" }}
            >
              {/* Right panel toggle */}
              <button
                onClick={() => {
                  const p = rightPanelRef.current;
                  if (p) { rightCollapsed ? p.expand(22) : p.collapse(); }
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
                  />
                </CADRuntimeErrorBoundary>
              )}

              {isModelLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-foreground/60" />
                    <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Loading model</span>
                  </div>
                </div>
              )}

              {hasModel && !isModelLoading && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 font-mono text-[9px] h-[30px]">
                  <div className="w-[6px] h-[6px] rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-muted-foreground/60 uppercase tracking-[0.1em]">Ready</span>
                  {screenshots.length > 0 && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-muted-foreground/60 uppercase tracking-[0.1em]">{screenshots.length}/{MAX_SHOTS} shots</span>
                    </>
                  )}
                </div>
              )}

              <ViewportSideTools
                visible={hasModel && !isModelLoading}
                onZoomIn={() => canvasRef.current?.zoomIn()}
                onZoomOut={() => canvasRef.current?.zoomOut()}
                onResetView={() => canvasRef.current?.resetCamera()}
                onUndo={() => {}}
                onRedo={() => {}}
                undoCount={0}
                redoCount={0}
                onDownload={async () => {
                  if (!canvasRef.current && !glbUrl) { toast.error("No model to download"); return; }
                  try {
                    let blob: Blob;
                    if (canvasRef.current) {
                      blob = await canvasRef.current.exportSceneBlob();
                    } else {
                      const response = await fetch(glbUrl!);
                      if (!response.ok) throw new Error("Fetch failed");
                      blob = await response.blob();
                    }
                    if (!blob || blob.size === 0) { toast.error("Export produced an empty file"); return; }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = fileName || `model-${Date.now()}.glb`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                  } catch { toast.error("Export failed"); }
                }}
                onScreenshot={captureScreenshot}
                screenshotCount={screenshots.length}
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
                  className="flex-shrink-0 bg-card border-t border-border overflow-hidden flex items-center justify-center gap-3 px-4"
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
                      <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeScreenshot(shot.id); }}
                          className="w-4 h-4 flex items-center justify-center bg-card/90 border border-border hover:bg-destructive hover:border-destructive transition-colors"
                          title="Remove"
                        >
                          <X className="w-2.5 h-2.5 text-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadShot(shot); }}
                          className="w-4 h-4 flex items-center justify-center bg-card/90 border border-border hover:bg-accent transition-colors"
                          title="Download"
                        >
                          <Download className="w-2.5 h-2.5 text-foreground" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: MAX_SHOTS - screenshots.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-16 h-16 border border-dashed border-border/30 flex-shrink-0" />
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
              onSelectMesh={handleSelectMesh}
              onApplyMaterial={handleApplyMaterial}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Max screenshots modal */}
      <AnimatePresence>
        {limitModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setLimitModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="bg-card border border-border shadow-2xl w-[380px] px-8 py-7 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setLimitModalOpen(false)} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
              <div className="font-display text-base uppercase tracking-[0.15em] text-foreground mb-1.5">
                Screenshot limit reached
              </div>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed mb-5">
                You have 4 screenshots saved. Remove one below to take a new shot.
              </p>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {screenshots.map((shot, i) => (
                  <div key={shot.id} className="relative group">
                    <div className="aspect-square border border-border overflow-hidden">
                      <img src={shot.dataUrl} alt={`Shot ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { removeScreenshot(shot.id); setLimitModalOpen(false); }} title="Remove" className="w-6 h-6 flex items-center justify-center bg-destructive/80 hover:bg-destructive rounded-sm">
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <button onClick={() => downloadShot(shot)} title="Download" className="w-6 h-6 flex items-center justify-center bg-card/80 hover:bg-accent rounded-sm">
                        <Download className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setLimitModalOpen(false)}
                className="w-full py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground border border-border hover:border-foreground/30 hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxShot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setLightboxShot(null)}
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={lightboxShot.dataUrl} alt="Screenshot" className="max-w-full max-h-[90vh] object-contain border border-border" />
              <button onClick={() => setLightboxShot(null)} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-card/90 border border-border hover:bg-accent/80 transition-colors">
                <X className="w-4 h-4 text-foreground" />
              </button>
              <button
                onClick={() => { const a = document.createElement("a"); a.href = lightboxShot.dataUrl; a.download = `pdp-shot-${lightboxShot.id}.png`; document.body.appendChild(a); a.click(); a.remove(); }}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-card/90 border border-border font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Download
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
