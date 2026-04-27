import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { renderAngles } from '@/services/cad-render-poller';
import type { CameraAngle } from '@/services/cad-render-api';

const PDP_PATH = '/cad-to-pdp';

// ── Module-level utilities ────────────────────────────────────────────────────

const toB64 = (dataUrl: string) => dataUrl.split(',')[1] ?? '';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScreenshotPayload {
  id: number;
  viewName?: string;
  dataUrl: string;
  maskDataUrl?: string | null;
}

export interface PDPJob {
  id: string;
  screenshotId: number;
  viewName: string;
  sourceDataUrl: string;
  status: 'generating' | 'completed' | 'failed';
  resultUrl?: string;
  startedAt: number;
  errorMessage?: string;
  glbFile?: File | null;
  maskDataUrl?: string | null;
}

interface PDPGenerationContextValue {
  jobs: PDPJob[];
  generate: (screenshots: ScreenshotPayload[], glbFile?: File | null) => void;
  regenerateJob: (job: PDPJob) => void;
  removeJob: (id: string) => void;
}

const PDPGenerationContext = createContext<PDPGenerationContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PDPGenerationProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<PDPJob[]>([]);
  const cancelledIds = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const pathnameRef = useRef(location.pathname);
  useEffect(() => { pathnameRef.current = location.pathname; }, [location.pathname]);

  const shownAwayToastRef = useRef(false);
  const runningCount = jobs.filter(j => j.status === 'generating').length;

  useEffect(() => {
    const awayFromPDP = !location.pathname.startsWith(PDP_PATH);
    if (awayFromPDP && runningCount > 0 && !shownAwayToastRef.current) {
      shownAwayToastRef.current = true;
      toast({
        title: 'PDP image is generating',
        description: "Keep browsing. Your generation won't be lost.",
      });
    }
    if (!awayFromPDP || runningCount === 0) shownAwayToastRef.current = false;
  }, [location.pathname, runningCount, toast]);

  const patchJob = useCallback((id: string, patch: Partial<PDPJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }, []);

  // Downloads the artifact proxy URL with auth and stores a blob URL in the job.
  // The proxy URL requires a Bearer token so we cannot use it directly in <img src>.
  const resolveAndPatch = useCallback(async (jobId: string, proxyUrl: string) => {
    try {
      const res = await authenticatedFetch(proxyUrl);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      patchJob(jobId, { status: 'completed', resultUrl: URL.createObjectURL(blob) });
      if (!pathnameRef.current.startsWith(PDP_PATH)) {
        toast({
          title: 'PDP image ready',
          action: (
            <ToastAction altText="View Results" onClick={() => navigate(PDP_PATH)}>
              View Results
            </ToastAction>
          ),
        });
      }
    } catch {
      patchJob(jobId, { status: 'failed', errorMessage: 'Failed to download rendered image.' });
    }
  }, [patchJob, toast, navigate]);

  // Uploads GLB once and runs renderAngles for the given batch.
  // angle.viewName === job.id so callbacks can identify which job to patch.
  const runBatch = useCallback(async (
    newJobs: PDPJob[],
    angles: CameraAngle[],
  ) => {
    await renderAngles({
      angles,
      cancelled: () => newJobs.every(j => cancelledIds.current.has(j.id)),
      onResult: ({ angle, imageUrl }) => {
        if (cancelledIds.current.has(angle.viewName)) return;
        void resolveAndPatch(angle.viewName, imageUrl);
      },
      onError: ({ angle, finalState }) => {
        if (cancelledIds.current.has(angle.viewName)) return;
        const msg = finalState === 'budget_exhausted'
          ? 'Insufficient credits for this generation.'
          : 'Generation failed on server.';
        patchJob(angle.viewName, { status: 'failed', errorMessage: msg });
      },
      onAllDone: () => {},
    });
  }, [patchJob, resolveAndPatch]);

  const generate = useCallback((screenshots: ScreenshotPayload[], glbFile?: File | null) => {
    if (!glbFile || screenshots.length === 0) return;

    void (async () => {
      const now = Date.now();

      // Create N job slots immediately — shown as empty thumbnails right away
      const newJobs: PDPJob[] = screenshots.map((shot, i) => ({
        id: `pdp-${now}-${i}`,
        screenshotId: shot.id,
        viewName: shot.viewName ?? `Shot ${shot.id}`,
        sourceDataUrl: shot.dataUrl,
        status: 'generating' as const,
        startedAt: now,
        glbFile,
        maskDataUrl: shot.maskDataUrl ?? null,
      }));
      setJobs(prev => [...newJobs, ...prev]);

      // Read GLB once as base64, sent inline in each angle payload (avoids nginx 413 on /upload)
      let glbBase64: string;
      try {
        glbBase64 = await fileToBase64(glbFile);
      } catch (err) {
        const msg = err instanceof Error ? `GLB read failed: ${err.message}` : 'GLB read failed.';
        newJobs.forEach(j => patchJob(j.id, { status: 'failed', errorMessage: msg }));
        return;
      }

      // angle.viewName === job.id — used to match callbacks back to jobs
      const angles: CameraAngle[] = newJobs.map((job, i) => ({
        viewName: job.id,
        glbBase64,
        colorPreviewB64: toB64(screenshots[i].dataUrl),
        binaryMaskB64: toB64(screenshots[i].maskDataUrl ?? ''),
      }));

      await runBatch(newJobs, angles);
    })();
  }, [patchJob, runBatch]);

  const regenerateJob = useCallback((job: PDPJob) => {
    void (async () => {
      const newJob: PDPJob = {
        ...job,
        id: `pdp-${Date.now()}-regen`,
        status: 'generating',
        startedAt: Date.now(),
        resultUrl: undefined,
        errorMessage: undefined,
      };
      cancelledIds.current.delete(newJob.id);
      setJobs(prev => [newJob, ...prev]);

      if (!job.glbFile || !job.maskDataUrl) {
        patchJob(newJob.id, { status: 'failed', errorMessage: 'Source data unavailable for regeneration.' });
        return;
      }

      let glbBase64: string;
      try {
        glbBase64 = await fileToBase64(job.glbFile);
      } catch (err) {
        const msg = err instanceof Error ? `GLB read failed: ${err.message}` : 'GLB read failed.';
        patchJob(newJob.id, { status: 'failed', errorMessage: msg });
        return;
      }

      const angles: CameraAngle[] = [{
        viewName: newJob.id,
        glbBase64,
        colorPreviewB64: toB64(job.sourceDataUrl),
        binaryMaskB64: toB64(job.maskDataUrl),
      }];

      await runBatch([newJob], angles);
    })();
  }, [patchJob, runBatch]);

  const removeJob = useCallback((id: string) => {
    cancelledIds.current.add(id);
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  return (
    <PDPGenerationContext.Provider value={{ jobs, generate, regenerateJob, removeJob }}>
      {children}
    </PDPGenerationContext.Provider>
  );
}

export function usePDPGenerationContext(): PDPGenerationContextValue {
  const ctx = useContext(PDPGenerationContext);
  if (!ctx) throw new Error('usePDPGenerationContext must be used inside PDPGenerationProvider');
  return ctx;
}
