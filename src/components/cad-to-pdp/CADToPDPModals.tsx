import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export interface Screenshot {
  id: number;
  dataUrl: string;
}

interface WorkspacePopupProps {
  popup: { title: string; message: string } | null;
  onClose: () => void;
}

export function WorkspacePopupModal({ popup, onClose }: WorkspacePopupProps) {
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
            className="bg-card border border-border shadow-2xl w-[380px] px-8 py-7 relative"
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
            className="bg-card border border-border shadow-2xl w-[380px] px-8 py-7 relative"
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
                      <X className="w-3.5 h-3.5 text-white" />
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
}

export function LightboxModal({ shot, onClose }: LightboxModalProps) {
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
            <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-card/90 border border-border hover:bg-accent/80 transition-colors">
              <X className="w-4 h-4 text-foreground" />
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
              className="absolute bottom-2 right-2 px-3 py-1.5 bg-card/90 border border-border font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Download
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
