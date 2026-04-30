import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import { useBulkGeneration, type BulkGenerationPair } from './useBulkGeneration';

const startPhotoshoot = vi.fn();
const startPdpShot = vi.fn();
const markGenerationStarted = vi.fn();
const trackGeneration = vi.fn();
const navigate = vi.fn();

vi.mock('@/lib/photoshoot-api', () => ({
  startPhotoshoot: (...args: unknown[]) => startPhotoshoot(...args),
  startPdpShot: (...args: unknown[]) => startPdpShot(...args),
}));

vi.mock('@/lib/generation-lifecycle', () => ({
  markGenerationStarted: (...args: unknown[]) => markGenerationStarted(...args),
}));

vi.mock('@/contexts/GenerationsContext', () => ({
  useGenerations: () => ({
    trackGeneration: (...args: unknown[]) => trackGeneration(...args),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

function renderHookWithProps(props: {
  selectedAssets: Array<{ thumbnailUrl: string; assetId: string }>;
  assetModelPairs?: BulkGenerationPair[];
  selectedModel?: { id?: string; label?: string; url?: string } | null;
  customModelImage?: string | null;
  modelAssetId?: string | null;
  isProductShot?: boolean;
  effectiveJewelryType?: string;
  checkCredits?: (tool: string) => Promise<boolean>;
  toast?: (args: unknown) => void;
}) {
  let latest: ReturnType<typeof useBulkGeneration> | null = null;

  function Harness() {
    latest = useBulkGeneration({
      selectedAssets: props.selectedAssets,
      assetModelPairs: props.assetModelPairs ?? [],
      selectedModel: (props.selectedModel as never) ?? null,
      customModelImage: props.customModelImage ?? null,
      modelAssetId: props.modelAssetId ?? null,
      isProductShot: props.isProductShot ?? false,
      effectiveJewelryType: props.effectiveJewelryType ?? 'necklace',
      checkCredits: props.checkCredits ?? (async () => true),
      toast: props.toast ?? vi.fn(),
    });
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
  });

  return {
    get result() {
      if (!latest) throw new Error('Hook did not render');
      return latest;
    },
  };
}

describe('useBulkGeneration', () => {
  it('starts one workflow per completed pair and ignores unassigned assets', async () => {
    startPhotoshoot
      .mockResolvedValueOnce({ workflow_id: 'wf-1' })
      .mockResolvedValueOnce({ workflow_id: 'wf-2' });

    const toast = vi.fn();
    const selectedAssets = [
      { thumbnailUrl: 'j1', assetId: 'asset-1' },
      { thumbnailUrl: 'j2', assetId: 'asset-2' },
      { thumbnailUrl: 'j3', assetId: 'asset-3' },
    ];

    const assetModelPairs: BulkGenerationPair[] = [
      {
        asset: selectedAssets[0],
        assignment: { url: 'm1', label: 'Model A', presetModelId: 'preset-1' },
      },
      {
        asset: selectedAssets[2],
        assignment: { url: 'm2', label: 'Model B', modelAssetId: 'user-model-2' },
      },
    ];

    const { result } = renderHookWithProps({
      selectedAssets,
      assetModelPairs,
      toast,
    });

    await act(async () => {
      await result.handleBulkGenerate();
    });

    expect(startPhotoshoot).toHaveBeenCalledTimes(2);
    expect(startPhotoshoot).toHaveBeenNthCalledWith(1, expect.objectContaining({
      jewelry_image_url: 'j1',
      model_image_url: 'm1',
      input_preset_model_id: 'preset-1',
    }));
    expect(startPhotoshoot).toHaveBeenNthCalledWith(2, expect.objectContaining({
      jewelry_image_url: 'j3',
      model_image_url: 'm2',
      input_model_asset_id: 'user-model-2',
    }));
    expect(trackGeneration).toHaveBeenCalledTimes(2);
    expect(markGenerationStarted).toHaveBeenCalledWith('wf-1');
    expect(markGenerationStarted).toHaveBeenCalledWith('wf-2');
    expect(navigate).toHaveBeenCalledWith('/generations');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: '2 photoshoots started',
    }));
  });

  it('blocks bulk generation when pair mode has no completed assignments', async () => {
    const toast = vi.fn();
    const selectedAssets = [
      { thumbnailUrl: 'j1', assetId: 'asset-1' },
      { thumbnailUrl: 'j2', assetId: 'asset-2' },
    ];

    const { result } = renderHookWithProps({
      selectedAssets,
      assetModelPairs: [],
      toast,
    });

    await act(async () => {
      await result.handleBulkGenerate();
    });

    expect(startPhotoshoot).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No model selected',
    }));
  });
});
