import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Download, Sparkles, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import type { PDPJob as GenerationJob } from "@/contexts/PDPGenerationContext";
import { TOOL_COSTS } from "@/lib/credits-api";

const PRODUCT_SHOT_COST = TOOL_COSTS.Product_shot_pipeline ?? 10;

interface Props {
  jobs: GenerationJob[];
  onPreview: (job: GenerationJob) => void;
  onDownload: (job: GenerationJob) => void;
  onStylize: (job: GenerationJob) => void;
  onRegenerate: (job: GenerationJob) => void;
}

export function PDPGenerationResults({ jobs, onPreview, onDownload, onStylize, onRegenerate }: Props) {
  return (
    <div className="divide-y divide-border/40">
      {jobs.map((job, idx) => (
        <ResultCard
          key={job.id}
          job={job}
          index={jobs.length - idx}
          onPreview={onPreview}
          onDownload={onDownload}
          onStylize={onStylize}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  );
}

function ResultCard({
  job, index, onPreview, onDownload, onStylize, onRegenerate,
}: {
  job: GenerationJob;
  index: number;
  onPreview: (job: GenerationJob) => void;
  onDownload: (job: GenerationJob) => void;
  onStylize: (job: GenerationJob) => void;
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
          className={`group relative flex-shrink-0 w-20 h-20 border border-border overflow-hidden bg-muted/20${isCompleted ? " cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
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
          {isCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(job);
              }}
              title="Download"
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-sm border border-white/20 bg-black/65 text-white opacity-0 transition-all hover:bg-black/80 group-hover:opacity-100 focus:opacity-100"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
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
            <div className={`flex items-stretch gap-2 ${isCompleted ? "" : "w-full"}`}>
              {isCompleted && (
                <Btn
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Stylized Shot"
                  meta={`<= ${PRODUCT_SHOT_COST} credits`}
                  onClick={() => onStylize(job)}
                  emphasis="primary"
                  size="primary"
                />
              )}
              <Btn
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                label={isFailed ? "Retry" : "Regenerate"}
                onClick={() => onRegenerate(job)}
                emphasis={isCompleted ? "default" : "primary"}
                size={isCompleted ? "secondary" : "primary"}
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
  meta,
  onClick,
  emphasis = "default",
  size = "secondary",
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  onClick: () => void;
  emphasis?: "default" | "primary";
  size?: "primary" | "secondary";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center rounded-sm border font-mono uppercase transition-colors ${
        size === "primary"
          ? "h-12 flex-1 gap-2.5 px-4 text-[10px] font-semibold tracking-[0.12em]"
          : "h-12 gap-2 px-3 text-[9px] font-semibold tracking-[0.1em]"
      } ${
        emphasis === "primary"
          ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
          : "border-border/70 bg-muted/20 text-foreground hover:border-foreground/35 hover:bg-muted/35"
      }`}
    >
      {icon}
      <span className="flex flex-col items-start leading-none">
        <span>{label}</span>
        {meta ? <span className="mt-1 text-[8px] font-medium tracking-[0.08em] opacity-75">{meta}</span> : null}
      </span>
    </button>
  );
}
