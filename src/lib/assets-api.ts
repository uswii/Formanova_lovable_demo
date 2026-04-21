// src/lib/assets-api.ts
// Direct calls to FastAPI /assets — no proxy. authenticatedFetch handles Bearer token.

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const API_BASE = import.meta.env.VITE_PIPELINE_API_URL ?? '';

export type AssetType = 'jewelry_photo' | 'model_photo' | 'inspiration_photo' | 'generated_photo' | 'generated_cad';

export interface UserAsset {
  id: string;
  asset_type: AssetType;
  created_at: string;      // ISO string
  thumbnail_url: string;   // Artifact proxy URL — always load via useAuthenticatedImage, never use directly in <img src>
  name: string | null;
  display_name?: string | null;
  artifact_sha256?: string | null;
  sha256?: string | null;
  uri?: string | null;
  artifact_url?: string | null;
  url?: string | null;
  source_workflow_id?: string | null;
  workflow_id?: string | null;
  workflow_run_id?: string | null;
  generation_workflow_id?: string | null;
  metadata?: {
    category?: string;
    name?: string;
    display_name?: string;
    asset_name?: string;
    displayName?: string;
    assetName?: string;
    label?: string;
    title?: string;
    filename?: string;
    original_filename?: string;
    artifact_sha256?: string;
    sha256?: string;
    uri?: string;
    artifact_url?: string;
    url?: string;
    source_workflow_id?: string;
    workflow_id?: string;
    workflow_run_id?: string;
    generation_workflow_id?: string;
    display_type?: string;
    is_worn?: string;
    flagged?: string;
    user_override?: string;
    [key: string]: string | undefined;
  };
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


export async function renameAsset(assetId: string, name: string): Promise<UserAsset> {
  const response = await authenticatedFetch(`${API_BASE}/assets/${assetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`Failed to rename asset: ${response.status}`);
  }
  return response.json();
}

export function isShaLikeName(value?: string | null): boolean {
  return /^[a-f0-9]{32,}$/i.test((value ?? '').replace(/\.[^.]+$/, ''));
}

function cleanDisplayName(value?: string | null): string {
  const name = (value ?? '').trim();
  return name && !isShaLikeName(name) ? name : '';
}

function cleanFilenameDisplayName(value?: string | null): string {
  return cleanDisplayName(value?.replace(/\.[^.]+$/, ''));
}

export function getAssetDisplayName(asset: UserAsset): string {
  const anyAsset = asset as UserAsset & {
    label?: string | null;
    title?: string | null;
    filename?: string | null;
    original_filename?: string | null;
    displayName?: string | null;
    assetName?: string | null;
  };

  return (
    cleanDisplayName(asset.name) ||
    cleanDisplayName(asset.display_name) ||
    cleanDisplayName(anyAsset.displayName) ||
    cleanDisplayName(anyAsset.assetName) ||
    cleanDisplayName(anyAsset.label) ||
    cleanDisplayName(anyAsset.title) ||
    cleanFilenameDisplayName(anyAsset.filename) ||
    cleanFilenameDisplayName(anyAsset.original_filename) ||
    cleanDisplayName(asset.metadata?.name) ||
    cleanDisplayName(asset.metadata?.display_name) ||
    cleanDisplayName(asset.metadata?.asset_name) ||
    cleanDisplayName(asset.metadata?.displayName) ||
    cleanDisplayName(asset.metadata?.assetName) ||
    cleanDisplayName(asset.metadata?.label) ||
    cleanDisplayName(asset.metadata?.title) ||
    cleanFilenameDisplayName(asset.metadata?.filename) ||
    cleanFilenameDisplayName(asset.metadata?.original_filename) ||
    ''
  );
}

export async function downloadAsset(assetId: string): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE}/assets/${assetId}/download`);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? assetId;
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}
