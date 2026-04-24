import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

const PDP_PATH = '/cad-to-pdp';
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 120; // ~5 minutes
const MAX_TRANSIENT_404 = 5;
const MAX_CONSECUTIVE_ERRORS = 5;

interface ScreenshotPayload {
  id: number;
  dataUrl: string;
  maskDataUrl?: string | null;
}

export interface PDPJob {
  id: string;
  screenshotId: number;
  sourceDataUrl: string;
  status: 'generating' | 'completed' | 'failed';
  resultUrl?: string;
  startedAt: number;
  errorMessage?: string;
  glbFile?: File | null;
  maskDataUrl?: string | null;
  workflowId?: string | null;
}

interface PDPGenerationContextValue {
  jobs: PDPJob[];
  generate: (screenshots: ScreenshotPayload[], glbFile?: File | null) => void;
  regenerateJob: (job: PDPJob) => void;
  removeJob: (id: string) => void;
}

const PDPGenerationContext = createContext<PDPGenerationContextValue | null>(null);

export function PDPGenerationProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<PDPJob[]>([]);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());
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
    if (!awayFromPDP || runningCount === 0) {
      shownAwayToastRef.current = false;
    }
  }, [location.pathname, runningCount, toast]);

  useEffect(() => {
    const refs = abortRefs.current;
    return () => { refs.forEach(ac => ac.abort()); };
  }, []);

  const patchJob = useCallback((id: string, patch: Partial<PDPJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }, []);

  const startJob = useCallback(async (job: PDPJob) => {
    const ac = new AbortController();
    abortRefs.current.set(job.id, ac);

    try {
      if (!job.glbFile) {
        patchJob(job.id, { status: 'failed', errorMessage: 'No GLB file available for upload.' });
        return;
      }

      // Convert data URLs to blobs (raw fetch is allowed for data: URLs per AI_RULES)
      const previewBlob = await fetch(job.sourceDataUrl).then(r => r.blob());
      const maskBlob = job.maskDataUrl
        ? await fetch(job.maskDataUrl).then(r => r.blob())
        : null;

      // Upload GLB + preview + mask together as multipart per spec
      const formData = new FormData();
      formData.append('glb_file', job.glbFile, job.glbFile.name || 'model.glb');
      formData.append('preview_image', previewBlob, 'preview.png');
      if (maskBlob) formData.append('mask_image', maskBlob, 'mask.png');

      const uploadRes = await authenticatedFetch('/api/azure/upload-local-artifacts', {
        method: 'POST',
        body: formData,
        signal: ac.signal,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => 'Unknown error');
        throw new Error(`Upload failed: ${errText}`);
      }

      const uploadData = await uploadRes.json();
      const glbUri: string | undefined = uploadData?.glb_artifact?.uri;
      const previewUri: string | undefined = uploadData?.images?.[0]?.uri;
      const maskUri: string | undefined = uploadData?.images?.[1]?.uri;

      if (!glbUri) throw new Error('No GLB URI in upload response');
      if (!previewUri) throw new Error('No preview image URI in upload response');

      if (ac.signal.aborted) return;

      // Start workflow
      const startRes = await authenticatedFetch('/api/temporal/run-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          workflow_name: 'cad_render_v1',
          payload: {
            glb_artifact: { uri: glbUri },
            images: [
              { uri: previewUri },
              ...(maskUri ? [{ uri: maskUri }] : []),
            ],
          },
        }),
      });

      if (!startRes.ok) {
        const errText = await startRes.text().catch(() => 'Unknown error');
        throw new Error(`Failed to start generation: ${errText}`);
      }

      const startData = await startRes.json();
      const workflowId: string | undefined = startData?.workflow_id;
      if (!workflowId) throw new Error('No workflow_id returned from server');

      patchJob(job.id, { workflowId });

      // Poll status
      let transient404Count = 0;
      let consecutiveErrors = 0;

      for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
        if (ac.signal.aborted) return;
        await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        if (ac.signal.aborted) return;

        let statusRes: Response;
        try {
          statusRes = await authenticatedFetch(`/api/temporal/status/${workflowId}`, { signal: ac.signal });
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) throw new Error('Too many network errors while polling status');
          continue;
        }

        if (statusRes.status === 404) {
          transient404Count++;
          if (transient404Count >= MAX_TRANSIENT_404) throw new Error('Workflow not found on server');
          continue;
        }
        transient404Count = 0;

        if (!statusRes.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) throw new Error('Too many errors polling status');
          continue;
        }
        consecutiveErrors = 0;

        const statusData = await statusRes.json();
        const state: string = statusData?.runtime?.state ?? statusData?.state ?? '';

        if (state === 'budget_exhausted') {
          patchJob(job.id, { status: 'failed', errorMessage: 'Insufficient credits for this generation.' });
          return;
        }

        if (state === 'failed') {
          const errMsg = statusData?.runtime?.error ?? statusData?.error ?? 'Generation failed on server';
          throw new Error(errMsg);
        }

        if (state === 'completed') {
          const resultRes = await authenticatedFetch(`/api/temporal/result/${workflowId}`, { signal: ac.signal });
          if (!resultRes.ok) throw new Error('Failed to fetch generation result');
          const resultData = await resultRes.json();

          const imageUri: string | undefined =
            resultData?.outputs?.image_artifact?.uri ??
            resultData?.image_artifact?.uri ??
            resultData?.result?.image_artifact?.uri;
          if (!imageUri) throw new Error('No image URI in generation result');

          const downloadRes = await authenticatedFetch(
            `/api/azure/download-artifact?uri=${encodeURIComponent(imageUri)}`,
            { signal: ac.signal },
          );
          if (!downloadRes.ok) throw new Error('Failed to download generated image');
          const blob = await downloadRes.blob();
          const resultUrl = URL.createObjectURL(blob);

          patchJob(job.id, { status: 'completed', resultUrl });

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
          return;
        }
      }

      throw new Error('Generation timed out after 5 minutes');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const message = (err as Error)?.message ?? 'Request failed';
      patchJob(job.id, { status: 'failed', errorMessage: message });
      if (!pathnameRef.current.startsWith(PDP_PATH)) {
        toast({ variant: 'destructive', title: 'PDP generation failed', description: 'Try again from the workspace.' });
      }
    } finally {
      abortRefs.current.delete(job.id);
    }
  }, [patchJob, toast, navigate]);

  const generate = useCallback((screenshots: ScreenshotPayload[], glbFile?: File | null) => {
    const now = Date.now();
    const newJobs: PDPJob[] = screenshots.map((shot, i) => ({
      id: `pdp-${now}-${i}`,
      screenshotId: shot.id,
      sourceDataUrl: shot.dataUrl,
      status: 'generating' as const,
      startedAt: now,
      glbFile: glbFile ?? null,
      maskDataUrl: shot.maskDataUrl ?? null,
    }));
    setJobs(prev => [...newJobs, ...prev]);
    newJobs.forEach(job => { void startJob(job); });
  }, [startJob]);

  const regenerateJob = useCallback((job: PDPJob) => {
    const newJob: PDPJob = {
      ...job,
      id: `pdp-${Date.now()}-regen`,
      status: 'generating',
      startedAt: Date.now(),
      resultUrl: undefined,
      errorMessage: undefined,
      workflowId: undefined,
    };
    setJobs(prev => [newJob, ...prev]);
    void startJob(newJob);
  }, [startJob]);

  const removeJob = useCallback((id: string) => {
    abortRefs.current.get(id)?.abort();
    abortRefs.current.delete(id);
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
