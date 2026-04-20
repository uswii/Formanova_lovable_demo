import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchPresetModels, fetchPresetInspirations, type PresetModel, type PresetModelsResponse, type PresetInspirationsResponse } from '@/lib/models-api';
import { useQuery } from '@tanstack/react-query';
import { updateAssetMetadata } from '@/lib/assets-api';
import { useImageValidation, type ImageValidationResult } from '@/hooks/use-image-validation';
import { useCreditPreflight } from '@/hooks/use-credit-preflight';
import { CreditPreflightModal } from '@/components/CreditPreflightModal';
import { useCredits } from '@/contexts/CreditsContext';
import { useAuth } from '@/contexts/AuthContext';
import { azureUriToUrl } from '@/lib/azure-utils';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { ModelGuideModal } from '@/components/studio/ModelGuideModal';
import { UploadGuideModal } from '@/components/studio/UploadGuideModal';
import { ProductShotGuideModal } from '@/components/studio/ProductShotGuideModal';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
import { useStudioOnboarding } from '@/hooks/useStudioOnboarding';
import { useStudioModels } from '@/hooks/useStudioModels';
import { useStudioGeneration } from '@/hooks/useStudioGeneration';
import { useStudioUpload } from '@/hooks/useStudioUpload';
import { StudioTestMenu } from '@/components/studio/StudioTestMenu';
import { StudioGeneratingStep } from '@/components/studio/StudioGeneratingStep';
import { StudioResultsStep } from '@/components/studio/StudioResultsStep';
import { StudioModelStep } from '@/components/studio/StudioModelStep';
import { StudioHeader } from '@/components/studio/StudioHeader';
import { StudioUploadStep } from '@/components/studio/StudioUploadStep';
import { trackJewelryUploaded } from '@/lib/posthog-events';
// ExampleGuidePanel removed — guide is inline

import { ACCEPTABLE_EXAMPLES } from '@/lib/studio-examples';

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

  // ── Studio onboarding popup + model guide (gated) ────────────────────────
  const [modelGuideOpen, setModelGuideOpen] = useState(false);

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
    // Priority: location.state (fresh nav) > URL ?mode= (refresh) > sessionStorage (fallback)
    const stateMode = (location.state as any)?.mode;
    if (stateMode === 'product-shot') {
      sessionStorage.setItem('formanova_studio_mode', 'product-shot');
      return true;
    }
    if (stateMode === 'model-shot') {
      sessionStorage.removeItem('formanova_studio_mode');
      return false;
    }
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    if (urlMode === 'product-shot') return true;
    if (urlMode === 'model-shot') return false;
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
  // "plain" category is always sorted first
  const activePresetCategories = useMemo(() => {
    const cats = isProductShot
      ? (presetInspirationsData?.categories ?? [])
      : (presetModelsData?.categories ?? []);
    return [...cats].sort((a, b) => {
      const aPlain = a.label.toLowerCase() === 'plain' ? -1 : 0;
      const bPlain = b.label.toLowerCase() === 'plain' ? -1 : 0;
      return aPlain - bPlain;
    });
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
      const items = (cat?.inspirations ?? []) as PresetModel[];
      return [...items].sort((a, b) => {
        const aOrder = a.metadata?.sort_order != null ? Number(a.metadata.sort_order) : Infinity;
        const bOrder = b.metadata?.sort_order != null ? Number(b.metadata.sort_order) : Infinity;
        return aOrder - bOrder;
      });
    }
    const cat = presetModelsData?.categories.find(c => c.id === formanovaCategory);
    return cat?.models ?? [];
  }, [isProductShot, presetInspirationsData, presetModelsData, formanovaCategory]);

  const activePresetLoading = isProductShot ? presetInspirationsLoading : presetModelsLoading;
  const activePresetError = isProductShot ? presetInspirationsError : presetModelsError;
  const activePresetEmpty = !activePresetLoading && !activePresetError && activePresetCategories.length === 0;

  // Keep the current step and mode in the URL so browser refresh restores full state.
  useEffect(() => {
    const currentStepParam = searchParams.get('step');
    const currentModeParam = searchParams.get('mode');
    const desiredStepParam = currentStep === 'model' ? 'model' : null;
    const desiredModeParam = isProductShot ? 'product-shot' : null;

    if (currentStepParam === desiredStepParam && currentModeParam === desiredModeParam) return;

    const nextParams = new URLSearchParams(searchParams);
    if (desiredStepParam) nextParams.set('step', desiredStepParam);
    else nextParams.delete('step');
    if (desiredModeParam) nextParams.set('mode', desiredModeParam);
    else nextParams.delete('mode');
    setSearchParams(nextParams, { replace: true });
  }, [currentStep, isProductShot, searchParams, setSearchParams]);

  // ── Onboarding popups ────────────────────────────────────────────────────
  const {
    uploadGuideOpen,
    setUploadGuideOpen,
    productShotGuideOpen,
    setProductShotGuideOpen,
    handleUploadGuideClose,
    handleProductShotGuideClose,
    hasCheckedUploadGuide,
    hasCheckedProductShotGuide,
  } = useStudioOnboarding({ currentStep, isProductShot, user, initializing });

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

  // Handle result navigation from toast/header indicator click
  useEffect(() => {
    const state = location.state as { asyncResult?: { workflowId: string; resultImages: string[] } } | null;
    if (!state?.asyncResult) return;
    setResultImages(state.asyncResult.resultImages);
    setCurrentStep('results');
    // Clear route state so a refresh doesn't re-apply
    navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Dep excluded: location, navigate, setResultImages, setCurrentStep — all stable.
  // This must run only on mount (not on re-renders) to avoid re-applying stale route state.
  // Regression to watch: if navigate or setResultImages changes identity on re-render,
  // the empty dep array prevents stale closures from running again — this is intentional.

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
    handleKeepBrowsing,
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
      <StudioHeader
        currentStep={currentStep}
        isProductShot={isProductShot}
        jewelryImage={jewelryImage}
        setIsProductShot={setIsProductShot}
        setCurrentStep={setCurrentStep}
      />

      <div className="flex-1 overflow-y-auto px-2 md:px-4 pb-8 relative z-10">

        {/* ═══════════════════════════════════════════════════════════
            STEP 1 — UPLOAD YOUR JEWELRY + FLAGGED IMAGE DIALOG
            ═══════════════════════════════════════════════════════════ */}
        <StudioUploadStep
          user={user}
          isProductShot={isProductShot}
          effectiveJewelryType={effectiveJewelryType}
          exampleCategoryType={exampleCategoryType}
          currentStep={currentStep}
          jewelryImage={jewelryImage}
          resolvedJewelryImage={resolvedJewelryImage}
          jewelryAssetId={jewelryAssetId}
          isValidating={isValidating}
          validationResult={validationResult}
          isFlagged={!!isFlagged}
          canProceed={!!canProceed}
          acceptableExample={acceptableExample}
          showFlaggedDialog={showFlaggedDialog}
          jewelryInputRef={jewelryInputRef}
          setShowFlaggedDialog={setShowFlaggedDialog}
          handleJewelryUpload={handleJewelryUpload}
          handleNextStep={handleNextStep}
          handleContinueAnyway={handleContinueAnyway}
          clearStudioSession={clearStudioSession}
          clearValidation={clearValidation}
          setJewelryImage={setJewelryImage}
          setJewelryFile={setJewelryFile}
          setValidationResult={setValidationResult}
          setJewelryUploadedUrl={setJewelryUploadedUrl}
          setJewelrySasUrl={setJewelrySasUrl}
          setJewelryAssetId={setJewelryAssetId}
          setCurrentStep={setCurrentStep}
          setOverrideJewelryType={setOverrideJewelryType}
          validateImages={validateImages}
        />

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
            onKeepBrowsing={handleKeepBrowsing}
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

      {(
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
