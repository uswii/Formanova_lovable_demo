/**
 * Tests for poll-workflow.ts
 *
 * All 11 cases from docs/POLLING_AND_RESULT_PARSING_PLAN.md section 5.
 *
 * vi.useFakeTimers() is NOT used because the helper relies on async/await
 * Promise resolution. Instead, intervalMs=0 and timeoutMs values are set
 * small so tests run in real time without noticeable delay.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollWorkflow } from './poll-workflow';

// -- Mock AuthExpiredError --

const mockAuthFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedFetch: mockAuthFetch,
  AuthExpiredError: class AuthExpiredError extends Error {
    constructor() {
      super('AUTH_EXPIRED');
      this.name = 'AuthExpiredError';
    }
  },
}));

import { AuthExpiredError } from '@/lib/authenticated-fetch';

// -- Response helpers --

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function notOk(status: number, body: unknown = {}): Response {
  return {
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response;
}

function r404(): Response {
  return notOk(404, {});
}

// -- Shared options used by most tests --

const identity = (d: unknown) => d as any;

function statusOpts(
  fetchStatus: () => Promise<Response>,
  fetchResult: () => Promise<Response>,
) {
  return {
    mode: 'status-then-result' as const,
    fetchStatus,
    fetchResult,
    resolveState: (d: any) => d?.state ?? 'running',
    parseResult: identity,
    intervalMs: 0,
    timeoutMs: 5000,
  };
}

function directOpts(fetchResult: () => Promise<Response>) {
  return {
    mode: 'result-direct' as const,
    fetchResult,
    parseResult: identity,
    intervalMs: 0,
    timeoutMs: 5000,
  };
}

beforeEach(() => {
  mockAuthFetch.mockReset();
});

// -- Tests --

describe('pollWorkflow - status-then-result mode', () => {

  it('test 1: status completed -> fetches result -> returns completed', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce(okJson({ state: 'completed' }));
    const fetchResult = vi.fn()
      .mockResolvedValueOnce(okJson({ output: 'image.jpg' }));

    const out = await pollWorkflow(statusOpts(fetchStatus, fetchResult));

    expect(out.status).toBe('completed');
    expect((out as any).result).toEqual({ output: 'image.jpg' });
    expect(fetchResult).toHaveBeenCalledTimes(1);
  });

  it('test 2: status failed -> throws before fetching result', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce(okJson({ state: 'failed', error: 'GPU OOM' }));
    const fetchResult = vi.fn();

    await expect(pollWorkflow(statusOpts(fetchStatus, fetchResult)))
      .rejects.toThrow('GPU OOM');
    expect(fetchResult).not.toHaveBeenCalled();
  });

  it('test 3: status 404 over budget -> throws', async () => {
    // max404s default is 3; three 404s should throw
    const fetchStatus = vi.fn().mockResolvedValue(r404());
    const fetchResult = vi.fn();

    await expect(
      pollWorkflow({ ...statusOpts(fetchStatus, fetchResult), max404s: 3 }),
    ).rejects.toThrow('404');
    expect(fetchResult).not.toHaveBeenCalled();
  });

  it('test 4: status 404 below budget -> continues and succeeds', async () => {
    // 2 x 404, then completed - max404s=3 so should not throw
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce(r404())
      .mockResolvedValueOnce(r404())
      .mockResolvedValueOnce(okJson({ state: 'completed' }));
    const fetchResult = vi.fn()
      .mockResolvedValueOnce(okJson({ output: 'ok' }));

    const out = await pollWorkflow({ ...statusOpts(fetchStatus, fetchResult), max404s: 3 });

    expect(out.status).toBe('completed');
  });

  it('test 5: result 404 retry -> succeeds on second attempt', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce(okJson({ state: 'completed' }));
    const fetchResult = vi.fn()
      .mockResolvedValueOnce(r404())
      .mockResolvedValueOnce(okJson({ output: 'retried.jpg' }));

    const out = await pollWorkflow({
      ...statusOpts(fetchStatus, fetchResult),
      maxResultRetries: 3,
      resultRetryDelayMs: 0,
    });

    expect(out.status).toBe('completed');
    expect((out as any).result).toEqual({ output: 'retried.jpg' });
    expect(fetchResult).toHaveBeenCalledTimes(2);
  });

  it('test 6: result 404 retries exhausted -> throws', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce(okJson({ state: 'completed' }));
    // All result attempts return 404
    const fetchResult = vi.fn().mockResolvedValue(r404());

    await expect(
      pollWorkflow({
        ...statusOpts(fetchStatus, fetchResult),
        maxResultRetries: 3,
        resultRetryDelayMs: 0,
      }),
    ).rejects.toThrow('404');
    expect(fetchResult).toHaveBeenCalledTimes(3);
  });

  it('test 7: timeout -> throws', async () => {
    // Never reaches terminal state; timeout after 1 poll interval
    const fetchStatus = vi.fn()
      .mockResolvedValue(okJson({ state: 'running' }));
    const fetchResult = vi.fn();

    await expect(
      pollWorkflow({
        ...statusOpts(fetchStatus, fetchResult),
        // intervalMs 0 but timeoutMs 1 means deadline is already past after first sleep
        intervalMs: 0,
        timeoutMs: 1,
      }),
    ).rejects.toThrow('timed out');
  });

  it('test 8: AbortSignal cancellation -> returns cancelled', async () => {
    const controller = new AbortController();
    // Abort before any fetch completes
    const fetchStatus = vi.fn().mockImplementation(async () => {
      controller.abort();
      return okJson({ state: 'running' });
    });
    const fetchResult = vi.fn();

    const out = await pollWorkflow({
      ...statusOpts(fetchStatus, fetchResult),
      signal: controller.signal,
    });

    expect(out.status).toBe('cancelled');
    expect(fetchResult).not.toHaveBeenCalled();
  });

  it('test 9: AuthExpiredError propagation -> rethrows, not cancelled', async () => {
    const fetchStatus = vi.fn().mockRejectedValueOnce(new AuthExpiredError());
    const fetchResult = vi.fn();

    await expect(
      pollWorkflow(statusOpts(fetchStatus, fetchResult)),
    ).rejects.toMatchObject({ name: 'AuthExpiredError', message: 'AUTH_EXPIRED' });
  });

});

describe('pollWorkflow - result-direct mode', () => {

  it('test 10: result-direct running then success -> returns completed', async () => {
    const fetchResult = vi.fn()
      .mockResolvedValueOnce(okJson({ status: 'running' }))
      .mockResolvedValueOnce(okJson({ status: 'done', weight_g: 4.2 }));

    const out = await pollWorkflow(directOpts(fetchResult));

    expect(out.status).toBe('completed');
    expect((out as any).result).toEqual({ status: 'done', weight_g: 4.2 });
    expect(fetchResult).toHaveBeenCalledTimes(2);
  });

  it('test 11: result-direct timeout -> throws', async () => {
    const fetchResult = vi.fn()
      .mockResolvedValue(okJson({ status: 'running' }));

    await expect(
      pollWorkflow({
        ...directOpts(fetchResult),
        intervalMs: 0,
        timeoutMs: 1,
      }),
    ).rejects.toThrow('timed out');
  });

});

describe('pollWorkflow - optional features', () => {

  it('resolveTerminalNode success breaks the loop', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce(okJson({ state: 'running', node: 'success_final' }));
    const fetchResult = vi.fn()
      .mockResolvedValueOnce(okJson({ glb: 'model.glb' }));

    const out = await pollWorkflow({
      ...statusOpts(fetchStatus, fetchResult),
      resolveTerminalNode: (d: any) =>
        d?.node === 'success_final' ? 'success'
        : d?.node === 'failed_final' ? 'failure'
        : null,
    });

    expect(out.status).toBe('completed');
    expect((out as any).result).toEqual({ glb: 'model.glb' });
  });

  it('resolveTerminalNode failure throws', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce(okJson({ state: 'running', node: 'failed_final' }));
    const fetchResult = vi.fn();

    await expect(
      pollWorkflow({
        ...statusOpts(fetchStatus, fetchResult),
        resolveTerminalNode: (d: any) =>
          d?.node === 'success_final' ? 'success'
          : d?.node === 'failed_final' ? 'failure'
          : null,
      }),
    ).rejects.toThrow('terminal node');
    expect(fetchResult).not.toHaveBeenCalled();
  });

  it('onProgress is called with node info when resolveProgressNode returns a value', async () => {
    const onProgress = vi.fn();
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce(okJson({ state: 'running', active_node: 'generate_mesh', retries: 2 }))
      .mockResolvedValueOnce(okJson({ state: 'completed' }));
    const fetchResult = vi.fn()
      .mockResolvedValueOnce(okJson({}));

    await pollWorkflow({
      ...statusOpts(fetchStatus, fetchResult),
      resolveProgressNode: (d: any) =>
        d?.active_node ? { node: d.active_node, retryCount: d.retries ?? 0 } : null,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith({ node: 'generate_mesh', retryCount: 2 });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('pollErrors budget: below threshold continues, at threshold throws', async () => {
    // 9 non-ok errors, then completed - should not throw (budget=10)
    const fetchStatus = vi.fn();
    for (let i = 0; i < 9; i++) fetchStatus.mockResolvedValueOnce(notOk(500));
    fetchStatus.mockResolvedValueOnce(okJson({ state: 'completed' }));
    const fetchResult = vi.fn().mockResolvedValueOnce(okJson({}));

    const out = await pollWorkflow({
      ...statusOpts(fetchStatus, fetchResult),
      maxPollErrors: 10,
    });
    expect(out.status).toBe('completed');
  });

  it('pollErrors budget: at limit throws', async () => {
    // 10 non-ok errors - should throw at the 10th
    const fetchStatus = vi.fn().mockResolvedValue(notOk(503));
    const fetchResult = vi.fn();

    await expect(
      pollWorkflow({
        ...statusOpts(fetchStatus, fetchResult),
        maxPollErrors: 10,
      }),
    ).rejects.toThrow('503');
  });

  it('missing fetchStatus in status-then-result mode throws immediately', async () => {
    await expect(
      pollWorkflow({
        mode: 'status-then-result',
        fetchResult: async () => okJson({}),
        parseResult: identity,
      }),
    ).rejects.toThrow('fetchStatus is required');
  });

});
