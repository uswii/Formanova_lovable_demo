/**
 * Shared Azure blob storage utilities.
 * Convert azure://container/path URIs to public blob URLs.
 */

function getAzureBlobBaseUrl(): string {
  const rawBaseUrl = import.meta.env.VITE_AZURE_BLOB_BASE_URL;
  if (!rawBaseUrl || typeof rawBaseUrl !== 'string') return '';

  const trimmedBaseUrl = rawBaseUrl.trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmedBaseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return trimmedBaseUrl;
  } catch {
    return '';
  }
}

/** Convert azure://container/path to configured blob URL. Returns empty string for invalid input. */
export function azureUriToUrl(uri: string | undefined | null): string {
  if (!uri || typeof uri !== 'string') return '';
  if (uri.startsWith('azure://')) {
    const baseUrl = getAzureBlobBaseUrl();
    if (!baseUrl) return '';

    const path = uri.replace('azure://', '').replace(/^\/+/, '');
    if (!path) return '';

    return `${baseUrl}/${path}`;
  }
  return uri;
}
