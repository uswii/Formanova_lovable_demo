/**
 * useStudioOnboarding — manages the upload-guide and product-shot-guide onboarding popups.
 *
 * Extracted from UnifiedStudio.tsx (phase 36) to reduce the page file size.
 *
 * Owns:
 *   - uploadGuideOpen / productShotGuideOpen state
 *   - hasCheckedUploadGuide / hasCheckedProductShotGuide refs (returned so StudioTestMenu can reset them)
 *   - Both gated onboarding effects
 *   - handleUploadGuideClose / handleProductShotGuideClose callbacks
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  checkUploadInstructionsSeen,
  isTosAgreed,
  markTosAgreed,
  markUploadInstructionsSeen,
  checkProductShotGuideSeen,
  markProductShotGuideSeen,
  isProductShotGuideSeen,
  markProductShotGuideSeenLocal,
} from '@/lib/onboarding-api';
import { isStudioOnboardingEnabled, isProductShotGuideEnabled } from '@/lib/feature-flags';
import { trackUploadGuideViewed, trackUploadGuideAcknowledged } from '@/lib/posthog-events';

type StudioStep = 'upload' | 'model' | 'generating' | 'results';

interface UseStudioOnboardingOptions {
  currentStep: StudioStep;
  isProductShot: boolean;
  user: { id?: string; email?: string } | null;
  initializing: boolean;
}

export function useStudioOnboarding({
  currentStep,
  isProductShot,
  user,
  initializing,
}: UseStudioOnboardingOptions) {
  const [uploadGuideOpen, setUploadGuideOpen] = useState(false);
  const [productShotGuideOpen, setProductShotGuideOpen] = useState(false);

  const hasCheckedUploadGuide = useRef(false);
  const hasCheckedProductShotGuide = useRef(false);

  // Upload guide — shown once on first visit to Step 1 for gated users who haven't agreed to TOS
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

  // Product shot guide — shown once on first visit to Step 1 in product-shot mode for gated users
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

  return {
    uploadGuideOpen,
    setUploadGuideOpen,
    productShotGuideOpen,
    setProductShotGuideOpen,
    handleUploadGuideClose,
    handleProductShotGuideClose,
    hasCheckedUploadGuide,
    hasCheckedProductShotGuide,
  };
}
