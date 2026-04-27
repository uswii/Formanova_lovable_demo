import type { RuntimeStateResponse } from './cad-render-api';

// Converts azure:// artifact URI → auth-gated proxy URL safe for <img src> via useAuthenticatedImage.
// e.g. azure://agentic-artifacts/renders/abc/deadbeef.png → /api/artifacts/deadbeef
export function resolveArtifactProxyUrl(azureUri: string): string {
  const filename = azureUri.split('/').pop() ?? '';
  const sha256 = filename.replace(/\.[^.]+$/, '');
  return `/api/artifacts/${sha256}`;
}

export function extractRenderImageUrl(state: RuntimeStateResponse): string | null {
  const uri = state.results?.render_image?.[0]?.image_artifact?.uri;
  return uri ? resolveArtifactProxyUrl(uri) : null;
}
