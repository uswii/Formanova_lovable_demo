/**
 * StudioResultsStep
 *
 * Pure render component for the 'results' step of UnifiedStudio.
 * Displays result images in a flex grid, New Photoshoot / Regenerate action
 * buttons, and the optional feedback link + FeedbackModal.
 *
 * Has NO state of its own — all values flow in as props from UnifiedStudio.
 */
import { motion } from 'framer-motion';
import { Diamond, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultImageItem } from '@/components/studio/ResultImageItem';
import { FeedbackModal } from '@/components/studio/FeedbackModal';
import { isFeedbackEnabled } from '@/lib/feature-flags';
import { trackRegenerateClicked } from '@/lib/posthog-events';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
import { type FeedbackCategory } from '@/lib/feedback-api';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

type StudioStep = 'upload' | 'model' | 'generating' | 'results';

interface StudioResultsStepProps {
  resultImages: string[];
  workflowId: string | null;
  effectiveJewelryType: string;
  isProductShot: boolean;
  regenerationCount: number;
  setRegenerationCount: (fn: (c: number) => number) => void;
  setResultImages: (imgs: string[]) => void;
  setCurrentStep: (step: StudioStep) => void;
  handleGenerate: () => void;
  handleStartOver: () => void;
  user: any;
  feedbackOpen: boolean;
  setFeedbackOpen: (open: boolean) => void;
  jewelryUploadedUrl: string | null;
  jewelrySasUrl: string | null;
  jewelryImage: string | null;
  activeModelUrl: string | null;
}

export function StudioResultsStep({
  resultImages,
  workflowId,
  effectiveJewelryType,
  isProductShot,
  regenerationCount,
  setRegenerationCount,
  setResultImages,
  setCurrentStep,
  handleGenerate,
  handleStartOver,
  user,
  feedbackOpen,
  setFeedbackOpen,
  jewelryUploadedUrl,
  jewelrySasUrl,
  jewelryImage,
  activeModelUrl,
}: StudioResultsStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">Complete</span>
        <h2 className="font-display text-4xl uppercase tracking-tight">Your Result{resultImages.length !== 1 ? 's' : ''}</h2>
      </div>

      {resultImages.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-4 max-w-5xl mx-auto">
          {resultImages.map((url, i) => (
            <ResultImageItem key={i} url={url} index={i} workflowId={workflowId} jewelryType={effectiveJewelryType} naturalAspect={isProductShot} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No result images found. The workflow may still be processing.</p>
        </div>
      )}

      {/* Action buttons directly under results */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <Button variant="outline" size="lg" onClick={handleStartOver} className="gap-2 font-mono text-[10px] uppercase tracking-wider h-11 px-6">
          <Diamond className="h-4 w-4" />
          New Photoshoot
        </Button>
        <Button
          size="lg"
          onClick={() => {
            setRegenerationCount(c => c + 1);
            trackRegenerateClicked({
              context: 'unified-studio',
              category: TO_SINGULAR[effectiveJewelryType] ?? effectiveJewelryType,
              regeneration_number: regenerationCount + 1,
            });
            setResultImages([]);
            setCurrentStep('generating');
            handleGenerate();
          }}
          className="gap-2 font-display text-base uppercase tracking-wide h-11 px-6 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate
          <span className="flex items-center gap-1 opacity-70 text-sm font-mono normal-case tracking-normal ml-1">
            &le; <img src={creditCoinIcon} alt="" className="h-4 w-4 object-contain" /> 10
          </span>
        </Button>
      </div>

      {isFeedbackEnabled(user?.email) && (
        <p className="text-center text-xs text-muted-foreground">
          Not happy with the result?{' '}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
            onClick={() => setFeedbackOpen(true)}
          >
            Tell us what went wrong
          </button>
        </p>
      )}

      {isFeedbackEnabled(user?.email) && (
        <FeedbackModal
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          workflowId={workflowId}
          jewelryImageUrl={jewelryUploadedUrl}
          jewelryDisplayUrl={jewelrySasUrl || jewelryImage}
          modelImageUrl={activeModelUrl}
          resultImageUrl={resultImages[0] ?? null}
          category={(TO_SINGULAR[effectiveJewelryType] ?? 'other') as FeedbackCategory}
        />
      )}
    </motion.div>
  );
}
