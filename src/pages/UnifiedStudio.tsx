import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Diamond,
  Image as ImageIcon,
  X,
  Check,
  Loader2,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { fetchPresetModels, fetchPresetInspirations, type PresetModel, type PresetModelsResponse, type PresetInspirationsResponse } from '@/lib/models-api';
import { useQuery } from '@tanstack/react-query';
import { updateAssetMetadata } from '@/lib/assets-api';
import { useImageValidation, type ImageValidationResult } from '@/hooks/use-image-validation';
import { pollWorkflow } from '@/lib/poll-workflow';
import { useCreditPreflight } from '@/hooks/use-credit-preflight';
import { CreditPreflightModal } from '@/components/CreditPreflightModal';
import { useCredits } from '@/contexts/CreditsContext';
import { useAuth } from '@/contexts/AuthContext';
import { azureUriToUrl } from '@/lib/azure-utils';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { isAltUploadLayoutEnabled, isStudioOnboardingEnabled, isStudioTypeSelectionEnabled, isProductShotGuideEnabled, isTestMenuEnabled } from '@/lib/feature-flags';
import { ModelGuideModal } from '@/components/studio/ModelGuideModal';
import { UploadGuideModal } from '@/components/studio/UploadGuideModal';
import { ProductShotGuideModal } from '@/components/studio/ProductShotGuideModal';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
import { AlternateUploadStep } from '@/components/studio/AlternateUploadStep';
import { useStudioModels } from '@/hooks/useStudioModels';
import { useStudioGeneration } from '@/hooks/useStudioGeneration';
import { useStudioUpload } from '@/hooks/useStudioUpload';
import { StudioTestMenu } from '@/components/studio/StudioTestMenu';
import { StudioGeneratingStep } from '@/components/studio/StudioGeneratingStep';
import { StudioResultsStep } from '@/components/studio/StudioResultsStep';
import { StudioModelStep } from '@/components/studio/StudioModelStep';
import { checkUploadInstructionsSeen, isTosAgreed, markTosAgreed, markUploadInstructionsSeen, checkProductShotGuideSeen, markProductShotGuideSeen, isProductShotGuideSeen, markProductShotGuideSeenLocal } from '@/lib/onboarding-api';
import {
  trackJewelryUploaded,
  trackUploadGuideViewed,
  trackUploadGuideAcknowledged,
} from '@/lib/posthog-events';
// ExampleGuidePanel removed — guide is inline

import { CATEGORY_EXAMPLES, ACCEPTABLE_EXAMPLES, LABEL_NAMES } from '@/lib/studio-examples';

const CATEGORY_TYPE_MAP: Record<string, string> = {
  necklace: 'necklace', necklaces: 'necklace',
  earring: 'earrings', earrings: 'earrings',
  ring: 'rings', rings: 'rings',
  bracelet: 'bracelets', bracelets: 'bracelets',
  watch: 'watches', watches: 'watches',
};

const MY_MODELS_STORAGE_KEY = 'formanova_my_models';
const MY_INSPIRATIONS_STORAGE_KEY = 'formanova_my_inspirations';
const MY_MODELS_VERSION = 2; // bump to invalidate stale cache

// ─── Studio session persistence (survives reloads, cleared on reset) ──────────
const STUDIO_SESSION_KEY = 'formanova_studio_session_v1';

interface StudioSession {
  jewelryType: string;
  jewelryUploadedUrl: string;
  jewelryAssetId: string | null;
  validationResult: ImageValidationResult | null;
  selectedModelId: string | null;
  customModelImage: string | null;
  modelAssetId: string | null;
}

function loadStudioSession(): StudioSession | null {
  try {
    const raw = sessionStorage.getItem(STUDIO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StudioSession) : null;
  } catch { return null; }
}

function saveStudioSession(patch: Partial<StudioSession>) {
  try {
    const existing = loadStudioSession() ?? {} as StudioSession;
    sessionStorage.setItem(STUDIO_SESSION_KEY, JSON.stringify({ ...existing, ...patch }));
  } catch { /* quota exceeded — silently ignore */ }
}

function clearStudioSession() {
  sessionStorage.removeItem(STUDIO_SESSION_KEY);
  sessionStorage.removeItem('formanova_studio_mode');
}


type StudioStep = 'upload' | 'model' | 'generating' | 'results';

function getStepFromQuery(stepParam: string | null): StudioStep {
  return stepParam === 'model' ? 'model' : 'upload';
}


export default function UnifiedStudio() {
  const { type } = useParams<{ type: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const jewelryType = type || 'necklace';
  const [overrideJewelryType, setOverrideJewelryType] = useState<string | null>(null);
  const effectiveJewelryType = overrideJewelryType ?? jewelryType;
  const { toast } = useToast();
  const { checkCredits, showInsufficientModal, dismissModal, preflightResult, checking: preflightChecking } = useCreditPreflight();
  const { refreshCredits } = useCredits();
  const { user, initializing } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<StudioStep>(() => getStepFromQuery(searchParams.get('step')));
  const [showFlaggedDialog, setShowFlaggedDialog] = useState(false);
  const step2Ref = useRef<HTMLDivElement>(null);
  const hasCheckedUploadGuide = useRef(false);
  const hasCheckedProductShotGuide = useRef(false);

  // ── Studio onboarding popup + model guide (gated) ────────────────────────
  const [uploadGuideOpen, setUploadGuideOpen] = useState(false);
  const [modelGuideOpen, setModelGuideOpen] = useState(false);
  const [productShotGuideOpen, setProductShotGuideOpen] = useState(false);

  // Jewelry image
  const jewelryInputRef = useRef<HTMLInputElement>(null);
  const [jewelryImage, setJewelryImage] = useState<string | null>(null);
  const [jewelryFile, setJewelryFile] = useState<File | null>(null);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<PresetModel | null>(null);
  const [customModelImage, setCustomModelImage] = useState<string | null>(null);
  const [customModelFile, setCustomModelFile] = useState<File | null>(null);
  const [modelAssetId, setModelAssetId] = useState<string | null>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // Must be declared before anything that references location or isProductShot
  const location = useLocation();
  const [isProductShot, setIsProductShot] = useState<boolean>(() => {
    // Prefer location.state (fresh navigation), fall back to sessionStorage (survives refresh)
    const stateMode = (location.state as any)?.mode;
    if (stateMode === 'product-shot') {
      sessionStorage.setItem('formanova_studio_mode', 'product-shot');
      return true;
    }
    if (stateMode === 'model-shot') {
      sessionStorage.removeItem('formanova_studio_mode');
      return false;
    }
    return sessionStorage.getItem('formanova_studio_mode') === 'product-shot';
  });

  const [formanovaCategory, setFormanovaCategory] = useState<string>('ecom');

  // Fetch preset models from the backend. No local fallback catalog is used.
  const { data: presetModelsData, isLoading: presetModelsLoading, isError: presetModelsError } = useQuery<PresetModelsResponse>({
    queryKey: ['preset-models'],
    queryFn: fetchPresetModels,
    enabled: !isProductShot,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const { data: presetInspirationsData, isLoading: presetInspirationsLoading, isError: presetInspirationsError } = useQuery<PresetInspirationsResponse>({
    queryKey: ['preset-inspirations'],
    queryFn: fetchPresetInspirations,
    enabled: isProductShot,
    staleTime: 5 * 60 * 1000,
  });

  // Active preset data — inspirations when PDP, models otherwise
  const activePresetCategories = useMemo(() => {
    if (isProductShot) return presetInspirationsData?.categories ?? [];
    return presetModelsData?.categories ?? [];
  }, [isProductShot, presetInspirationsData, presetModelsData]);

  // Derive category ids for auto-select logic
  const presetCategoryIds = useMemo<string[]>(() => {
    return activePresetCategories.map(c => c.id);
  }, [activePresetCategories]);

  // Auto-select first available category when API data first loads.
  // formanovaCategory is excluded from deps intentionally: including it would re-run the effect
  // on every category selection, resetting the user's pick back to the first category.
  // Regression to watch: if presetCategoryIds changes but the current selection is still valid,
  // this must NOT reset it -- the `!presetCategoryIds.includes(formanovaCategory)` guard ensures that.
  useEffect(() => {
    if (presetCategoryIds.length > 0 && !presetCategoryIds.includes(formanovaCategory)) {
      setFormanovaCategory(presetCategoryIds[0]);
    }
  }, [presetCategoryIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const presetModelsForCategory = useMemo<PresetModel[]>(() => {
    if (isProductShot) {
      const cat = presetInspirationsData?.categories.find(c => c.id === formanovaCategory);
      return (cat?.inspirations ?? []) as PresetModel[];
    }
    const cat = presetModelsData?.categories.find(c => c.id === formanovaCategory);
    return cat?.models ?? [];
  }, [isProductShot, presetInspirationsData, presetModelsData, formanovaCategory]);

  const activePresetLoading = isProductShot ? presetInspirationsLoading : presetModelsLoading;
  const activePresetError = isProductShot ? presetInspirationsError : presetModelsError;
  const activePresetEmpty = !activePresetLoading && !activePresetError && activePresetCategories.length === 0;

  // Keep the current in-studio step in the URL so browser refresh keeps users on the same screen.
  useEffect(() => {
    const currentStepParam = searchParams.get('step');
    const desiredStepParam = currentStep === 'model' ? 'model' : null;

    if (currentStepParam === desiredStepParam) return;

    const nextParams = new URLSearchParams(searchParams);
    if (desiredStepParam) {
      nextParams.set('step', desiredStepParam);
    } else {
      nextParams.delete('step');
    }
    setSearchParams(nextParams, { replace: true });
  }, [currentStep, searchParams, setSearchParams]);

  useEffect(() => {
    if (initializing || !user || hasCheckedUploadGuide.current) return;
    if (!isStudioOnboardingEnabled(user.email)) return;
    if (currentStep !== 'upload') return;

    hasCheckedUploadGuide.current = true;

    if (isTosAgreed(user.id)) return;

    checkUploadInstructionsSeen()
      .then((seenOnBackend) => {
        if (seenOnBackend) {
          markTosAgreed(user.id);
          return;
        }
        setUploadGuideOpen(true);
        trackUploadGuideViewed();
      })
      .catch(() => {
        setUploadGuideOpen(true);
        trackUploadGuideViewed();
      });
  }, [currentStep, initializing, user?.email, user?.id]);

  const handleUploadGuideClose = useCallback(() => {
    setUploadGuideOpen(false);
    if (!user) return;
    markTosAgreed(user.id);
    trackUploadGuideAcknowledged();
    markUploadInstructionsSeen().catch(() => {});
  }, [user]);

  // ── Product shot guide (gated) ───────────────────────────────────────────
  useEffect(() => {
    if (initializing || !user || hasCheckedProductShotGuide.current) return;
    if (!isProductShot) return;
    if (!isProductShotGuideEnabled(user.email)) return;
    if (currentStep !== 'upload') return;

    hasCheckedProductShotGuide.current = true;

    if (isProductShotGuideSeen(user.id)) return;

    checkProductShotGuideSeen()
      .then((seenOnBackend) => {
        if (seenOnBackend) {
          markProductShotGuideSeenLocal(user.id);
          return;
        }
        setProductShotGuideOpen(true);
      })
      .catch(() => {
        setProductShotGuideOpen(true);
      });
  }, [currentStep, initializing, isProductShot, user?.email, user?.id]);

  const handleProductShotGuideClose = useCallback(() => {
    setProductShotGuideOpen(false);
    if (!user) return;
    markProductShotGuideSeenLocal(user.id);
    markProductShotGuideSeen().catch(() => {});
  }, [user]);


  const activeModelUrl = customModelImage || selectedModel?.url || null;
  const resolvedJewelryImage = useAuthenticatedImage(jewelryImage);
  const resolvedActiveModelUrl = useAuthenticatedImage(activeModelUrl);

  // Validation hook (isValidating + clearValidation used inline; validateImages passed to useStudioUpload)
  const { isValidating, results: validationResults, validateImages, clearValidation } = useImageValidation();

  // Upload state -- declared here (before session restore effects) so setters are initialized
  // before any effect runs. Passed as setter options into useStudioUpload below.
  const [validationResult, setValidationResult] = useState<ImageValidationResult | null>(null);
  const [jewelryUploadedUrl, setJewelryUploadedUrl] = useState<string | null>(null);
  const [jewelrySasUrl, setJewelrySasUrl] = useState<string | null>(null);
  const [jewelryAssetId, setJewelryAssetId] = useState<string | null>(null);

  // ─── Pre-load vault asset (Re-shoot / New Shoot from My Products or My Models) ───

  // Intentionally empty deps: pre-load runs once on mount from route state.
  // Adding 'location' to deps would re-apply pre-load on every in-studio navigation, which is wrong.
  useEffect(() => {
    const state = location.state as {
      preloadedJewelryUrl?: string;
      preloadedJewelryAssetId?: string;
      preloadedModelUrl?: string;
      preloadedModelAssetId?: string;
    } | null;

    if (state?.preloadedJewelryUrl) {
      setJewelryUploadedUrl(state.preloadedJewelryUrl);
      setJewelryAssetId(state.preloadedJewelryAssetId ?? null);
    }

    if (state?.preloadedModelUrl) {
      setCustomModelImage(state.preloadedModelUrl);
      setModelAssetId(state.preloadedModelAssetId ?? null);
    }
  }, []); // run once on mount — location.state is set before component renders

  // ─── Session restore — bring back jewelry/model state after reload ─────────
  useEffect(() => {
    // Don't restore if this is a Re-shoot (preloaded from route state)
    const routeState = location.state as { preloadedJewelryUrl?: string } | null;
    if (routeState?.preloadedJewelryUrl) return;

    const session = loadStudioSession();
    if (!session?.jewelryUploadedUrl) return;

    // Don't restore if session belongs to a different jewelry type
    if (session.jewelryType && session.jewelryType !== jewelryType) {
      clearStudioSession();
      return;
    }

    // Derive a displayable URL from the stored Azure URI
    setJewelryImage(azureUriToUrl(session.jewelryUploadedUrl));
    setJewelryUploadedUrl(session.jewelryUploadedUrl);
    if (session.jewelryAssetId) setJewelryAssetId(session.jewelryAssetId);
    if (session.validationResult) setValidationResult(session.validationResult);
    if (session.customModelImage) setCustomModelImage(session.customModelImage);
    if (session.modelAssetId) setModelAssetId(session.modelAssetId);
    // Preset model selection is restored after backend preset data loads.
  // location and jewelryType are excluded from deps intentionally: this must run once on mount only.
  // Including location would re-run on every in-studio navigation (location changes on step transitions),
  // re-applying stale session state over user's current selections. Including jewelryType would re-run
  // when the user overrides the jewelry type inline, also incorrectly resetting state.
  // Regression to watch: if route state or session state is needed mid-session, handle it elsewhere.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Session save — persist whenever key upload/selection state changes ─────
  useEffect(() => {
    if (!jewelryUploadedUrl) return;
    saveStudioSession({
      jewelryType,
      jewelryUploadedUrl,
      jewelryAssetId,
      validationResult,
      selectedModelId: selectedModel?.id ?? null,
      customModelImage,
      modelAssetId,
    });
  }, [jewelryUploadedUrl, jewelryAssetId, validationResult, selectedModel, customModelImage, modelAssetId]);

  // ─── Second-pass model restore when API data loads ────────────────
  useEffect(() => {
    if (isProductShot || !presetModelsData || selectedModel) return;
    const session = loadStudioSession();
    if (!session?.selectedModelId) return;
    const model = presetModelsData.categories.flatMap(c => c.models).find(m => m.id === session.selectedModelId);
    if (model) setSelectedModel(model);
  }, [isProductShot, presetModelsData, selectedModel]);

  // ─── Extracted hooks ─────────────────────────────────────────────
  // useStudioModels owns: my-models vault state, backend fetch, local-pending optimistic list,
  // delete and rename operations. Receives setters so it can clear the active selection when
  // the selected model is deleted.
  const {
    myModels,
    setMyModels,
    localPendingModels,
    setLocalPendingModels,
    myModelsLoading,
    myModelsSearch,
    setMyModelsSearch,
    mergedMyModels,
    isMyModelsEmptyState,
    fetchMyModels,
    handleDeleteUserModel,
    handleRenameUserModel,
  } = useStudioModels({ isProductShot, customModelImage, setCustomModelImage, setModelAssetId });

  // useStudioUpload owns the async upload flows for jewelry and model images.
  // All state is declared inline above so setters are available before any effect runs.
  const {
    handleJewelryUpload,
    handleModelUpload,
    handleSelectLibraryModel,
  } = useStudioUpload({
    isProductShot,
    effectiveJewelryType,
    validateImages,
    toast,
    setJewelryImage,
    setJewelryFile,
    setValidationResult,
    setJewelryUploadedUrl,
    setJewelrySasUrl,
    setJewelryAssetId,
    setCustomModelImage,
    setCustomModelFile,
    setModelAssetId,
    setSelectedModel,
    setLocalPendingModels,
    fetchMyModels,
  });

  // useStudioGeneration owns: all generation state (progress, step, results, error, etc.),
  // the polling loop, and PostHog analytics for generation events.
  // It receives snapshots of upload state on every render; handleGenerate closes over the
  // latest values via its useCallback dependency array.
  const {
    isGenerating,
    generationProgress,
    generationStep,
    rotatingMsgIdx,
    workflowId,
    resultImages,
    setResultImages,
    generationError,
    regenerationCount,
    setRegenerationCount,
    feedbackOpen,
    setFeedbackOpen,
    handleGenerate,
    resetGeneration,
  } = useStudioGeneration({
    isProductShot,
    effectiveJewelryType,
    jewelryImage,
    activeModelUrl,
    jewelryUploadedUrl,
    jewelryAssetId,
    selectedModel,
    customModelImage,
    modelAssetId,
    validationResult,
    checkCredits,
    refreshCredits,
    toast,
    setCurrentStep,
    setJewelryAssetId,
    clearStudioSession,
    clearValidation,
  });

  // Paste handler — supports jewelry upload (step 1) AND model upload (step 2 empty state)
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) break;
          if (currentStep === 'model' && !activeModelUrl) {
            handleModelUpload(file);
          } else if (!jewelryImage) {
            handleJewelryUpload(file);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [jewelryImage, handleJewelryUpload, handleModelUpload, currentStep, activeModelUrl]);

  // Auto-advance to Step 2 on valid upload
  const handleNextStep = () => {
    if (isFlagged) {
      setShowFlaggedDialog(true);
      return;
    }
    setCurrentStep('model');
  };

  const handleContinueAnyway = () => {
    // Path B: user chose to proceed despite validation warning.
    // validationResult state IS safe to read here — validation finished before this dialog appeared.
    if (validationResult) {
      trackJewelryUploaded({
        category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
        upload_type: validationResult.category,
        was_flagged: true,
      });
    }
    if (jewelryAssetId) {
      updateAssetMetadata(jewelryAssetId, { user_override: 'true' }).catch(() => {});
    }
    setShowFlaggedDialog(false);
    setCurrentStep('model');
  };

  const handleStartOver = () => {
    clearStudioSession();
    setJewelryImage(null);
    setJewelryFile(null);
    setJewelryUploadedUrl(null);
    setJewelrySasUrl(null);
    setJewelryAssetId(null);
    setSelectedModel(null);
    setCustomModelImage(null);
    setCustomModelFile(null);
    setModelAssetId(null);
    setValidationResult(null);
    resetGeneration(); // clears resultImages, workflowId, generationError, progress, etc.
    setCurrentStep('upload');
    clearValidation();
  };

  const exampleCategoryType = CATEGORY_TYPE_MAP[jewelryType] || 'necklace';
  const isFlagged = validationResult && !validationResult.is_acceptable;
  const acceptableExample = ACCEPTABLE_EXAMPLES[jewelryType] || ACCEPTABLE_EXAMPLES['necklace'];
  const canProceed = jewelryImage && !isValidating;

  // handleDeleteUserModel and handleRenameUserModel come from useStudioModels above.

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-background relative overflow-hidden flex flex-col">
      {showInsufficientModal && preflightResult && (
        <CreditPreflightModal
          open={showInsufficientModal}
          onOpenChange={(open) => !open && dismissModal()}
          estimatedCredits={preflightResult.estimatedCredits}
          currentBalance={preflightResult.currentBalance}
        />
      )}

      {/* ── Mode Switcher + Step Progress Bar ── */}
      {currentStep !== 'generating' && (
        <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-3 relative z-10 flex flex-col items-center gap-3">

          {/* Mode Switcher — only for gated users */}
          {isStudioTypeSelectionEnabled(user?.email) && (
            <div className="flex items-center border border-formanova-hero-accent/40 shadow-[0_0_20px_-4px_hsl(var(--formanova-hero-accent)/0.3)]">
              <button
                onClick={() => setIsProductShot(false)}
                className={`w-40 py-2.5 font-mono text-xs tracking-[0.18em] uppercase font-bold text-center transition-all duration-200 ${
                  !isProductShot
                    ? 'bg-formanova-hero-accent text-primary-foreground'
                    : 'bg-muted text-foreground/50 hover:text-foreground hover:bg-muted/80'
                }`}
              >
                Model Shot
              </button>
              <button
                onClick={() => setIsProductShot(true)}
                className={`w-40 py-2.5 font-mono text-xs tracking-[0.18em] uppercase font-bold text-center transition-all duration-200 ${
                  isProductShot
                    ? 'bg-formanova-hero-accent text-primary-foreground'
                    : 'bg-muted text-foreground/50 hover:text-foreground hover:bg-muted/80'
                }`}
              >
                Product Shot
              </button>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-1">
            {[
              { step: 1, label: 'Upload', id: 'upload' as const },
              { step: 2, label: isProductShot ? 'Choose inspiration' : 'Choose model', id: 'model' as const },
              { step: 3, label: 'Results', id: 'results' as const },
            ].map((s, index, arr) => {
              const stepOrder = { upload: 0, model: 1, generating: 2, results: 2 };
              const current = stepOrder[currentStep];
              const isDone = s.step - 1 < current;
              const isActive = (s.id === 'results' && ((currentStep as string) === 'generating' || currentStep === 'results')) || currentStep === s.id;
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => {
                      if (s.id === 'upload' && (currentStep as string) !== 'generating') setCurrentStep('upload');
                      else if (s.id === 'model' && !!jewelryImage && (currentStep as string) !== 'generating') setCurrentStep('model');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 transition-all ${
                      isActive
                        ? 'text-foreground'
                        : isDone
                        ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                        : 'text-muted-foreground/40 cursor-default'
                    }`}
                  >
                    <div className={`w-5 h-5 flex items-center justify-center text-[10px] font-mono font-bold border transition-all ${
                      isActive
                        ? 'bg-foreground text-background border-foreground'
                        : isDone
                        ? 'border-foreground/40 text-foreground/60'
                        : 'border-border/30 text-muted-foreground/40'
                    }`}>
                      {s.step}
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.15em] uppercase hidden sm:inline">
                      {s.label}
                    </span>
                  </button>
                  {index < arr.length - 1 && (
                    <div className={`w-10 h-px mx-1 transition-colors ${isDone || isActive ? 'bg-foreground/30' : 'bg-border/30'}`} />
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 md:px-4 pb-8 relative z-10">

        {/* ═══════════════════════════════════════════════════════════
            STEP 1 — UPLOAD YOUR JEWELRY
            ═══════════════════════════════════════════════════════════ */}
        {currentStep === 'upload' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* ── Alternate layout (internal experiment) ── */}
            {isAltUploadLayoutEnabled(user?.email) ? (
              <AlternateUploadStep
                exampleCategoryType={exampleCategoryType}
                jewelryImage={jewelryImage}
                activeProductAssetId={jewelryAssetId}
                isValidating={isValidating}
                validationResult={validationResult}
                isFlagged={!!isFlagged}
                canProceed={!!canProceed}
                jewelryInputRef={jewelryInputRef}
                onFileUpload={handleJewelryUpload}
                onClearImage={() => {
                  clearStudioSession();
                  setJewelryImage(null);
                  setJewelryFile(null);
                  setValidationResult(null);
                  setJewelryUploadedUrl(null);
                  setJewelryAssetId(null);
                  clearValidation();
                  if ((currentStep as string) === 'model') setCurrentStep('upload');
                }}
                userEmail={user?.email}
                onNextStep={handleNextStep}
                onForceNextStep={handleContinueAnyway}
                onCategoryChange={(cat) => setOverrideJewelryType(cat)}
                isProductShot={isProductShot}
                onProductSelect={(thumbnailUrl, assetId) => {
                  setJewelryImage(thumbnailUrl);
                  setJewelryUploadedUrl(thumbnailUrl);
                  setJewelryAssetId(assetId);
                  setJewelryFile(null);
                  setValidationResult(null);
                  clearValidation();
                  if (!isProductShot) {
                    // On-model only: validate the selected product image
                    authenticatedFetch(thumbnailUrl)
                      .then(r => r.blob())
                      .then(blob => {
                        const file = new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' });
                        return validateImages([file], effectiveJewelryType);
                      })
                      .then(result => {
                        if (result && result.results.length > 0) {
                          setValidationResult(result.results[0]);
                          if (result.results[0].uploaded_url) {
                            setJewelryUploadedUrl(result.results[0].uploaded_url);
                          }
                        }
                      })
                      .catch(e => console.warn('[ProductSelect] Validation failed:', e));
                  }
                }}
              />
            ) : (
            <>
            {/* Step 1 Header */}
            <div className="mb-6">
              <span className="marta-label">Step 1</span>
              <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight mt-2">
                Upload Your Jewelry
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Upload a photo of your jewelry <strong>worn on a person or mannequin</strong>
              </p>
            </div>

            {/* Layout — Upload LEFT (2/3), Guide Sidebar RIGHT (1/3) — mirrors old StepUploadMark */}
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">
              {/* ── Main Column: Upload Zone (2/3) ── */}
              <div className="lg:col-span-2">
                {!jewelryImage ? (
                  /* Empty state — drop zone */
                  <div
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleJewelryUpload(f); }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => jewelryInputRef.current?.click()}
                    className="relative border border-dashed border-border/40 text-center cursor-pointer hover:border-foreground/40 hover:bg-foreground/5 transition-all flex flex-col items-center justify-center min-h-[500px] md:min-h-[640px]"
                  >
                    <div className="relative mx-auto w-20 h-20 mb-6">
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                      <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                        <Diamond className="h-9 w-9 text-primary" />
                      </div>
                    </div>
                    <p className="text-lg font-display font-medium mb-1.5">Drop your jewelry image here</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Drag & drop · click to browse · paste (Ctrl+V)
                    </p>
                    <Button variant="outline" size="lg" className="gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Browse Files
                    </Button>
                    <input
                      ref={jewelryInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleJewelryUpload(f); }}
                    />
                  </div>
                ) : (
                  /* Uploaded state — image preview */
                  <div className="space-y-4">
                    <div className="relative border overflow-hidden flex items-center justify-center bg-muted/20 min-h-[500px] md:min-h-[640px] border-border/30">
                      <img src={resolvedJewelryImage ?? undefined} alt="Jewelry" className="max-w-full max-h-[520px] object-contain" />

                      <button
                        onClick={() => { clearStudioSession(); setJewelryImage(null); setJewelryFile(null); setValidationResult(null); setJewelryUploadedUrl(null); setJewelrySasUrl(null); setJewelryAssetId(null); clearValidation(); if ((currentStep as string) === 'model') setCurrentStep('upload'); }}
                        className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors z-10 rounded-sm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      {isValidating && (
                        <div className="absolute top-3 left-3 bg-muted/90 backdrop-blur-sm px-2.5 py-1 flex items-center gap-1.5 rounded-sm">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">Validating…</span>
                        </div>
                      )}
                      {!isValidating && validationResult && !isFlagged && (
                        <div className="absolute top-3 left-3 backdrop-blur-sm px-2.5 py-1 flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-sm">
                          <Check className="h-3 w-3 text-primary" />
                          <span className="font-mono text-[9px] tracking-wider uppercase text-primary">Accepted</span>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* Next button — inline below upload canvas */}
                {jewelryImage && (
                  <div className="flex items-center justify-end gap-3 pt-4">
                    <Button
                      size="lg"
                      onClick={handleNextStep}
                      disabled={!canProceed}
                      className="gap-2.5 font-display text-base uppercase tracking-wide px-10 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0 disabled:opacity-60 disabled:from-[hsl(var(--formanova-hero-accent))] disabled:to-[hsl(var(--formanova-glow))]"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Validating…
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Sidebar: Upload Guide (1/3) — mirrors old Examples sidebar ── */}
              <div className="space-y-7">
                {/* Guide heading — matches old "Gallery" marta-label style */}
                <div>
                  <span className="marta-label mb-2 block">Guide</span>
                  <h3 className="font-display text-2xl uppercase tracking-tight">Upload Guide</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Follow these guidelines for best results.
                  </p>
                </div>

                {/* Accepted examples */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-green-500" />
                    </div>
                    <span className="text-xs font-medium text-foreground">Accepted</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(CATEGORY_EXAMPLES[exampleCategoryType]?.allowed || []).map((img, i) => (
                      <div key={`ok-${i}`} className="relative aspect-[3/4] overflow-hidden border border-green-500/30 bg-muted/20">
                        <img src={img} alt={`Accepted ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Not accepted examples */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                      <X className="w-2.5 h-2.5 text-destructive" />
                    </div>
                    <span className="text-xs font-medium text-foreground">Not Accepted</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(CATEGORY_EXAMPLES[exampleCategoryType]?.notAllowed || []).map((img, i) => (
                      <div key={`no-${i}`} className="relative aspect-[3/4] overflow-hidden border border-destructive/30 bg-muted/20">
                        <img src={img} alt={`Not accepted ${i + 1}`} className="w-full h-full object-cover opacity-70" />
                        <div className="absolute bottom-1 right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                          <X className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </>
            )}
          </motion.div>
        )}

        {/* ═══ Flagged Image Dialog ═══ */}
        <Dialog open={showFlaggedDialog} onOpenChange={setShowFlaggedDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader className="space-y-3">
              <DialogTitle className="flex items-center gap-3 text-destructive text-lg">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>Image May Not Be Suitable</span>
              </DialogTitle>
              <DialogDescription>
                We detected this image as <strong>{LABEL_NAMES[validationResult?.category || ''] || validationResult?.category}</strong>.
                For best results, upload jewelry <strong>worn on a person or mannequin</strong>. Results with this image may not be accurate.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 my-2">
              {/* User's flagged image */}
              <div className="space-y-2">
                <p className="font-mono text-[9px] tracking-wider text-destructive uppercase">Your image</p>
                <div className="relative border-2 border-destructive/40 overflow-hidden aspect-[3/4] bg-muted/30 rounded-sm">
                  {jewelryImage && <img src={resolvedJewelryImage ?? undefined} alt="Flagged" className="w-full h-full object-cover" />}
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive flex items-center justify-center shadow-lg">
                    <X className="h-4 w-4 text-destructive-foreground" />
                  </div>
                </div>
              </div>
              {/* Acceptable example */}
              <div className="space-y-2">
                <p className="font-mono text-[9px] tracking-wider text-primary uppercase">Acceptable format</p>
                <div className="relative border-2 border-primary/40 overflow-hidden aspect-[3/4] bg-muted/30 rounded-sm">
                  <img src={acceptableExample} alt="Acceptable" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => { setShowFlaggedDialog(false); setJewelryImage(null); setJewelryFile(null); setValidationResult(null); setJewelryUploadedUrl(null); setJewelrySasUrl(null); clearValidation(); }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Go Back & Re-upload
              </Button>
              <Button
                variant="ghost"
                onClick={handleContinueAnyway}
                className="text-muted-foreground"
              >
                Continue Anyway
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════════════════
            STEP 2 — CHOOSE YOUR MODEL (visible only after Next)
            ═══════════════════════════════════════════════════════════ */}
        {currentStep === 'model' && (
          <StudioModelStep
            step2Ref={step2Ref}
            modelInputRef={modelInputRef}
            isProductShot={isProductShot}
            user={user}
            activeModelUrl={activeModelUrl}
            resolvedActiveModelUrl={resolvedActiveModelUrl}
            jewelryImage={jewelryImage}
            isValidating={isValidating}
            preflightChecking={preflightChecking}
            customModelImage={customModelImage}
            selectedModel={selectedModel}
            isMyModelsEmptyState={isMyModelsEmptyState}
            myModelsSearch={myModelsSearch}
            mergedMyModels={mergedMyModels}
            activePresetCategories={activePresetCategories}
            formanovaCategory={formanovaCategory}
            activePresetLoading={activePresetLoading}
            activePresetError={activePresetError}
            activePresetEmpty={activePresetEmpty}
            presetModelsForCategory={presetModelsForCategory}
            setModelGuideOpen={setModelGuideOpen}
            setCurrentStep={setCurrentStep}
            setSelectedModel={setSelectedModel}
            setCustomModelImage={setCustomModelImage}
            setCustomModelFile={setCustomModelFile}
            setModelAssetId={setModelAssetId}
            setMyModelsSearch={setMyModelsSearch}
            setFormanovaCategory={setFormanovaCategory}
            handleModelUpload={handleModelUpload}
            handleGenerate={handleGenerate}
            handleDeleteUserModel={handleDeleteUserModel}
            handleRenameUserModel={handleRenameUserModel}
            handleSelectLibraryModel={handleSelectLibraryModel}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════
            GENERATING STEP
            ═══════════════════════════════════════════════════════════ */}
        {currentStep === 'generating' && (
          <StudioGeneratingStep
            isProductShot={isProductShot}
            generationStep={generationStep}
            generationProgress={generationProgress}
            rotatingMsgIdx={rotatingMsgIdx}
            jewelryImage={jewelryImage}
            resolvedJewelryImage={resolvedJewelryImage}
            activeModelUrl={activeModelUrl}
            resolvedActiveModelUrl={resolvedActiveModelUrl}
            generationError={generationError}
            handleStartOver={handleStartOver}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════
            RESULTS STEP
            ═══════════════════════════════════════════════════════════ */}
        {currentStep === 'results' && (
          <StudioResultsStep
            resultImages={resultImages}
            workflowId={workflowId}
            effectiveJewelryType={effectiveJewelryType}
            isProductShot={isProductShot}
            regenerationCount={regenerationCount}
            setRegenerationCount={setRegenerationCount}
            setResultImages={setResultImages}
            setCurrentStep={setCurrentStep}
            handleGenerate={handleGenerate}
            handleStartOver={handleStartOver}
            user={user}
            feedbackOpen={feedbackOpen}
            setFeedbackOpen={setFeedbackOpen}
            jewelryUploadedUrl={jewelryUploadedUrl}
            jewelrySasUrl={jewelrySasUrl}
            jewelryImage={jewelryImage}
            activeModelUrl={activeModelUrl}
          />
        )}
      </div>

      {/* ── Model guide popup ── */}
      <UploadGuideModal
        open={uploadGuideOpen}
        onClose={handleUploadGuideClose}
      />

      <ProductShotGuideModal
        open={productShotGuideOpen}
        onClose={handleProductShotGuideClose}
      />

      <ModelGuideModal
        open={modelGuideOpen}
        onClose={() => setModelGuideOpen(false)}
      />

      {isTestMenuEnabled(user?.email) && (
        <StudioTestMenu
          user={user}
          navigate={navigate}
          hasCheckedUploadGuide={hasCheckedUploadGuide}
          hasCheckedProductShotGuide={hasCheckedProductShotGuide}
          setUploadGuideOpen={setUploadGuideOpen}
          setProductShotGuideOpen={setProductShotGuideOpen}
        />
      )}
    </div>
  );
}
