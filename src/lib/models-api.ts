import { authenticatedFetch } from '@/lib/authenticated-fetch';

const ADMIN_SECRET = import.meta.env.VITE_API_ADMIN_SECRET ?? '';

export interface PresetModel {
  id: string;
  label: string;
  /** Proxy URL: https://formanova.ai/api/artifacts/<sha256> — fetch with auth headers */
  url: string;
  metadata?: Record<string, string> | null;
  /** Category id — present on legacy ModelImage, absent on API models */
  category?: string;
}

export interface PresetCategory {
  /** Stable lowercase id — use as React key and tab identifier */
  id: string;
  /** Human-readable tab title (e.g. "Ecom", "Editorial") */
  label: string;
  models: PresetModel[];
}

export interface PresetModelsResponse {
  categories: PresetCategory[];
}

/**
 * GET /api/models — returns preset models grouped by category.
 * Auth: Bearer <jwt>
 */
export async function fetchPresetModels(): Promise<PresetModelsResponse> {
  const res = await authenticatedFetch('/api/models');
  if (!res.ok) throw new Error(`Failed to fetch preset models: ${res.status}`);
  return res.json();
}

// ─── Inspirations ────────────────────────────────────────────────────────────

/** Same shape as PresetModel — id, label, url, metadata */
export type PresetInspiration = PresetModel;

export interface PresetInspirationCategory {
  id: string;
  label: string;
  inspirations: PresetInspiration[];
}

export interface PresetInspirationsResponse {
  categories: PresetInspirationCategory[];
}

/**
 * GET /api/inspirations — returns preset inspirations grouped by category.
 * Same response shape as /api/models but with `inspirations` array per category.
 * Auth: Bearer <jwt>
 */
export async function fetchPresetInspirations(): Promise<PresetInspirationsResponse> {
  const res = await authenticatedFetch('/api/inspirations');
  if (!res.ok) throw new Error(`Failed to fetch preset inspirations: ${res.status}`);
  return res.json();
}

// ─── Admin API (X-Admin-Secret) ───────────────────────────────────────────────

export interface UploadModelPayload {
  base64: string;
  content_type: string;
  category: string;
  filename: string;
  label?: string;
}

export interface UpdateModelPayload {
  label?: string;
  metadata?: Record<string, string | null>;
}

function adminHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Secret': ADMIN_SECRET,
  };
}

/**
 * POST /api/models — upload a new preset model image.
 * Returns 201 with the created PresetModel.
 */
export async function uploadModel(payload: UploadModelPayload): Promise<PresetModel> {
  const res = await authenticatedFetch('/api/models', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail ?? body?.message ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(detail), { status: res.status });
  }
  return res.json();
}

/**
 * PATCH /api/models/{id} — rename label or update metadata.
 * Returns the updated PresetModel.
 */
export async function updateModel(id: string, payload: UpdateModelPayload): Promise<PresetModel> {
  const res = await authenticatedFetch(`/api/models/${id}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail ?? body?.message ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(detail), { status: res.status });
  }
  return res.json();
}
