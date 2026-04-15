import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import UnifiedStudio from './UnifiedStudio';

// ── framer-motion ──────────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag: keyof JSX.IntrinsicElements) => {
      const MotionTag = React.forwardRef<HTMLElement, Record<string, unknown>>(
        ({ children, initial, animate, transition, ...props }, ref) =>
          React.createElement(tag as string, { ...props, ref }, children),
      );
      MotionTag.displayName = `motion.${String(tag)}`;
      return MotionTag;
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── contexts ───────────────────────────────────────────────────────────────
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    initializing: false,
  }),
}));

vi.mock('@/contexts/CreditsContext', () => ({
  useCredits: () => ({
    refreshCredits: vi.fn(),
    canAfford: () => true,
    getToolCost: () => 1,
  }),
}));

// ── TanStack Query ─────────────────────────────────────────────────────────
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
}));

// ── hooks ──────────────────────────────────────────────────────────────────
vi.mock('@/hooks/use-image-validation', () => ({
  useImageValidation: () => ({
    isValidating: false,
    results: [],
    validateImages: vi.fn(),
    clearValidation: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-credit-preflight', () => ({
  useCreditPreflight: () => ({
    checkCredits: vi.fn(),
    showInsufficientModal: false,
    dismissModal: vi.fn(),
    preflightResult: null,
    checking: false,
  }),
}));

vi.mock('@/hooks/useAuthenticatedImage', () => ({
  useAuthenticatedImage: (url: string | null) => url,
}));

vi.mock('@/hooks/useStudioModels', () => ({
  useStudioModels: () => ({
    myModels: [],
    setMyModels: vi.fn(),
    localPendingModels: [],
    setLocalPendingModels: vi.fn(),
    myModelsLoading: false,
    myModelsSearch: '',
    setMyModelsSearch: vi.fn(),
    mergedMyModels: [],
    isMyModelsEmptyState: true,
    fetchMyModels: vi.fn(),
    handleDeleteUserModel: vi.fn(),
    handleRenameUserModel: vi.fn(),
  }),
}));

vi.mock('@/hooks/useStudioUpload', () => ({
  useStudioUpload: () => ({
    handleJewelryUpload: vi.fn(),
    handleModelUpload: vi.fn(),
    handleSelectLibraryModel: vi.fn(),
  }),
}));

vi.mock('@/hooks/useStudioGeneration', () => ({
  useStudioGeneration: () => ({
    isGenerating: false,
    generationProgress: 0,
    generationStep: '',
    rotatingMsgIdx: 0,
    workflowId: null,
    resultImages: [],
    setResultImages: vi.fn(),
    generationError: null,
    regenerationCount: 0,
    setRegenerationCount: vi.fn(),
    feedbackOpen: false,
    setFeedbackOpen: vi.fn(),
    handleGenerate: vi.fn(),
    resetGeneration: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// ── feature flags ──────────────────────────────────────────────────────────
vi.mock('@/lib/feature-flags', () => ({
  isAltUploadLayoutEnabled: () => false,
  isFeedbackEnabled: () => false,
  isOnboardingEnabled: () => false,
  isStudioOnboardingEnabled: () => false,
  isStudioTypeSelectionEnabled: () => false,
  isProductShotGuideEnabled: () => false,
  isTestMenuEnabled: () => false,
}));

// ── onboarding / API ───────────────────────────────────────────────────────
vi.mock('@/lib/onboarding-api', () => ({
  checkUploadInstructionsSeen: vi.fn().mockResolvedValue(true),
  isTosAgreed: () => true,
  markTosAgreed: vi.fn(),
  markUploadInstructionsSeen: vi.fn().mockResolvedValue(undefined),
  checkProductShotGuideSeen: vi.fn().mockResolvedValue(true),
  markProductShotGuideSeen: vi.fn().mockResolvedValue(undefined),
  isProductShotGuideSeen: () => true,
  markProductShotGuideSeenLocal: vi.fn(),
}));

vi.mock('@/lib/assets-api', () => ({
  fetchUserAssets: vi.fn(),
  updateAssetMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/posthog-events', () => ({
  trackJewelryUploaded: vi.fn(),
  trackValidationFlagged: vi.fn(),
  trackModelSelected: vi.fn(),
  trackPaywallHit: vi.fn(),
  trackGenerationComplete: vi.fn(),
  trackDownloadClicked: vi.fn(),
  trackRegenerateClicked: vi.fn(),
  consumeFirstGeneration: vi.fn(),
  trackUploadGuideViewed: vi.fn(),
  trackUploadGuideAcknowledged: vi.fn(),
}));

vi.mock('@/lib/studio-examples', () => ({
  CATEGORY_EXAMPLES: {},
  ACCEPTABLE_EXAMPLES: {},
  LABEL_NAMES: {},
}));

// ── sub-components ─────────────────────────────────────────────────────────
vi.mock('@/components/studio/StudioGeneratingStep', () => ({
  StudioGeneratingStep: () => <div data-testid="generating-step" />,
}));

vi.mock('@/components/studio/StudioResultsStep', () => ({
  StudioResultsStep: () => <div data-testid="results-step" />,
}));

vi.mock('@/components/studio/StudioModelStep', () => ({
  StudioModelStep: () => <div data-testid="model-step" />,
}));

vi.mock('@/components/studio/AlternateUploadStep', () => ({
  AlternateUploadStep: () => <div data-testid="alt-upload-step" />,
}));

vi.mock('@/components/studio/FeedbackModal', () => ({
  FeedbackModal: () => null,
}));

vi.mock('@/components/studio/UploadGuideModal', () => ({
  UploadGuideModal: () => null,
}));

vi.mock('@/components/studio/ModelGuideModal', () => ({
  ModelGuideModal: () => null,
}));

vi.mock('@/components/studio/ProductShotGuideModal', () => ({
  ProductShotGuideModal: () => null,
}));

vi.mock('@/components/studio/StudioTestMenu', () => ({
  StudioTestMenu: () => null,
}));

vi.mock('@/components/CreditPreflightModal', () => ({
  CreditPreflightModal: () => null,
}));

// ── helpers ────────────────────────────────────────────────────────────────
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderStudio(path = '/studio/necklace') {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/studio/:type" element={<UnifiedStudio />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return container;
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('UnifiedStudio smoke tests', () => {
  it('renders Step 1 upload zone by default', () => {
    const c = renderStudio();
    expect(c.textContent).toContain('Upload Your Jewelry');
    expect(c.textContent).toContain('Step 1');
  });

  it('renders the step progress bar', () => {
    const c = renderStudio();
    // Step indicator has all three step labels
    expect(c.textContent).toContain('Upload');
    expect(c.textContent).toContain('Choose model');
    expect(c.textContent).toContain('Results');
  });

  it('does not crash for product-shot route', () => {
    const c = renderStudio('/studio/ring');
    expect(c.textContent).toContain('Upload Your Jewelry');
  });
});
