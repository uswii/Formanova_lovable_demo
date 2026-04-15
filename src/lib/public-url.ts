const FALLBACK_PUBLIC_SITE_URL = 'https://formanova.ai';

function normalizePublicSiteUrl(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function getPublicSiteUrl(): string {
  return (
    normalizePublicSiteUrl(import.meta.env.VITE_PUBLIC_SITE_URL) ||
    normalizePublicSiteUrl(typeof window !== 'undefined' ? window.location.origin : '') ||
    FALLBACK_PUBLIC_SITE_URL
  );
}
