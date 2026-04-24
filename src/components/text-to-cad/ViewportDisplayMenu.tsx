import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const DISPLAY_OPTIONS = [
  { label: "Wireframe", available: true, onAction: "wireframe-on", offAction: "wireframe-off" },
  { label: "Flat Shading", available: false, onAction: "flat-shading-on", offAction: "flat-shading-off" },
  { label: "Bounding Box", available: false, onAction: "", offAction: "" },
  { label: "Show Normals", available: false, onAction: "", offAction: "" },
];

interface ViewportDisplayMenuProps {
  visible: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSceneAction: (action: string) => void;
  /** Position anchor — defaults to bottom-left standalone; set to "side-toolbar" for right-side anchoring */
  anchor?: "standalone" | "side-toolbar";
}

export default function ViewportDisplayMenu({ visible, open, onOpenChange, onSceneAction, anchor = "standalone" }: ViewportDisplayMenuProps) {
  const [activeToggles, setActiveToggles] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!visible) return null;

  const toggle = (opt: typeof DISPLAY_OPTIONS[number]) => {
    if (!opt.available) return;
    setActiveToggles((prev) => {
      const next = new Set(prev);
      if (next.has(opt.label)) {
        next.delete(opt.label);
        if (opt.offAction) onSceneAction(opt.offAction);
      } else {
        next.add(opt.label);
        if (opt.onAction) onSceneAction(opt.onAction);
      }
      return next;
    });
  };

  return (
    <div ref={menuRef}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] bg-card border border-border shadow-lg rounded-lg overflow-hidden z-[201]"
          >
            <div className="px-3 pt-2.5 pb-1.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Display
              </span>
            </div>
            {DISPLAY_OPTIONS.filter((opt) => opt.available).map((opt) => {
              const isActive = activeToggles.has(opt.label);
              return (
                <button
                  key={opt.label}
                  onClick={() => toggle(opt)}
                  className={`w-full px-3 py-2 text-left text-[12px] font-medium transition-all duration-150 flex items-center justify-between ${
                    isActive
                      ? "text-foreground bg-accent"
                      : "text-foreground/80 hover:bg-accent/50 cursor-pointer"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isActive && (
                    <span className="text-primary text-[10px]">●</span>
                  )}
                </button>
              );
            })}
            <div className="h-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
