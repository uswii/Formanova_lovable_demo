import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Eye, Download, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import type { PDPJob as GenerationJob } from "@/contexts/PDPGenerationContext";

interface Props {
  jobs: GenerationJob[];
  onPreview: (job: GenerationJob) => void;
  onDownload: (job: GenerationJob) => void;
  onRegenerate: (job: GenerationJob) => void;
}

export function PDPGenerationResults({ jobs, onPreview, onDownload, onRegenerate }: Props) {
  return (
    <div className="divide-y divide-border/40">
      {jobs.map((job, idx) => (
        <ResultCard
          key={job.id}
          job={job}
          index={jobs.length - idx}
          onPreview={onPreview}
          onDownload={onDownload}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  );
}

function ResultCard({
  job, index, onPreview, onDownload, onRegenerate,
}: {
  job: GenerationJob;
  index: number;
  onPreview: (job: GenerationJob) => void;
  onDownload: (job: GenerationJob) => void;
  onRegenerate: (job: GenerationJob) => void;
}) {
  const imgSrc = job.resultUrl ?? job.sourceDataUrl;
  const isGenerating = job.status === "generating";
  const isFailed = job.status === "failed";
  const isCompleted = job.status === "completed";
  const showActionRow = !isGenerating && (isCompleted || isFailed);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-3 py-3"
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail — larger */}
        <div
          className={`relative flex-shrink-0 w-20 h-20 border border-border overflow-hidden bg-muted/20${isCompleted ? " cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
          onClick={() => isCompleted && onPreview(job)}
          role={isCompleted ? "button" : undefined}
          tabIndex={isCompleted ? 0 : undefined}
          onKeyDown={isCompleted ? (e) => e.key === "Enter" && onPreview(job) : undefined}
        >
          <img
            src={imgSrc}
            alt="Result"
            className={`w-full h-full object-cover transition-all${isGenerating ? " blur-sm brightness-75" : ""}${isFailed ? " opacity-40" : ""}`}
          />
          <span className="absolute top-1 left-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-black/60 font-mono text-[8px] text-white/80">
            {index}
          </span>
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            </div>
          )}
          {isFailed && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 overflow-hidden pt-0.5">
          {/* Status row */}
          <div className="mb-3 flex items-center gap-1.5">
            {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-formanova-success" />}
            {isFailed && <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-destructive" />}
            <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em]${isCompleted ? " text-formanova-success" : isFailed ? " text-destructive" : " text-muted-foreground"}`}>
              {isGenerating ? "Generating…" : isCompleted ? "Completed" : "Failed"}
            </span>
          </div>

          {/* Indeterminate progress bar while generating */}
          {isGenerating && (
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-border/30">
              <motion.div
                className="h-full w-1/2 rounded-full bg-primary/60"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
              />
            </div>
          )}

          {/* Actions */}
          {showActionRow && (
            <div className={`grid gap-2 ${isCompleted ? "grid-cols-3" : "grid-cols-1"}`}>
              {isCompleted && (
                <>
                  <Btn icon={<Eye className="h-3.5 w-3.5" />} label="Preview" onClick={() => onPreview(job)} />
                  <Btn icon={<Download className="h-3.5 w-3.5" />} label="Download" onClick={() => onDownload(job)} />
                </>
              )}
              <Btn
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                label={isFailed ? "Retry" : "Regenerate"}
                onClick={() => onRegenerate(job)}
                emphasis={isCompleted ? "default" : "primary"}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Btn({
  icon,
  label,
  onClick,
  emphasis = "default",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  emphasis?: "default" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex h-11 items-center justify-center gap-2 rounded-sm border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        emphasis === "primary"
          ? "border-primary/60 bg-primary/12 text-primary hover:border-primary hover:bg-primary/18"
          : "border-border/70 bg-muted/20 text-foreground hover:border-foreground/35 hover:bg-muted/35"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
