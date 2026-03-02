import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, Loader2, Camera, Box, Download } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Button } from '@/components/ui/button';
import type { WorkflowSummary } from '@/lib/generation-history-api';
import { SnapshotPreviewModal } from './SnapshotPreviewModal';
import { format } from 'date-fns';

const statusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  completed: {
    icon: <CheckCircle className="h-3 w-3" />,
    label: 'Completed',
    className: 'bg-formanova-success/10 text-formanova-success border-formanova-success/20',
  },
  failed: {
    icon: <XCircle className="h-3 w-3" />,
    label: 'Failed',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  processing: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: 'Processing',
    className: 'bg-formanova-warning/10 text-formanova-warning border-formanova-warning/20',
  },
  pending: {
    icon: <Clock className="h-3 w-3" />,
    label: 'Pending',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

const sourceIcon: Record<string, React.ReactNode> = {
  photo: <Camera className="h-3.5 w-3.5" />,
  cad_render: <Box className="h-3.5 w-3.5" />,
  cad_text: <Box className="h-3.5 w-3.5" />,
};

interface WorkflowCardProps {
  workflow: WorkflowSummary;
  index?: number;
  onClick: (id: string) => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ─── Text-to-CAD card ──────────────────────────────────────────────────────

function CadTextCard({ workflow, index }: { workflow: WorkflowSummary; index: number }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const dateStr = workflow.created_at
    ? format(new Date(workflow.created_at), 'MMM d, yyyy · HH:mm')
    : '—';

  const shots = workflow.screenshots ?? [];
  const hasShots = shots.length > 0;
  const isEnriching = !workflow.glb_url && !workflow.screenshots;

  const handleDownloadGlb = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workflow.glb_url) return;
    const a = document.createElement('a');
    a.href = workflow.glb_url;
    a.download = workflow.glb_filename || 'model.glb';
    a.target = '_blank';
    a.click();
  };

  return (
    <>
      <motion.div
        variants={itemVariants}
        className="marta-frame overflow-hidden"
      >
        {/* Card header: number + date */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground/70 select-none">
            #{index}
          </span>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
            {dateStr}
          </span>
        </div>

        {/* ── Snapshot strip ── */}
        <div className="px-4 pb-3">
          {hasShots ? (
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {shots.map((shot, i) => (
                <button
                  key={shot.angle}
                  onClick={() => setPreviewIndex(i)}
                  title={shot.angle.replace(/_/g, ' ')}
                  className="group/thumb flex-shrink-0 w-14 h-14 bg-muted overflow-hidden rounded-sm border border-border/30 hover:border-foreground/50 transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                >
                  <OptimizedImage
                    src={shot.url}
                    alt={shot.angle}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110"
                  />
                </button>
              ))}
            </div>
          ) : (
            /* Pulse placeholders while enrichment loads */
            <div className="flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-14 h-14 bg-muted/50 rounded-sm animate-pulse"
                />
              ))}
            </div>
          )}
        </div>

        {/* ── File box ── */}
        <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-sm border border-border/50 bg-muted/20 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Box className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="font-mono text-[10px] tracking-wider text-foreground truncate">
              {workflow.glb_filename || (isEnriching ? '—' : 'model.glb')}
            </span>
          </div>

          {workflow.glb_url ? (
            <Button
              size="sm"
              onClick={handleDownloadGlb}
              className="h-7 px-3 font-mono text-[10px] tracking-wider uppercase gap-1.5 flex-shrink-0"
            >
              <Download className="h-3 w-3" />
              Download GLB
            </Button>
          ) : (
            <span className="font-mono text-[9px] tracking-wider text-muted-foreground/40 uppercase flex-shrink-0">
              {isEnriching ? 'Loading…' : 'Unavailable'}
            </span>
          )}
        </div>
      </motion.div>

      {/* Snapshot preview modal */}
      {previewIndex !== null && hasShots && (
        <SnapshotPreviewModal
          screenshots={shots}
          initialIndex={previewIndex}
          glbUrl={workflow.glb_url}
          glbFilename={workflow.glb_filename}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}

// ─── Generic card (photo, cad_render) ──────────────────────────────────────

export function WorkflowCard({ workflow, index = 0, onClick }: WorkflowCardProps) {
  if (workflow.source_type === 'cad_text') {
    return <CadTextCard workflow={workflow} index={index} />;
  }

  const status = statusConfig[workflow.status] ?? statusConfig.pending;
  const dateStr = workflow.created_at
    ? format(new Date(workflow.created_at), 'MMM d, yyyy · HH:mm')
    : '—';
  const hasThumbnail = !!workflow.thumbnail_url;

  return (
    <motion.button
      variants={itemVariants}
      onClick={() => onClick(workflow.workflow_id)}
      className="group w-full text-left marta-frame p-0 overflow-hidden transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_20px_-5px_hsl(var(--formanova-hero-accent)/0.3)] cursor-pointer"
    >
      <div className={`flex ${hasThumbnail ? 'flex-row' : ''}`}>
        {hasThumbnail && (
          <div className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 bg-muted overflow-hidden">
            <OptimizedImage
              src={workflow.thumbnail_url!}
              alt={workflow.name || 'Workflow preview'}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}
        <div className="flex-1 p-5 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <Badge
              variant="outline"
              className={`gap-1 text-[10px] font-mono tracking-wider uppercase ${status.className}`}
            >
              {status.icon}
              {status.label}
            </Badge>
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
              {dateStr}
            </span>
          </div>
          <h3 className="font-display text-lg md:text-xl uppercase tracking-wide text-foreground mb-1 transition-transform duration-300 group-hover:translate-x-1">
            {workflow.name || 'Untitled Workflow'}
          </h3>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {sourceIcon[workflow.source_type]}
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase">
              {workflow.source_type === 'photo' && 'From Photos'}
              {workflow.source_type === 'cad_render' && 'CAD Render'}
              {workflow.source_type === 'unknown' && 'Generation'}
            </span>
          </div>
          {workflow.finished_at && workflow.created_at && (
            <p className="font-mono text-[9px] tracking-wider text-muted-foreground/60 mt-2">
              Duration:{' '}
              {Math.round(
                (new Date(workflow.finished_at).getTime() -
                  new Date(workflow.created_at).getTime()) /
                  1000,
              )}
              s
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}
