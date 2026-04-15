const FALLBACK_CANONICAL_ORIGIN = 'https://formanova.ai';
const DEFAULT_ALLOWED_HOSTS = ['formanova.ai', 'www.formanova.ai'];

export interface HostRedirectInput {
  hostname: string;
  pathname?: string;
  search?: string;
  hash?: string;
  publicSiteUrl?: string;
  allowedHosts?: string;
}

export interface HostRedirectDecision {
  shouldRedirect: boolean;
  redirectUrl: string | null;
}

function normalizeCanonicalOrigin(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return FALLBACK_CANONICAL_ORIGIN;

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return FALLBACK_CANONICAL_ORIGIN;
    if (!url.hostname) return FALLBACK_CANONICAL_ORIGIN;
    return url.origin.replace(/\/+$/, '');
  } catch {
    return FALLBACK_CANONICAL_ORIGIN;
  }
}

export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.')
  );
}

function normalizeAllowedPattern(pattern: string): string | null {
  const host = pattern.trim().toLowerCase();
  if (!host || host === '*') return null;

  if (host.startsWith('*.')) {
    const suffix = host.slice(2);
    if (!suffix || suffix.includes('*') || suffix.includes('/') || suffix.includes(':')) return null;
    return `*.${suffix}`;
  }

  if (host.includes('*') || host.includes('/') || host.includes(':')) return null;
  return host;
}

function parseAllowedHosts(allowedHosts: string | undefined, canonicalHost: string): string[] {
  const configured = allowedHosts?.trim()
    ? allowedHosts.split(',')
    : DEFAULT_ALLOWED_HOSTS;

  return Array.from(
    new Set(
      [canonicalHost, ...configured]
        .map(normalizeAllowedPattern)
        .filter((host): host is string => Boolean(host)),
    ),
  );
}

function matchesAllowedHost(hostname: string, allowedPatterns: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowedPatterns.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return host === pattern;
  });
}

export function getHostRedirectDecision(input: HostRedirectInput): HostRedirectDecision {
  const hostname = input.hostname.trim().toLowerCase();
  if (!hostname || isLocalDevHost(hostname)) {
    return { shouldRedirect: false, redirectUrl: null };
  }

  const canonicalOrigin = normalizeCanonicalOrigin(input.publicSiteUrl);
  const canonicalHost = new URL(canonicalOrigin).hostname.toLowerCase();
  const allowedHosts = parseAllowedHosts(input.allowedHosts, canonicalHost);

  if (matchesAllowedHost(hostname, allowedHosts)) {
    return { shouldRedirect: false, redirectUrl: null };
  }

  return {
    shouldRedirect: true,
    redirectUrl: `${canonicalOrigin}${input.pathname ?? ''}${input.search ?? ''}${input.hash ?? ''}`,
  };
}
