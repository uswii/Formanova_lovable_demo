import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Eye, Download, RotateCcw, X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import type { PDPJob as GenerationJob } from "@/contexts/PDPGenerationContext";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface Props {
  jobs: GenerationJob[];
  onPreview: (job: GenerationJob) => void;
  onDownload: (job: GenerationJob) => void;
  onRegenerate: (job: GenerationJob) => void;
  onRemove: (id: string) => void;
}

export function PDPGenerationResults({ jobs, onPreview, onDownload, onRegenerate, onRemove }: Props) {
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
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function ResultCard({
  job, index, onPreview, onDownload, onRegenerate, onRemove,
}: {
  job: GenerationJob;
  index: number;
  onPreview: (job: GenerationJob) => void;
  onDownload: (job: GenerationJob) => void;
  onRegenerate: (job: GenerationJob) => void;
  onRemove: (id: string) => void;
}) {
  const imgSrc = job.resultUrl ?? job.sourceDataUrl;
  const isGenerating = job.status === "generating";
  const isFailed = job.status === "failed";
  const isCompleted = job.status === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-3 py-2.5 group"
    >
      <div className="flex items-start gap-2.5">
        {/* Thumbnail */}
        <div
          className={`relative flex-shrink-0 w-12 h-12 border border-border overflow-hidden bg-muted/20${isCompleted ? " hover:opacity-90 transition-opacity" : ""}`}
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
          <span className="absolute top-0.5 left-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center bg-black/60 font-mono text-[7px] text-white/80">
            {index}
          </span>
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            </div>
          )}
          {isFailed && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Status + time row */}
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <div className="flex items-center gap-1 min-w-0">
              {isGenerating && <Loader2 className="w-2.5 h-2.5 flex-shrink-0 animate-spin text-muted-foreground" />}
              {isCompleted && <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0 text-formanova-success" />}
              {isFailed && <AlertCircle className="w-2.5 h-2.5 flex-shrink-0 text-destructive" />}
              <span className={`font-mono text-[9px] uppercase tracking-[0.1em] truncate${isCompleted ? " text-formanova-success" : isFailed ? " text-destructive" : " text-muted-foreground"}`}>
                {isGenerating ? "Generating" : isCompleted ? "Completed" : "Failed"}
              </span>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className="font-mono text-[8px] text-muted-foreground/50 tabular-nums whitespace-nowrap">
                {timeAgo(job.startedAt)}
              </span>
              <button
                onClick={() => onRemove(job.id)}
                title="Remove"
                className="w-4 h-4 flex items-center justify-center text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground transition-all"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* Indeterminate progress bar while generating */}
          {isGenerating && (
            <div className="h-0.5 w-full bg-border/30 rounded-full overflow-hidden mb-1.5">
              <motion.div
                className="h-full bg-primary/60 rounded-full w-1/2"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
              />
            </div>
          )}

          {/* Actions */}
          {!isGenerating && (
            <div className="flex items-center gap-1 flex-wrap">
              {isCompleted && (
                <>
                  <Btn icon={<Eye className="w-2.5 h-2.5" />} label="Preview" onClick={() => onPreview(job)} />
                  <Btn icon={<Download className="w-2.5 h-2.5" />} label="Download" onClick={() => onDownload(job)} />
                </>
              )}
              <Btn
                icon={<RotateCcw className="w-2.5 h-2.5" />}
                label={isFailed ? "Retry" : "Regen"}
                onClick={() => onRegenerate(job)}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Btn({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1 px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-muted-foreground border border-border/50 hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}
