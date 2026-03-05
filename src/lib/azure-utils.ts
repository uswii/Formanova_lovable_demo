/**
 * Shared Azure blob storage utilities.
 * Convert azure://container/path URIs to public blob URLs.
 */

/** Convert azure://container/path → public blob URL. Returns empty string for falsy input. */
export function azureUriToUrl(uri: string | undefined | null): string {
  if (!uri || typeof uri !== 'string') return '';
  if (uri.startsWith('azure://')) {
    const path = uri.replace('azure://', '');
    return `https://snapwear.blob.core.windows.net/${path}`;
  }
  return uri;
}
