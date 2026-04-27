import { describe, it, expect } from 'vitest';
import { resolveArtifactProxyUrl, extractRenderImageUrl } from './cad-render-parser';
import type { RuntimeStateResponse } from './cad-render-api';

describe('resolveArtifactProxyUrl', () => {
  it('extracts sha256 from azure:// URI with nested path', () => {
    expect(resolveArtifactProxyUrl('azure://agentic-artifacts/renders/abc/deadbeef.png'))
      .toBe('/api/artifacts/deadbeef');
  });

  it('strips any extension, not just .png', () => {
    expect(resolveArtifactProxyUrl('azure://bucket/files/abc123.jpg'))
      .toBe('/api/artifacts/abc123');
  });

  it('works with a bare filename (no directory segments)', () => {
    expect(resolveArtifactProxyUrl('sha256only.png'))
      .toBe('/api/artifacts/sha256only');
  });

  it('produces an empty-string sha when URI has no filename', () => {
    expect(resolveArtifactProxyUrl('')).toBe('/api/artifacts/');
  });
});

describe('extractRenderImageUrl', () => {
  it('returns proxy URL when render_image[0].image_artifact.uri is present', () => {
    const state: RuntimeStateResponse = {
      runtime: { state: 'completed', workflow_id: 'wf-1', total_visits: 1, queued_tokens: 0 },
      results: {
        render_image: [
          { image_artifact: { uri: 'azure://bucket/renders/deadbeef.png', type: 'image/png', bytes: 100 } },
        ],
      },
      pending_human_tasks: [],
    };
    expect(extractRenderImageUrl(state)).toBe('/api/artifacts/deadbeef');
  });

  it('returns null when render_image is absent', () => {
    const state: RuntimeStateResponse = {
      runtime: { state: 'completed', workflow_id: 'wf-1', total_visits: 1, queued_tokens: 0 },
      results: {},
      pending_human_tasks: [],
    };
    expect(extractRenderImageUrl(state)).toBeNull();
  });

  it('returns null when render_image is an empty array', () => {
    const state: RuntimeStateResponse = {
      runtime: { state: 'completed', workflow_id: 'wf-1', total_visits: 1, queued_tokens: 0 },
      results: { render_image: [] },
      pending_human_tasks: [],
    };
    expect(extractRenderImageUrl(state)).toBeNull();
  });

  it('returns null when image_artifact is absent from the first entry', () => {
    const state: RuntimeStateResponse = {
      runtime: { state: 'completed', workflow_id: 'wf-1', total_visits: 1, queued_tokens: 0 },
      results: { render_image: [{ view_name: 'front' }] },
      pending_human_tasks: [],
    };
    expect(extractRenderImageUrl(state)).toBeNull();
  });
});
