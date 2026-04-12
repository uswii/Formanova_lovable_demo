/**
 * Tests for use-image-validation.ts
 *
 * Uses React createRoot + act (available in jsdom) instead of
 * @testing-library/react renderHook, which is not installed.
 *
 * jsdom <21 does not implement Blob.prototype.arrayBuffer — polyfilled below.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useImageValidation } from './use-image-validation';
import { AuthExpiredError } from '@/lib/authenticated-fetch';

// ── React act environment flag ────────────────────────────────────────────────
// Suppresses "not configured to support act()" warning in jsdom without
// a full @testing-library/react setup.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ── jsdom <21 polyfill: Blob.prototype.arrayBuffer ───────────────────────────
// jsdom 20 (used by this project) does not implement arrayBuffer().
// fileToBase64 calls file.arrayBuffer() before compressImageBlob, so without
// this polyfill the test crashes before reaching authenticatedFetch.
beforeAll(() => {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function () {
      return Promise.resolve(new ArrayBuffer(0));
    };
  }
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

// compressImageBlob: return the blob unchanged (bypasses real image processing)
vi.mock('@/lib/image-compression', () => ({
  compressImageBlob: vi.fn(async (blob: Blob) => ({ blob })),
}));

// uploadToAzure: return a fake URL immediately
vi.mock('@/lib/microservices-api', () => ({
  uploadToAzure: vi.fn(async () => ({
    sas_url: 'https://fake.cdn/jewelry.jpg',
    https_url: 'https://fake.cdn/jewelry.jpg',
    asset_id: null,
  })),
}));

// fetchUserAssets: empty (no cached classification — forces real workflow path)
// updateAssetMetadata: no-op
vi.mock('@/lib/assets-api', () => ({
  fetchUserAssets: vi.fn(async () => ({ items: [] })),
  updateAssetMetadata: vi.fn(async () => {}),
}));

// ── Hook test harness ─────────────────────────────────────────────────────────

type HookApi = ReturnType<typeof useImageValidation>;

async function mountHook(): Promise<{ api: HookApi; unmount: () => void }> {
  let api!: HookApi;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function Harness() {
    api = useImageValidation();
    return null;
  }

  await act(async () => {
    root.render(React.createElement(Harness));
  });

  return {
    api,
    unmount: () => {
      act(() => { root.unmount(); });
      container.remove();
    },
  };
}

/** File with polyfilled arrayBuffer so the pipeline reaches authenticatedFetch */
function makeFile(content = 'x'): File {
  const file = new File([content], 'test.jpg', { type: 'image/jpeg' });
  // Belt-and-suspenders: override instance method in case prototype polyfill
  // above hasn't propagated yet (execution order in some environments).
  (file as any).arrayBuffer = async () => new ArrayBuffer(0);
  return file;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useImageValidation — AuthExpiredError propagation', () => {
  let unmount: (() => void) | undefined;

  beforeEach(() => {
    mockAuthFetch.mockReset();
    unmount = undefined;
  });

  afterEach(() => {
    unmount?.();
  });

  it('rethrows AuthExpiredError — not converted to validation fallback', async () => {
    // authenticatedFetch throws AuthExpiredError (session expired mid-classification).
    // Must be a real instance of the mocked class — instanceof checks fail on plain
    // Error objects with a patched .name.
    mockAuthFetch.mockRejectedValue(new AuthExpiredError());

    const mounted = await mountHook();
    unmount = mounted.unmount;

    await expect(
      mounted.api.validateImages([makeFile()], 'rings'),
    ).rejects.toMatchObject({ name: 'AuthExpiredError', message: 'AUTH_EXPIRED' });
  });

  it('does NOT rethrow AbortError — returns fallback result instead', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    mockAuthFetch.mockRejectedValue(abortErr);

    const mounted = await mountHook();
    unmount = mounted.unmount;

    // AbortError is swallowed — validateImages returns a fallback, not throws
    const result = await mounted.api.validateImages([makeFile()], 'rings');
    expect(result).not.toBeNull();
    expect(result?.all_acceptable).toBe(true);
  });

  it('does NOT rethrow generic network errors — returns fallback result instead', async () => {
    mockAuthFetch.mockRejectedValue(new Error('Network error'));

    const mounted = await mountHook();
    unmount = mounted.unmount;

    const result = await mounted.api.validateImages([makeFile()], 'rings');
    expect(result).not.toBeNull();
    expect(result?.all_acceptable).toBe(true);
  });
});
