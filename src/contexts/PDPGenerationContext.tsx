import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

// TODO: remove once real API spec is provided — swap startJob to real polling
// Real spec: POST /api/run/cad-to-pdp { screenshot_data_url, screenshot_id } → { run_id }
//            GET  /api/run/cad-to-pdp/status/{runId} → { status, result_url?, error? }
const MOCK_RESULT_URL = '/cad-to-pdp/mock-pdp-result.png';
const MOCK_DELAY_MS = 2_000;
const PDP_PATH = '/cad-to-pdp';

export interface PDPJob {
  id: string;
  screenshotId: number;
  sourceDataUrl: string;
  status: 'generating' | 'completed' | 'failed';
  resultUrl?: string;
  startedAt: number;
  errorMessage?: string;
}

interface PDPGenerationContextValue {
  jobs: PDPJob[];
  generate: (screenshots: { id: number; dataUrl: string }[]) => void;
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

  // Stable ref so async job callbacks always read the current pathname
  const pathnameRef = useRef(location.pathname);
  useEffect(() => { pathnameRef.current = location.pathname; }, [location.pathname]);

  // When user navigates AWAY while jobs are running, show a single in-progress toast
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
      // TODO: replace with real API call once spec is provided
      await new Promise<void>(resolve => {
        const t = setTimeout(resolve, MOCK_DELAY_MS);
        ac.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
      });
      if (ac.signal.aborted) return;

      patchJob(job.id, { status: 'completed', resultUrl: MOCK_RESULT_URL });

      // Only show "ready" toast if user has navigated away
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
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        patchJob(job.id, { status: 'failed', errorMessage: 'Request failed' });
        if (!pathnameRef.current.startsWith(PDP_PATH)) {
          toast({ variant: 'destructive', title: 'PDP generation failed', description: 'Try again from the workspace.' });
        }
      }
    } finally {
      abortRefs.current.delete(job.id);
    }
  }, [patchJob, toast, navigate]);

  const generate = useCallback((screenshots: { id: number; dataUrl: string }[]) => {
    const now = Date.now();
    const newJobs: PDPJob[] = screenshots.map((shot, i) => ({
      id: `pdp-${now}-${i}`,
      screenshotId: shot.id,
      sourceDataUrl: shot.dataUrl,
      status: 'generating' as const,
      startedAt: now,
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
