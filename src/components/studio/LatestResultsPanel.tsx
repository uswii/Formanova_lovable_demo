/**
 * LatestResultsPanel
 *
 * Shows in-session generations (running + completed + failed) from GenerationsContext.
 * Desktop (lg+): renders as a sticky sidebar alongside the workspace.
 * Mobile (collapsible=true): renders as an accordion; auto-opens when a generation completes.
 *
 * No polling here — polling lives in GenerationsContext.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gem, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useGenerations } from '@/contexts/GenerationsContext';
import type { TrackedGeneration } from '@/contexts/GenerationsContext';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { TO_SINGULAR } from '@/lib/jewelry-utils';

// ── Single card ────────────────────────────────────────────────────────────────

function GenerationCard({ gen }: { gen: TrackedGeneration }) {
  const navigate = useNavigate();
  const thumb = useAuthenticatedImage(gen.resultImages[0] ?? null);

  if (gen.status === 'running') {
    return (
      <div className="relative aspect-[4/3] bg-muted overflow-hidden border border-border/20">
        <div className="absolute inset-0 bg-muted animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Gem className="h-5 w-5 text-muted-foreground/30 animate-spin" style={{ animationDuration: '2s' }} />
        </div>
        {gen.generationStep && (
          <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-background/80">
            <p className="font-mono text-[8px] text-muted-foreground truncate">{gen.generationStep}</p>
          </div>
        )}
      </div>
    );
  }

  if (gen.status === 'failed') {
    return (
      <div className="relative aspect-[4/3] bg-muted flex items-center justify-center border border-destructive/20">
        <span className="font-mono text-[8px] text-destructive/60 uppercase tracking-wider">Failed</span>
      </div>
    );
  }

  return (
    <button
      onClick={() =>
        navigate(`/studio/${gen.jewelryType}`, {
          state: { asyncResult: { workflowId: gen.workflowId, resultImages: gen.resultImages } },
        })
      }
      className="relative aspect-[4/3] bg-muted overflow-hidden w-full group border border-border/10 hover:border-formanova-hero-accent transition-colors"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
    </button>
  );
}

// ── Panel body ─────────────────────────────────────────────────────────────────

function PanelBody({
  generations,
  effectiveJewelryType,
}: {
  generations: TrackedGeneration[];
  effectiveJewelryType: string;
}) {
  const singularType = TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType;
  const items = generations.filter(g => g.jewelryType === singularType).slice(0, 8);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground">
          Recent Shoots
        </span>
        <Link
          to="/generations"
          className="font-mono text-[9px] tracking-[0.12em] uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          View all <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider py-6 text-center">
          No recent shoots
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map(g => (
            <GenerationCard key={g.workflowId} gen={g} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface LatestResultsPanelProps {
  effectiveJewelryType: string;
  /** Renders as collapsible accordion instead of always-open panel. */
  collapsible?: boolean;
}

export function LatestResultsPanel({ effectiveJewelryType, collapsible = false }: LatestResultsPanelProps) {
  const { generations } = useGenerations();
  const [open, setOpen] = useState(false);

  // Auto-open accordion when a generation completes
  useEffect(() => {
    if (!collapsible) return;
    const hasCompleted = generations.some(
      g => g.status === 'completed' && g.resultImages.length > 0,
    );
    if (hasCompleted) setOpen(true);
  }, [generations, collapsible]);

  const singularType = TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType;
  const count = generations.filter(g => g.jewelryType === singularType).length;

  if (!collapsible) {
    return <PanelBody generations={generations} effectiveJewelryType={effectiveJewelryType} />;
  }

  // Mobile collapsible — hidden entirely when no generations
  if (count === 0) return null;

  return (
    <div className="border border-border/30 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
          Recent Shoots{count > 0 ? ` (${count})` : ''}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border/20">
          <PanelBody generations={generations} effectiveJewelryType={effectiveJewelryType} />
        </div>
      )}
    </div>
  );
}
