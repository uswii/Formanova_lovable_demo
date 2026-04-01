import { authenticatedFetch } from '@/lib/authenticated-fetch';

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
