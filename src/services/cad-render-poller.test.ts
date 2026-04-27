/**
 * Tests for cad-render-poller.ts
 *
 * Covers: happy-path progressive completion, timeout, MAX_CONSECUTIVE_ERRORS
 * limit (both transient-null and thrown-error paths), and cancellation-on-unmount
 * (before-sleep and after-sleep variants).
 *
 * vi.useFakeTimers() controls setTimeout. mockFetchState controls state responses.
 * POLL_INTERVAL_MS = 3000ms, POLL_TIMEOUT_MS = 300000ms, MAX_CONSECUTIVE_ERRORS = 5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CameraAngle, RuntimeStateResponse } from './cad-render-api';

const mockSubmit = vi.hoisted(() => vi.fn());
const mockFetchState = vi.hoisted(() => vi.fn());

vi.mock('./cad-render-api', () => ({
  submitCadRenderAngle: mockSubmit,
  fetchCadRenderState: mockFetchState,
}));

import { renderAngles } from './cad-render-poller';

const angle: CameraAngle = {
  viewName: 'job-1',
  glbBase64: 'base64glbdata',
  colorPreviewB64: 'base64color',
  binaryMaskB64: 'base64mask',
};

function makeCompleted(imageUri = 'azure://bucket/sha256abc.png'): RuntimeStateResponse {
  return {
    runtime: { state: 'completed', workflow_id: 'wf-1', total_visits: 1, queued_tokens: 0 },
    results: {
      render_image: [{ image_artifact: { uri: imageUri, type: 'image/png', bytes: 100 } }],
    },
    pending_human_tasks: [],
  };
}

function makeRunning(): RuntimeStateResponse {
  return {
    runtime: { state: 'running', workflow_id: 'wf-1', total_visits: 1, queued_tokens: 0 },
    results: {},
    pending_human_tasks: [],
  };
}

beforeEach(() => {
  mockSubmit.mockReset();
  mockFetchState.mockReset();
});

describe('renderAngles', () => {

  it('empty angles array: calls onAllDone immediately without submitting', async () => {
    const onAllDone = vi.fn();
    await renderAngles({ angles: [], onResult: vi.fn(), onError: vi.fn(), onAllDone, cancelled: () => false });
    expect(onAllDone).toHaveBeenCalledOnce();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('happy path: single angle completes, onResult called with proxy URL', async () => {
    vi.useFakeTimers();
    try {
      mockSubmit.mockResolvedValueOnce('wf-1');
      mockFetchState.mockResolvedValueOnce(makeCompleted());

      const onResult = vi.fn();
      const onError = vi.fn();
      const onAllDone = vi.fn();

      const promise = renderAngles({ angles: [angle], onResult, onError, onAllDone, cancelled: () => false });
      await vi.advanceTimersByTimeAsync(3_001);
      await promise;

      expect(onResult).toHaveBeenCalledWith({ angle, imageUrl: '/api/artifacts/sha256abc' });
      expect(onError).not.toHaveBeenCalled();
      expect(onAllDone).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('happy path: multiple angles fill progressively, onAllDone fires after the last', async () => {
    vi.useFakeTimers();
    try {
      const angle2: CameraAngle = { ...angle, viewName: 'job-2' };
      mockSubmit
        .mockResolvedValueOnce('wf-1')
        .mockResolvedValueOnce('wf-2');
      mockFetchState.mockImplementation((id: string) => {
        if (id === 'wf-1') return Promise.resolve(makeCompleted('azure://bucket/sha1.png'));
        if (id === 'wf-2') return Promise.resolve(makeCompleted('azure://bucket/sha2.png'));
        return Promise.resolve(null);
      });

      const onResult = vi.fn();
      const onError = vi.fn();
      const onAllDone = vi.fn();

      const promise = renderAngles({ angles: [angle, angle2], onResult, onError, onAllDone, cancelled: () => false });
      await vi.advanceTimersByTimeAsync(3_001);
      await promise;

      expect(onResult).toHaveBeenCalledTimes(2);
      expect(onError).not.toHaveBeenCalled();
      expect(onAllDone).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('timeout: calls onError for each remaining pending angle, then calls onAllDone', async () => {
    vi.useFakeTimers();
    try {
      mockSubmit.mockResolvedValueOnce('wf-1');
      mockFetchState.mockResolvedValue(makeRunning());

      const onError = vi.fn();
      const onAllDone = vi.fn();

      const promise = renderAngles({ angles: [angle], onResult: vi.fn(), onError, onAllDone, cancelled: () => false });
      // Advance well past POLL_TIMEOUT_MS (300_000ms); each poll cycle is 3_000ms
      await vi.advanceTimersByTimeAsync(310_000);
      await promise;

      expect(onError).toHaveBeenCalledWith({ angle, finalState: 'failed' });
      expect(onAllDone).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('error limit (transient null): fails job after MAX_CONSECUTIVE_ERRORS=5 transient responses', async () => {
    vi.useFakeTimers();
    try {
      mockSubmit.mockResolvedValueOnce('wf-1');
      mockFetchState.mockResolvedValue(null); // always transient

      const onError = vi.fn();
      const onAllDone = vi.fn();

      const promise = renderAngles({ angles: [angle], onResult: vi.fn(), onError, onAllDone, cancelled: () => false });
      // 5 poll cycles needed to hit the error limit
      await vi.advanceTimersByTimeAsync(5 * 3_001);
      await promise;

      expect(onError).toHaveBeenCalledWith({ angle, finalState: 'failed' });
      expect(onAllDone).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('error limit (thrown error): fails job after MAX_CONSECUTIVE_ERRORS=5 thrown errors', async () => {
    vi.useFakeTimers();
    try {
      mockSubmit.mockResolvedValueOnce('wf-1');
      mockFetchState.mockRejectedValue(new Error('Network error'));

      const onError = vi.fn();
      const onAllDone = vi.fn();

      const promise = renderAngles({ angles: [angle], onResult: vi.fn(), onError, onAllDone, cancelled: () => false });
      await vi.advanceTimersByTimeAsync(5 * 3_001);
      await promise;

      expect(onError).toHaveBeenCalledWith({ angle, finalState: 'failed' });
      expect(onAllDone).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancellation before sleep (unmount): returns immediately, onAllDone not called', async () => {
    mockSubmit.mockResolvedValueOnce('wf-1');

    const onAllDone = vi.fn();
    await renderAngles({
      angles: [angle],
      onResult: vi.fn(),
      onError: vi.fn(),
      onAllDone,
      cancelled: () => true, // cancel at first check, before any sleep
    });

    expect(onAllDone).not.toHaveBeenCalled();
    expect(mockFetchState).not.toHaveBeenCalled();
  });

  it('cancellation after sleep (unmount): returns after waking, onAllDone not called', async () => {
    vi.useFakeTimers();
    try {
      mockSubmit.mockResolvedValueOnce('wf-1');

      let calls = 0;
      // First call is the pre-sleep check (returns false), second is post-sleep (returns true)
      const cancelled = () => ++calls >= 2;

      const onAllDone = vi.fn();

      const promise = renderAngles({ angles: [angle], onResult: vi.fn(), onError: vi.fn(), onAllDone, cancelled });
      await vi.advanceTimersByTimeAsync(3_001);
      await promise;

      expect(onAllDone).not.toHaveBeenCalled();
      expect(mockFetchState).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('transient errors reset: job succeeds when errors stay below MAX_CONSECUTIVE_ERRORS', async () => {
    vi.useFakeTimers();
    try {
      mockSubmit.mockResolvedValueOnce('wf-1');
      // 4 transient errors (errorCount reaches 4, < 5), then completed (resets count)
      mockFetchState
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeCompleted());

      const onResult = vi.fn();
      const onError = vi.fn();
      const onAllDone = vi.fn();

      const promise = renderAngles({ angles: [angle], onResult, onError, onAllDone, cancelled: () => false });
      await vi.advanceTimersByTimeAsync(5 * 3_001);
      await promise;

      expect(onResult).toHaveBeenCalledOnce();
      expect(onError).not.toHaveBeenCalled();
      expect(onAllDone).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('budget_exhausted terminal state: calls onError with budget_exhausted finalState', async () => {
    vi.useFakeTimers();
    try {
      mockSubmit.mockResolvedValueOnce('wf-1');
      mockFetchState.mockResolvedValueOnce({
        runtime: { state: 'budget_exhausted', workflow_id: 'wf-1', total_visits: 1, queued_tokens: 0 },
        results: {},
        pending_human_tasks: [],
      } as RuntimeStateResponse);

      const onError = vi.fn();
      const onAllDone = vi.fn();

      const promise = renderAngles({ angles: [angle], onResult: vi.fn(), onError, onAllDone, cancelled: () => false });
      await vi.advanceTimersByTimeAsync(3_001);
      await promise;

      expect(onError).toHaveBeenCalledWith({ angle, finalState: 'budget_exhausted' });
      expect(onAllDone).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

});
