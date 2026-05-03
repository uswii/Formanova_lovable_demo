// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

import { useStudioGeneration } from './useStudioGeneration';

const startPhotoshootMock = vi.fn();
const pollWorkflowMock = vi.fn();
const uploadToAzureMock = vi.fn();
const imageSourceToBlobMock = vi.fn();
const compressImageBlobMock = vi.fn();
const markGenerationStartedMock = vi.fn();
const markGenerationCompletedMock = vi.fn();
const markGenerationFailedMock = vi.fn();
const trackGenerationCompleteMock = vi.fn();
const consumeFirstGenerationMock = vi.fn(() => false);

vi.mock('@/lib/photoshoot-api', () => ({
  startPhotoshoot: (...args: unknown[]) => startPhotoshootMock(...args),
  startPdpShot: vi.fn(),
}));

vi.mock('@/lib/poll-workflow', () => ({
  pollWorkflow: (...args: unknown[]) => pollWorkflowMock(...args),
}));

vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock('@/lib/microservices-api', () => ({
  uploadToAzure: (...args: unknown[]) => uploadToAzureMock(...args),
}));

vi.mock('@/lib/image-compression', () => ({
  imageSourceToBlob: (...args: unknown[]) => imageSourceToBlobMock(...args),
  compressImageBlob: (...args: unknown[]) => compressImageBlobMock(...args),
}));

vi.mock('@/lib/generation-lifecycle', () => ({
  markGenerationStarted: (...args: unknown[]) => markGenerationStartedMock(...args),
  markGenerationCompleted: (...args: unknown[]) => markGenerationCompletedMock(...args),
  markGenerationFailed: (...args: unknown[]) => markGenerationFailedMock(...args),
}));

vi.mock('@/lib/posthog-events', () => ({
  trackPaywallHit: vi.fn(),
  trackGenerationComplete: (...args: unknown[]) => trackGenerationCompleteMock(...args),
  consumeFirstGeneration: () => consumeFirstGenerationMock(),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

beforeEach(() => {
  vi.clearAllMocks();
  imageSourceToBlobMock.mockResolvedValue(new Blob(['jewelry'], { type: 'image/jpeg' }));
  compressImageBlobMock.mockResolvedValue({
    blob: new Blob(['compressed'], { type: 'image/jpeg' }),
  });
  uploadToAzureMock.mockResolvedValue({
    sas_url: '/api/artifacts/jewelry-input',
    https_url: 'https://blob.example.com/jewelry-input.jpg',
    asset_id: '11111111-1111-1111-1111-111111111111',
  });
  startPhotoshootMock.mockResolvedValue({
    workflow_id: 'workflow-123',
    status_url: '/api/status/workflow-123',
    result_url: '/api/result/workflow-123',
  });
  pollWorkflowMock.mockResolvedValue({
    status: 'completed',
    result: {
      outputs: [
        { output_url: 'https://cdn.example.com/result.jpg' },
      ],
    },
  });
});

function renderHarness() {
  const handleRef: { current: null | (() => Promise<void>) } = { current: null };

  const props = {
    checkCredits: vi.fn().mockResolvedValue(true),
    refreshCredits: vi.fn(),
    toast: vi.fn(),
    setCurrentStep: vi.fn(),
    setJewelryUploadedUrl: vi.fn(),
    setJewelrySasUrl: vi.fn(),
    setJewelryAssetId: vi.fn(),
    clearStudioSession: vi.fn(),
  };

  function Harness() {
    const hook = useStudioGeneration({
      isProductShot: false,
      effectiveJewelryType: 'necklace',
      jewelryImage: 'data:image/jpeg;base64,input',
      activeModelUrl: 'https://cdn.example.com/model.jpg',
      jewelryUploadedUrl: null,
      jewelryAssetId: null,
      selectedModel: null,
      customModelImage: 'https://cdn.example.com/model.jpg',
      modelAssetId: null,
      ...props,
    });

    handleRef.current = hook.handleGenerate;
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<Harness />);
  });

  return { handleRef, props };
}

describe('useStudioGeneration', () => {
  it('persists fallback jewelry upload URLs so feedback can reuse them later', async () => {
    const { handleRef, props } = renderHarness();

    await act(async () => {
      await handleRef.current?.();
    });

    expect(uploadToAzureMock).toHaveBeenCalledTimes(1);
    expect(props.setJewelryUploadedUrl).toHaveBeenCalledWith('/api/artifacts/jewelry-input');
    expect(props.setJewelrySasUrl).toHaveBeenCalledWith('/api/artifacts/jewelry-input');
    expect(props.setJewelryAssetId).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
    expect(startPhotoshootMock).toHaveBeenCalledWith(expect.objectContaining({
      jewelry_image_url: '/api/artifacts/jewelry-input',
    }));
  });
});
