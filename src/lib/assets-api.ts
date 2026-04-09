// src/lib/assets-api.ts
// Direct calls to FastAPI /assets — no proxy. authenticatedFetch handles Bearer token.

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const API_BASE = import.meta.env.VITE_PIPELINE_API_URL ?? '';

export type AssetType = 'jewelry_photo' | 'model_photo' | 'inspiration_photo';

export interface UserAsset {
  id: string;
  asset_type: AssetType;
  created_at: string;      // ISO string
  thumbnail_url: string;   // Artifact proxy URL — always load via useAuthenticatedImage, never use directly in <img src>
  name: string | null;
  metadata?: { category?: string; name?: string; display_type?: string; is_worn?: string; flagged?: string; user_override?: string; [key: string]: string | undefined };
}

export interface AssetsPage {
  items: UserAsset[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchUserAssets(
  type: AssetType,
  page = 0,
  pageSize = 20,
  category?: string,
  intendedUse?: 'on_model' | 'pdp',
): Promise<AssetsPage> {
  const params = new URLSearchParams({ asset_type: type, page: String(page), page_size: String(pageSize) });
  if (category) params.set('category', category);
  if (intendedUse) params.set('intended_use', intendedUse);
  const response = await authenticatedFetch(`${API_BASE}/assets?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${type} assets: ${response.status}`);
  }
  return response.json();
}

export async function updateAssetMetadata(
  assetId: string,
  metadata: { category?: string; name?: string; display_type?: string; is_worn?: string; flagged?: string; user_override?: string },
): Promise<UserAsset> {
  const response = await authenticatedFetch(`${API_BASE}/assets/${assetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update asset: ${response.status}`);
  }
  return response.json();
}
