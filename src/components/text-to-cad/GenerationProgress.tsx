import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NODE_LABELS: Record<string, string> = {
  generate_initial: "Designing your ring",
  build_initial: "Building 3D model",
  validate_output: "Polishing details",
  generate_fix: "Enhancing design",
  build_retry: "Rebuilding model",
  build_corrected: "Applying final touches",
  success_final: "Your ring is ready ✓",
  success_original_glb: "Your ring is ready ✓",
  failed_final: "We couldn't complete this one — please try again",
  _loading: "Loading model into viewport",
};

const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface GenerationProgressProps {
  visible: boolean;
  currentStep: string;
  retryAttempt?: number;
  maxAttempts?: number;
  onRetry?: () => void;
}

export default function GenerationProgress({
  visible,
  currentStep,
  retryAttempt,
  maxAttempts = 3,
  onRetry,
}: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const stageStartRef = useRef(Date.now());
  const prevStepRef = useRef(currentStep);

  // Reset stage timer when node changes
  useEffect(() => {
    if (currentStep !== prevStepRef.current) {
      stageStartRef.current = Date.now();
      setElapsed(0);
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Tick elapsed every second
  useEffect(() => {
    if (!visible || TERMINAL_NODES.has(currentStep)) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stageStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, currentStep]);

  // Reset on hide
  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      stageStartRef.current = Date.now();
    }
  }, [visible]);

  if (!visible) return null;

  const isFailed = currentStep === "failed_final";
  const isDone = currentStep === "success_final" || currentStep === "success_original_glb";
  const isTerminal = isFailed || isDone;
  const showSlowWarning = !isTerminal && elapsed > 60;

  let label = NODE_LABELS[currentStep] || "";
  if (currentStep === "generate_fix" && retryAttempt) {
    label = `Enhancing design (attempt ${retryAttempt} of ${maxAttempts})`;
  }

  // Stage ordering for dots
  const STAGE_ORDER = [
    "generate_initial", "build_initial", "validate_output",
    "generate_fix", "build_retry", "build_corrected", "success_final",
  ];
  const currentIdx = STAGE_ORDER.indexOf(currentStep);

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center flex-col bg-background/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-[420px] flex flex-col items-center text-center"
      >
        {/* Stage label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className={`font-display text-xl tracking-[0.15em] uppercase ${
              isFailed ? "text-destructive" : isDone ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </motion.div>
        </AnimatePresence>

        {/* Elapsed timer — not shown for terminal states */}
        {!isTerminal && currentStep && (
          <p className="font-mono text-[11px] text-muted-foreground/60 mt-2 tracking-wide">
            ({formatElapsed(elapsed)})
          </p>
        )}

        {/* Slow stage warning */}
        <AnimatePresence>
          {showSlowWarning && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="font-mono text-[10px] text-muted-foreground/50 mt-3 tracking-wide"
            >
              This step can take a couple of minutes — still working
            </motion.p>
          )}
        </AnimatePresence>

        {/* Pulsing line indicator — only during active stages */}
        {!isTerminal && currentStep && (
          <div className="w-full h-[1px] overflow-hidden mt-6 mb-6 bg-border">
            <motion.div
              className="h-full bg-foreground/60 w-1/3"
              animate={{ x: ["-100%", "420px"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}

        {/* Stage dots */}
        {!isFailed && (
          <div className="flex items-center gap-1.5 mt-4">
            {STAGE_ORDER.map((node, i) => {
              const isDoneStage = currentIdx >= 0 && i < currentIdx;
              const isActive = node === currentStep || (isDone && i === STAGE_ORDER.length - 1);
              return (
                <div
                  key={node}
                  className={`transition-all duration-500 ${
                    isDoneStage
                      ? "w-6 h-[2px] bg-foreground"
                      : isActive
                        ? "w-8 h-[2px] bg-foreground"
                        : "w-4 h-[1px] bg-muted-foreground/20"
                  }`}
                >
                  {isActive && !isDone && (
                    <motion.div
                      className="w-full h-full bg-foreground"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Retry button on failure */}
        {isFailed && onRetry && (
          <button
            onClick={onRetry}
            className="mt-8 px-8 py-3 text-[12px] font-bold uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
          >
            Try Again
          </button>
        )}
      </motion.div>
    </div>
  );
}
