import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedFetch: mockAuthFetch,
}));

import { submitCadRenderAngle, fetchCadRenderState } from './cad-render-api';
import type { CameraAngle, RuntimeStateResponse } from './cad-render-api';

const angle: CameraAngle = {
  viewName: 'test-view',
  glbArtifactUri: 'azure://bucket/test.glb',
  colorPreviewB64: 'base64color',
  binaryMaskB64: 'base64mask',
};

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function notOk(status: number, body: unknown = {}): Response {
  return { ok: false, status, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  mockAuthFetch.mockReset();
});

describe('submitCadRenderAngle', () => {
  it('returns workflow_id on success', async () => {
    mockAuthFetch.mockResolvedValueOnce(okJson({ workflow_id: 'wf-abc' }));

    const id = await submitCadRenderAngle(angle);

    expect(id).toBe('wf-abc');
    expect(mockAuthFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockAuthFetch.mock.calls[0];
    expect(url).toBe('/api/run/state/cad_render_v1');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.payload.view_name).toBe('test-view');
    expect(body.payload.glb_artifact.uri).toBe('azure://bucket/test.glb');
    expect(body.return_nodes).toContain('render_image');
  });

  it('includes both color and mask images in the payload', async () => {
    mockAuthFetch.mockResolvedValueOnce(okJson({ workflow_id: 'wf-1' }));
    await submitCadRenderAngle(angle);
    const body = JSON.parse(mockAuthFetch.mock.calls[0][1].body);
    expect(body.payload.images).toHaveLength(2);
    expect(body.payload.images[0].data).toBe('base64color');
    expect(body.payload.images[1].data).toBe('base64mask');
  });

  it('throws with status code on 402 (insufficient credits)', async () => {
    mockAuthFetch.mockResolvedValueOnce(notOk(402, { detail: 'Insufficient credits' }));
    await expect(submitCadRenderAngle(angle)).rejects.toThrow('[402]');
  });

  it('includes the response detail in the thrown error message', async () => {
    mockAuthFetch.mockResolvedValueOnce(notOk(422, { detail: 'Invalid payload' }));
    await expect(submitCadRenderAngle(angle)).rejects.toThrow('Invalid payload');
  });
});

describe('fetchCadRenderState', () => {
  const runningState: RuntimeStateResponse = {
    runtime: { state: 'running', workflow_id: 'wf-1', total_visits: 1, queued_tokens: 0 },
    results: {},
    pending_human_tasks: [],
  };

  it('returns parsed state on 200 and calls the correct endpoint', async () => {
    mockAuthFetch.mockResolvedValueOnce(okJson(runningState));

    const result = await fetchCadRenderState('wf-1');

    expect(result).toEqual(runningState);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/runtime/state/wf-1');
  });

  it('returns null for 404 (transient — workflow not yet visible)', async () => {
    mockAuthFetch.mockResolvedValueOnce(notOk(404));
    expect(await fetchCadRenderState('wf-1')).toBeNull();
  });

  it('returns null for 502 (transient gateway error)', async () => {
    mockAuthFetch.mockResolvedValueOnce(notOk(502));
    expect(await fetchCadRenderState('wf-1')).toBeNull();
  });

  it('returns null for 503 (transient service unavailable)', async () => {
    mockAuthFetch.mockResolvedValueOnce(notOk(503));
    expect(await fetchCadRenderState('wf-1')).toBeNull();
  });

  it('returns null for 504 (transient gateway timeout)', async () => {
    mockAuthFetch.mockResolvedValueOnce(notOk(504));
    expect(await fetchCadRenderState('wf-1')).toBeNull();
  });

  it('throws on unrecoverable 500 error', async () => {
    mockAuthFetch.mockResolvedValueOnce(notOk(500));
    await expect(fetchCadRenderState('wf-1')).rejects.toThrow('500');
  });

  it('throws on unrecoverable 403 error', async () => {
    mockAuthFetch.mockResolvedValueOnce(notOk(403));
    await expect(fetchCadRenderState('wf-1')).rejects.toThrow('403');
  });
});
