/**
 * Photoshoot Generation API
 * POST /run/state/jewelry_photoshoots_generator
 *
 * Uses authenticatedFetch for centralized JWT auth & 401 handling.
 * Jewelry image URL comes from the classification step (azure-upload → classify → reuse URL).
 */

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const API_BASE = import.meta.env.DEV ? 'https://formanova.ai/api' : '/api';

// ─── Types ──────────────────────────────────────────────────────────

export interface PhotoshootStartRequest {
  jewelry_image_url: string;
  model_image_url: string;
  category: string;
  idempotency_key?: string;
}

export interface PhotoshootStartResponse {
  workflow_id: string;
  status_url: string;
  result_url: string;
  projected_cost?: number;
  authorized_budget?: number;
}

export interface PhotoshootStatusResponse {
  runtime?: {
    state: 'running' | 'completed' | 'failed';
  };
  progress?: {
    state: 'running' | 'completed' | 'failed';
    total_nodes?: number;
    completed_nodes?: number;
    visited?: string[];
  };
  state?: 'running' | 'completed' | 'failed';
  error?: string;
}

export interface PhotoshootResultResponse {
  [key: string]: unknown[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function normalizeApiUrl(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return API_BASE;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/api/')) return `${API_BASE}${trimmed.slice(4)}`;
  if (trimmed.startsWith('/')) return `${API_BASE}${trimmed}`;
  return `${API_BASE}/${trimmed}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { __non_json: true, __raw_text: text };
  }
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as Record<string, unknown>;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    const msgs = data.detail
      .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).msg : null))
      .filter((m): m is string => typeof m === 'string');
    if (msgs.length > 0) return msgs.join('; ');
  }
  if (typeof data.error === 'string') return data.error;
  if (data.__non_json) {
    const raw = String(data.__raw_text ?? '').trim().toLowerCase();
    if (raw.includes('<!doctype') || raw.includes('<html')) {
      return `${fallback} (received HTML instead of JSON — check API routing)`;
    }
    return `${fallback} (received non-JSON response)`;
  }
  return fallback;
}

// ─── Start Photoshoot ───────────────────────────────────────────────

export async function startPhotoshoot(
  request: PhotoshootStartRequest,
): Promise<PhotoshootStartResponse> {
  if (!request.jewelry_image_url || typeof request.jewelry_image_url !== 'string') {
    throw new Error('A valid jewelry image URL must be provided.');
  }
  if (!request.model_image_url || typeof request.model_image_url !== 'string') {
    throw new Error('A valid model image URL must be provided.');
  }

  const res = await authenticatedFetch(`${API_BASE}/run/state/jewelry_photoshoots_generator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: request }),
  });

  const payload = await readResponseBody(res);

  if (!res.ok) {
    throw new Error(getApiErrorMessage(payload, `Failed to start photoshoot (${res.status})`));
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Photoshoot start response is invalid');
  }

  const data = payload as Record<string, unknown>;
  const workflow_id = String(data.workflowId || data.workflow_id || '').trim();
  if (!workflow_id) {
    throw new Error('Photoshoot start response missing workflow_id');
  }

  return {
    workflow_id,
    status_url: typeof data.status_url === 'string' ? normalizeApiUrl(data.status_url) : `${API_BASE}/status/${encodeURIComponent(workflow_id)}`,
    result_url: typeof data.result_url === 'string' ? normalizeApiUrl(data.result_url) : `${API_BASE}/result/${encodeURIComponent(workflow_id)}`,
    projected_cost: typeof data.projected_cost === 'number' ? data.projected_cost : undefined,
    authorized_budget: typeof data.authorized_budget === 'number' ? data.authorized_budget : undefined,
  };
}

// ─── Poll Status ────────────────────────────────────────────────────

export async function getPhotoshootStatus(
  workflowId: string,
): Promise<PhotoshootStatusResponse> {
  const res = await authenticatedFetch(`${API_BASE}/status/${encodeURIComponent(workflowId)}`);

  if (res.status === 404) {
    return { state: 'running' };
  }

  const payload = await readResponseBody(res);

  if (!res.ok) {
    throw new Error(getApiErrorMessage(payload, `Status check failed (${res.status})`));
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { state: 'running' };
  }

  const data = payload as Record<string, unknown>;
  if (data.__non_json) {
    console.warn('[photoshoot-api] Status returned non-JSON, treating as running');
    return { state: 'running' };
  }

  return data as PhotoshootStatusResponse;
}

// ─── Get Result (with retry for result-write lag) ───────────────────

export async function getPhotoshootResult(
  workflowId: string,
  maxRetries: number = 5,
  retryDelayMs: number = 1000,
): Promise<PhotoshootResultResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, retryDelayMs));
    }

    const res = await authenticatedFetch(`${API_BASE}/result/${encodeURIComponent(workflowId)}`);

    // 404 = result not written yet — retry
    if (res.status === 404) {
      lastError = new Error('Result not ready yet (404)');
      console.log(`[photoshoot-api] Result 404, retry ${attempt + 1}/${maxRetries}`);
      continue;
    }

    const payload = await readResponseBody(res);

    if (!res.ok) {
      throw new Error(getApiErrorMessage(payload, `Result fetch failed (${res.status})`));
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Result fetch returned invalid response');
    }

    const data = payload as Record<string, unknown>;
    if (data.__non_json) {
      lastError = new Error(getApiErrorMessage(data, 'Result not ready'));
      console.log(`[photoshoot-api] Result non-JSON, retry ${attempt + 1}/${maxRetries}`);
      continue;
    }

    return data as PhotoshootResultResponse;
  }

  throw lastError || new Error('Result fetch exhausted retries');
}

/**
 * Helper to resolve the runtime state from a status response.
 * Checks runtime.state first, then progress.state, then top-level state.
 */
export function resolveWorkflowState(
  status: PhotoshootStatusResponse,
): 'running' | 'completed' | 'failed' | 'unknown' {
  return status.runtime?.state || status.progress?.state || status.state || 'unknown';
}
