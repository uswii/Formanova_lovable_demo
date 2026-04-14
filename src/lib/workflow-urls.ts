/**
 * Resolve backend-provided workflow URLs for authenticatedFetch.
 *
 * Same-origin absolute URLs are normalized to relative paths so runtime API
 * calls stay portable across staging/production deploys.
 */
export function resolveWorkflowApiUrl(returnedUrl: string | undefined | null, fallbackPath: string): string {
  const raw = typeof returnedUrl === 'string' ? returnedUrl.trim() : '';
  if (!raw) return fallbackPath;
  if (raw.startsWith('/')) return raw;

  try {
    const origin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : undefined;
    const parsed = new URL(raw, origin);
    if (origin && parsed.origin === origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return raw;
  } catch {
    return fallbackPath;
  }
}
