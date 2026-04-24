import { useState, useCallback, useRef, useEffect } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

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

// start:    POST /api/run/cad-to-pdp        { screenshot_data_url, screenshot_id }  → { run_id }
// status:   GET  /api/run/cad-to-pdp/status/{runId}                                 → { status, result_url?, error? }
// terminal: "completed" | "failed"
// interval: 3 s   timeout: 120 s   404 grace: 3   error limit: 5   cancel: AbortController

const POLL_MS = 3_000;
const TIMEOUT_MS = 120_000;
const MAX_ERRORS = 5;
const MAX_404S = 3;

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

  const pollStatus = useCallback(async (jobId: string, runId: string, signal: AbortSignal) => {
    const deadline = Date.now() + TIMEOUT_MS;
    let errors = 0;
    let notFounds = 0;

    while (Date.now() < deadline && !signal.aborted) {
      await new Promise<void>(resolve => {
        const t = setTimeout(resolve, POLL_MS);
        signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
      });
      if (signal.aborted) return;

      try {
        const res = await authenticatedFetch(`/api/run/cad-to-pdp/status/${runId}`, { signal });
        if (res.status === 404) {
          if (++notFounds >= MAX_404S) { patchJob(jobId, { status: "failed", errorMessage: "Job not found" }); return; }
          continue;
        }
        if (!res.ok) {
          if (++errors >= MAX_ERRORS) { patchJob(jobId, { status: "failed", errorMessage: "Status check failed" }); return; }
          continue;
        }
        errors = 0; notFounds = 0;
        const data: { status: string; result_url?: string; resultUrl?: string; error?: string } = await res.json();
        if (data.status === "completed") {
          patchJob(jobId, { status: "completed", resultUrl: data.result_url ?? data.resultUrl });
          return;
        }
        if (data.status === "failed") {
          patchJob(jobId, { status: "failed", errorMessage: data.error ?? "Generation failed" });
          return;
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        if (++errors >= MAX_ERRORS) { patchJob(jobId, { status: "failed", errorMessage: "Network error" }); return; }
      }
    }
    if (!signal.aborted) patchJob(jobId, { status: "failed", errorMessage: "Timed out" });
  }, [patchJob]);

  const startJob = useCallback(async (job: GenerationJob) => {
    const ac = new AbortController();
    abortRefs.current.set(job.id, ac);
    try {
      const res = await authenticatedFetch("/api/run/cad-to-pdp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenshot_data_url: job.sourceDataUrl, screenshot_id: job.screenshotId }),
        signal: ac.signal,
      });
      if (!res.ok) { patchJob(job.id, { status: "failed", errorMessage: "Failed to start" }); return; }
      const data: { run_id?: string; runId?: string } = await res.json();
      const runId = data.run_id ?? data.runId ?? job.id;
      patchJob(job.id, { runId });
      await pollStatus(job.id, runId, ac.signal);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") patchJob(job.id, { status: "failed", errorMessage: "Request failed" });
    } finally {
      abortRefs.current.delete(job.id);
    }
  }, [patchJob, pollStatus]);

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
