import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard, Trash2, Download } from "lucide-react";

const PDP_SHORTCUT_SECTIONS = [
  {
    title: "History",
    shortcuts: [
      { keys: ["Ctrl+Z"], desc: "Undo" },
      { keys: ["Ctrl+Y", "/", "Ctrl+Shift+Z"], desc: "Redo" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["F"], desc: "Reset camera" },
      { keys: ["+"], desc: "Zoom in" },
      { keys: ["-"], desc: "Zoom out" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: ["Ctrl+A"], desc: "Select all layers" },
      { keys: ["Esc"], desc: "Deselect all" },
    ],
  },
  {
    title: "Mouse Controls",
    shortcuts: [
      { keys: ["Scroll"], desc: "Zoom" },
      { keys: ["Left Drag"], desc: "Orbit" },
      { keys: ["Right Drag"], desc: "Pan" },
      { keys: ["Click"], desc: "Select layer" },
      { keys: ["Shift+Click"], desc: "Multi-select" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 font-mono text-[10px] font-semibold bg-background border border-border rounded text-foreground whitespace-nowrap flex-shrink-0">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/20"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-4 md:top-20 left-1/2 -translate-x-1/2 z-[201] w-[calc(100vw-1.5rem)] max-w-[380px] max-h-[min(88vh,calc(100vh-2rem))] md:max-h-[min(80vh,calc(100vh-120px))] flex flex-col bg-card border border-border rounded-lg shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
                  Keyboard Shortcuts
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              {PDP_SHORTCUT_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 items-baseline">
                    {section.shortcuts.map((sc) => (
                      <div key={sc.desc} className="contents">
                        <span className="text-[11px] text-foreground/80 leading-normal text-left">{sc.desc}</span>
                        <div className="flex items-center gap-1 justify-end whitespace-nowrap flex-shrink-0">
                          {sc.keys.map((k, i) => (
                            k === "/" ? (
                              <span key={i} className="text-[9px] text-muted-foreground/50 mx-0.5">/</span>
                            ) : (
                              <Kbd key={i}>{k}</Kbd>
                            )
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export interface Screenshot {
  id: number;
  dataUrl: string;
  glbBlob?: Blob | null;
  uploadedUrl?: string | null;
  uploadedAssetId?: string | null;
  captureUri?: string | null;
  maskDataUrl?: string | null;
  maskUploadedUrl?: string | null;
  maskAssetId?: string | null;
  maskUri?: string | null;
}

interface WorkspacePopupProps {
  popup: { title: string; message: string } | null;
  onClose: () => void;
}

export function WorkspacePopupModal({ popup, onClose }: WorkspacePopupProps) {
  useEffect(() => {
    if (!popup) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [popup, onClose]);

  return (
    <AnimatePresence>
      {popup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-card border border-border shadow-2xl w-[calc(100vw-1.5rem)] max-w-[380px] px-5 md:px-8 py-6 md:py-7 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="font-display text-base uppercase tracking-[0.15em] text-foreground mb-1.5">
              {popup.title}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed mb-6">
              {popup.message}
            </p>
            <button onClick={onClose} className="w-full py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground border border-border hover:border-foreground/30 hover:text-foreground transition-colors">
              OK
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface LimitModalProps {
  open: boolean;
  screenshots: Screenshot[];
  onClose: () => void;
  onRemove: (id: number) => void;
}

export function LimitModal({ open, screenshots, onClose, onRemove }: LimitModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-card border border-border shadow-2xl w-[calc(100vw-1.5rem)] max-w-[380px] px-5 md:px-8 py-6 md:py-7 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { onRemove(shot.id); onClose(); }} title="Remove" className="w-7 h-7 flex items-center justify-center bg-destructive/80 hover:bg-destructive rounded-sm">
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="w-full py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground border border-border hover:border-foreground/30 hover:text-foreground transition-colors">
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface LightboxModalProps {
  shot: Screenshot | null;
  onClose: () => void;
  onRemove: (id: number) => void;
}

export function LightboxModal({ shot, onClose, onRemove }: LightboxModalProps) {
  useEffect(() => {
    if (!shot) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shot, onClose]);

  return (
    <AnimatePresence>
      {shot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.93, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={shot.dataUrl} alt="Screenshot" className="max-w-full max-h-[90vh] object-contain border border-border" />
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <button
                onClick={() => onRemove(shot.id)}
                className="h-8 px-3 flex items-center gap-1.5 bg-card/90 border border-border font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = shot.dataUrl;
                  a.download = `pdp-shot-${shot.id}.png`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
                className="h-8 px-3 flex items-center gap-1.5 bg-card/90 border border-border font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-card/90 border border-border hover:bg-accent/80 transition-colors">
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
