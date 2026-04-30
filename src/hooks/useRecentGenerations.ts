/**
 * Returns recent photo/product-shot generations for the Dashboard.
 * Reads from the shared sessionStorage cache populated by usePrefetchGenerations.
 * Falls back to a minimal API fetch on cache miss.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listMyWorkflows, type WorkflowSummary } from '@/lib/generation-history-api';

const CACHE_KEY = 'formanova_gen_cache_v3';

interface CachePayload {
  workflows: WorkflowSummary[];
  enriched: Record<string, Partial<WorkflowSummary>>;
  ts: number;
}

function readCache(): WorkflowSummary[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachePayload = JSON.parse(raw);
    return parsed.workflows.map(w => ({ ...w, ...(parsed.enriched[w.workflow_id] ?? {}) }));
  } catch { return null; }
}

function filterPhotos(workflows: WorkflowSummary[], limit: number): WorkflowSummary[] {
  return workflows
    .filter(w =>
      (w.source_type === 'photo' || w.source_type === 'product_shot') &&
      w.status === 'completed'
    )
    .slice(0, limit);
}

export function useRecentGenerations(limit: number) {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const cached = readCache();
    if (cached) {
      setWorkflows(filterPhotos(cached, limit));
      setIsLoading(false);
      return;
    }

    // Cache miss — light fetch, thumbnails may be absent (shown as placeholders)
    listMyWorkflows(30, 0)
      .then(raw => setWorkflows(filterPhotos(raw, limit)))
      .catch(() => { /* non-fatal */ })
      .finally(() => setIsLoading(false));
  }, [user, limit]);

  return { workflows, isLoading };
}
