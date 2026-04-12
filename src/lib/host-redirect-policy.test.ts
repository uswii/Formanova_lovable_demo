import { describe, expect, it } from 'vitest';
import { getHostRedirectDecision, isLocalDevHost } from './host-redirect-policy';

describe('host redirect policy', () => {
  it('allows localhost', () => {
    expect(isLocalDevHost('localhost')).toBe(true);
    expect(getHostRedirectDecision({ hostname: 'localhost' }).shouldRedirect).toBe(false);
  });

  it('allows local private IP hosts', () => {
    expect(getHostRedirectDecision({ hostname: '127.0.0.1' }).shouldRedirect).toBe(false);
    expect(getHostRedirectDecision({ hostname: '192.168.1.20' }).shouldRedirect).toBe(false);
    expect(getHostRedirectDecision({ hostname: '10.0.0.5' }).shouldRedirect).toBe(false);
  });

  it('allows formanova.ai by default', () => {
    expect(getHostRedirectDecision({ hostname: 'formanova.ai' }).shouldRedirect).toBe(false);
  });

  it('allows www.formanova.ai by default', () => {
    expect(getHostRedirectDecision({ hostname: 'www.formanova.ai' }).shouldRedirect).toBe(false);
  });

  it('allows staging through configured allowed hosts', () => {
    const decision = getHostRedirectDecision({
      hostname: 'staging.formanova.ai',
      publicSiteUrl: 'https://staging.formanova.ai',
      allowedHosts: 'staging.formanova.ai',
    });

    expect(decision.shouldRedirect).toBe(false);
  });

  it('redirects unknown hosts to canonical origin and preserves path/search/hash', () => {
    const decision = getHostRedirectDecision({
      hostname: 'preview.example.com',
      pathname: '/studio',
      search: '?step=model',
      hash: '#details',
      publicSiteUrl: 'https://staging.formanova.ai',
      allowedHosts: 'staging.formanova.ai',
    });

    expect(decision).toEqual({
      shouldRedirect: true,
      redirectUrl: 'https://staging.formanova.ai/studio?step=model#details',
    });
  });

  it('falls back safely when env values are invalid', () => {
    const decision = getHostRedirectDecision({
      hostname: 'unknown.example.com',
      pathname: '/login',
      publicSiteUrl: 'http://',
      allowedHosts: '*,https://bad.example.com,valid.example.com',
    });

    expect(decision).toEqual({
      shouldRedirect: true,
      redirectUrl: 'https://formanova.ai/login',
    });
  });

  it('supports suffix wildcard hosts without allowing the bare suffix host', () => {
    expect(getHostRedirectDecision({
      hostname: 'deploy-preview-1.vercel.app',
      allowedHosts: '*.vercel.app',
    }).shouldRedirect).toBe(false);

    expect(getHostRedirectDecision({
      hostname: 'vercel.app',
      allowedHosts: '*.vercel.app',
    }).shouldRedirect).toBe(true);
  });
});
