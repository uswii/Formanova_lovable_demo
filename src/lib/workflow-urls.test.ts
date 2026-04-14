import { describe, expect, it } from 'vitest';
import { resolveWorkflowApiUrl } from './workflow-urls';

describe('resolveWorkflowApiUrl', () => {
  it('uses the fallback when returned URL is missing', () => {
    expect(resolveWorkflowApiUrl(undefined, '/api/result/wf1')).toBe('/api/result/wf1');
    expect(resolveWorkflowApiUrl('', '/api/result/wf1')).toBe('/api/result/wf1');
  });

  it('uses returned relative URLs directly', () => {
    expect(resolveWorkflowApiUrl('/api/result/wf1', '/api/result/fallback')).toBe('/api/result/wf1');
  });

  it('normalizes same-origin absolute URLs to relative API paths', () => {
    expect(
      resolveWorkflowApiUrl(`${window.location.origin}/api/result/wf1?x=1`, '/api/result/fallback'),
    ).toBe('/api/result/wf1?x=1');
  });

  it('keeps cross-origin absolute URLs intact', () => {
    expect(
      resolveWorkflowApiUrl('https://api.example.com/api/result/wf1', '/api/result/fallback'),
    ).toBe('https://api.example.com/api/result/wf1');
  });

  it('falls back when returned URL is malformed', () => {
    expect(resolveWorkflowApiUrl('http://%', '/api/result/fallback')).toBe('/api/result/fallback');
  });
});
