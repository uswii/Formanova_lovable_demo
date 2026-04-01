import { authenticatedFetch } from '@/lib/authenticated-fetch';

export interface PresetModel {
  id: string;
  label: string;
  /** Proxy URL: https://formanova.ai/api/artifacts/<sha256> */
  url: string;
  category: string;
}

/**
 * GET /api/models — returns the list of preset models registered in the backend.
 * Auth: Bearer <jwt>
 * Response: { models: PresetModel[] } or PresetModel[]
 */
export async function fetchPresetModels(): Promise<PresetModel[]> {
  const res = await authenticatedFetch('/api/models');
  if (!res.ok) throw new Error(`Failed to fetch preset models: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.models ?? []);
}
