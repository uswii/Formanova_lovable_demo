import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicSiteUrl } from './public-url';

describe('getPublicSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses a valid absolute env URL', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://staging.formanova.ai');

    expect(getPublicSiteUrl()).toBe('https://staging.formanova.ai');
  });

  it('trims trailing slashes from the env URL', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://staging.formanova.ai///');

    expect(getPublicSiteUrl()).toBe('https://staging.formanova.ai');
  });

  it('normalizes an env host without a protocol to HTTPS', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'staging.formanova.ai');

    expect(getPublicSiteUrl()).toBe('https://staging.formanova.ai');
  });

  it('falls back to window.location.origin when the env URL is unusable', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'http://');

    expect(getPublicSiteUrl()).toBe(window.location.origin);
  });

  it('uses the production fallback when env and browser origin are unavailable', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'http://');
    vi.stubGlobal('window', undefined);

    expect(getPublicSiteUrl()).toBe('https://formanova.ai');
  });
});
