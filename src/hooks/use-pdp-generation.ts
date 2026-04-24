import { useState, useCallback, useRef, useEffect } from "react";

// TODO: remove once real API spec is provided — swap startJob back to real polling
// Real spec: POST /api/run/cad-to-pdp { screenshot_data_url, screenshot_id } → { run_id }
//            GET  /api/run/cad-to-pdp/status/{runId} → { status, result_url?, error? }
//            interval: 3s  timeout: 120s  404 grace: 3  error limit: 5  cancel: AbortController
const MOCK_RESULT_URL = "/cad-to-pdp/mock-pdp-result.png";
const MOCK_DELAY_MS = 2_000;

export interface GenerationJob {
  id: string;
  runId?: string;
  screenshotId: number;
  sourceDataUrl: string;
  status: "generating" | "completed" | "failed";
  resultUrl?: string;
  startedAt: number;
  errorMessage?: string;
}

export function usePDPGeneration() {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    const refs = abortRefs.current;
    return () => { refs.forEach(ac => ac.abort()); };
  }, []);

  const patchJob = useCallback((id: string, patch: Partial<GenerationJob>) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const startJob = useCallback(async (job: GenerationJob) => {
    const ac = new AbortController();
    abortRefs.current.set(job.id, ac);
    try {
      // TODO: replace with real API call once spec is provided
      await new Promise<void>(resolve => {
        const t = setTimeout(resolve, MOCK_DELAY_MS);
        ac.signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
      });
      if (ac.signal.aborted) return;
      patchJob(job.id, { status: "completed", resultUrl: MOCK_RESULT_URL });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") patchJob(job.id, { status: "failed", errorMessage: "Request failed" });
    } finally {
      abortRefs.current.delete(job.id);
    }
  }, [patchJob]);

  const generate = useCallback((screenshots: { id: number; dataUrl: string }[]) => {
    const now = Date.now();
    const newJobs: GenerationJob[] = screenshots.map((shot, i) => ({
      id: `pdp-${now}-${i}`,
      screenshotId: shot.id,
      sourceDataUrl: shot.dataUrl,
      status: "generating" as const,
      startedAt: now,
    }));
    setJobs(prev => [...newJobs, ...prev]);
    newJobs.forEach(job => { void startJob(job); });
  }, [startJob]);

  const regenerateJob = useCallback((job: GenerationJob) => {
    const newJob: GenerationJob = {
      ...job,
      id: `pdp-${Date.now()}-regen`,
      status: "generating",
      startedAt: Date.now(),
      resultUrl: undefined,
      runId: undefined,
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

  return { jobs, generate, regenerateJob, removeJob };
}
