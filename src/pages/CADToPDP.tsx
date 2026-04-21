import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, Camera, X, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from "lucide-react";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";

import CADCanvas from "@/components/text-to-cad/CADCanvas";
import CADRuntimeErrorBoundary from "@/components/cad/CADRuntimeErrorBoundary";
import type { CADCanvasHandle } from "@/components/text-to-cad/CADCanvas";
import type { MeshItemData } from "@/components/text-to-cad/types";
import PDPMeshPanel from "@/components/cad-to-pdp/PDPMeshPanel";
import { ViewportSideTools } from "@/components/text-to-cad/ViewportOverlays";

interface Screenshot {
  id: number;
  dataUrl: string;
}

const MAX_SCREENSHOTS = 4;

export default function CADToPDP() {
  const [hasModel, setHasModel] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [meshes, setMeshes] = useState<MeshItemData[]>([]);
  const [transformMode, setTransformMode] = useState("orbit");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [lightboxShot, setLightboxShot] = useState<Screenshot | null>(null);

  const canvasRef = useRef<CADCanvasHandle>(null);
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const selectedMeshNames = useMemo(
    () => new Set(meshes.filter((m) => m.selected).map((m) => m.name)),
    [meshes]
  );

  const selectedNames = useMemo(
    () => meshes.filter((m) => m.selected).map((m) => m.name),
    [meshes]
  );

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "glb" && ext !== "gltf") {
      toast.error("Please upload a GLB or GLTF file");
      return;
    }
    const url = URL.createObjectURL(file);
    if (glbUrl?.startsWith("blob:")) URL.revokeObjectURL(glbUrl);
    setGlbUrl(url);
    setHasModel(true);
    setIsModelLoading(true);
    setMeshes([]);
  }, [glbUrl]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleMeshesDetected = useCallback((detected: { name: string; verts: number; faces: number }[]) => {
    setMeshes(detected.map((d) => ({ ...d, visible: true, selected: false })));
  }, []);

  const handleModelReady = useCallback(() => {
    setIsModelLoading(false);
    toast.success("Model loaded");
  }, []);

  const handleSelectMesh = useCallback((name: string, multi: boolean) => {
    if (!name) {
      setMeshes((prev) => prev.map((m) => ({ ...m, selected: false })));
      return;
    }
    setMeshes((prev) =>
      prev.map((m) =>
        m.name === name
          ? { ...m, selected: multi ? !m.selected : true }
          : multi ? m : { ...m, selected: false }
      )
    );
  }, []);

  const handleApplyMaterial = useCallback((matId: string) => {
    if (selectedNames.length === 0) {
      toast.error("Select a layer first");
      return;
    }
    canvasRef.current?.applyMaterial(matId, selectedNames);
  }, [selectedNames]);

  const captureScreenshot = useCallback(() => {
    if (screenshots.length >= MAX_SCREENSHOTS) {
      toast.error(`Max ${MAX_SCREENSHOTS} screenshots — remove one first`);
      return;
    }
    const canvas = viewportRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      toast.error("Viewport not ready");
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl || dataUrl === "data:,") {
        toast.error("Screenshot failed — orbit the model first to render a frame");
        return;
      }
      setScreenshots((prev) => [...prev, { id: Date.now(), dataUrl }]);
      toast.success("Screenshot captured");
    } catch {
      toast.error("Screenshot failed");
    }
  }, [screenshots.length]);

  const removeScreenshot = useCallback((id: number) => {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
    setLightboxShot((prev) => (prev?.id === id ? null : prev));
  }, []);

  // ── Upload screen ──
  if (!hasModel) {
    return (
      <div className="min-h-[calc(100dvh-5rem)] bg-background flex flex-col items-center justify-center px-4 sm:px-6 overflow-x-hidden">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="font-display text-5xl md:text-6xl lg:text-[8rem] uppercase tracking-wide text-center text-foreground leading-none mb-4"
        >
          CAD to <span className="hero-accent-text">PDP</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase text-center mb-10"
        >
          Upload a CAD model to inspect and capture product images
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="w-full max-w-2xl"
        >
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("pdp-glb-input")?.click()}
            className={`marta-frame flex flex-col items-center justify-center gap-4 p-12 md:p-16 transition-all duration-300 cursor-pointer ${
              isDragging
                ? "border-formanova-hero-accent shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)]"
                : "hover:border-formanova-hero-accent/50"
            }`}
          >
            <Diamond className="h-9 w-9 text-primary" />
            <div className="text-center">
              <p className="font-display text-2xl uppercase tracking-wide text-foreground">
                Drop your CAD file
              </p>
              <p className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground uppercase mt-2">
                GLB or GLTF — drag &amp; drop or click to browse
              </p>
            </div>
            <input
              id="pdp-glb-input"
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={onInputChange}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Workspace ──
  const footerVisible = screenshots.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-hidden bg-background">
      {/* Main panels */}
      <div className={`flex-1 min-h-0 ${footerVisible ? "pb-0" : ""}`}>
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left panel: mesh + material */}
          <ResizablePanel
            ref={leftPanelRef}
            id="pdp-left"
            order={1}
            defaultSize={22}
            minSize={15}
            maxSize={35}
            collapsible
            collapsedSize={0}
            onCollapse={() => setLeftCollapsed(true)}
            onExpand={() => setLeftCollapsed(false)}
          >
            {!leftCollapsed && (
              <PDPMeshPanel
                meshes={meshes}
                onSelectMesh={handleSelectMesh}
                onApplyMaterial={handleApplyMaterial}
              />
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Viewport */}
          <ResizablePanel id="pdp-viewport" order={2} defaultSize={78} minSize={40}>
            <div
              ref={viewportRef}
              data-cad-viewport
              className="relative h-full border-x-2 border-primary/20 shadow-[inset_0_0_30px_-10px_hsl(var(--primary)/0.15)]"
              style={{ background: "#000000" }}
            >
              {/* Panel toggles */}
              <button
                onClick={() => {
                  const p = leftPanelRef.current;
                  if (p) { leftCollapsed ? p.expand(22) : p.collapse(); }
                }}
                className="absolute top-2 left-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                title={leftCollapsed ? "Show layers" : "Hide layers"}
              >
                {leftCollapsed ? <PanelLeft className="w-4 h-4 text-foreground/70" /> : <PanelLeftClose className="w-4 h-4 text-foreground/70" />}
              </button>

              {/* Screenshot button */}
              {hasModel && !isModelLoading && (
                <button
                  onClick={captureScreenshot}
                  className="absolute top-2 right-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 transition-colors"
                  title={`Capture screenshot (${screenshots.length}/${MAX_SCREENSHOTS})`}
                >
                  <Camera className="w-4 h-4 text-foreground/70" />
                </button>
              )}

              <CADRuntimeErrorBoundary resetKeys={[glbUrl, hasModel]}>
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

              {/* Loading overlay */}
              {isModelLoading && (
                <div className="absolute inset-0 z-[20] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="font-display text-lg uppercase tracking-[0.2em] text-foreground mb-2">
                      Loading model…
                    </div>
                  </div>
                </div>
              )}

              {/* Ready indicator + screenshot count */}
              {hasModel && !isModelLoading && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 font-mono text-[9px] h-[30px]">
                  <div className="w-[6px] h-[6px] rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-muted-foreground/60 uppercase tracking-[0.1em]">Ready</span>
                  {screenshots.length > 0 && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-muted-foreground/60 uppercase tracking-[0.1em]">
                        {screenshots.length}/{MAX_SCREENSHOTS} shots
                      </span>
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
                  if (!canvasRef.current) return;
                  try {
                    const blob = await canvasRef.current.exportSceneBlob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `model-${Date.now()}.glb`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                  } catch {
                    toast.error("Export failed");
                  }
                }}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Screenshot footer */}
      <AnimatePresence>
        {footerVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 96, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-shrink-0 bg-card border-t border-border overflow-hidden"
          >
            <div className="h-full flex items-center gap-3 px-4">
              <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/50 flex-shrink-0">
                Shots
              </span>
              {screenshots.map((shot, i) => (
                <div key={shot.id} className="relative group flex-shrink-0">
                  <button
                    onClick={() => setLightboxShot(shot)}
                    className="w-16 h-16 border border-border overflow-hidden hover:border-formanova-hero-accent transition-colors"
                    title={`Screenshot ${i + 1} — click to enlarge`}
                  >
                    <img src={shot.dataUrl} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                  <button
                    onClick={() => removeScreenshot(shot.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:border-destructive"
                    title="Remove screenshot"
                  >
                    <X className="w-2.5 h-2.5 text-foreground" />
                  </button>
                </div>
              ))}
              {screenshots.length < MAX_SCREENSHOTS && (
                <button
                  onClick={captureScreenshot}
                  className="w-16 h-16 border border-dashed border-border/50 flex flex-col items-center justify-center gap-1 hover:border-formanova-hero-accent/50 transition-colors flex-shrink-0"
                  title="Capture screenshot"
                >
                  <Camera className="w-4 h-4 text-muted-foreground/40" />
                  <span className="font-mono text-[7px] text-muted-foreground/30 uppercase tracking-wider">
                    {MAX_SCREENSHOTS - screenshots.length} left
                  </span>
                </button>
              )}
            </div>
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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setLightboxShot(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxShot.dataUrl}
                alt="Screenshot"
                className="max-w-full max-h-[90vh] object-contain border border-border"
              />
              <button
                onClick={() => setLightboxShot(null)}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-card/90 border border-border hover:bg-accent/80 transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = lightboxShot.dataUrl;
                  a.download = `pdp-shot-${lightboxShot.id}.png`;
                  a.click();
                }}
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
