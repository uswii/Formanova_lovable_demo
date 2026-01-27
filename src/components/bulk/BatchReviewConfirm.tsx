import { motion } from 'framer-motion';
import { Clock, Gift, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadedImage } from './BulkUploadZone';
import { JewelryCategory } from './BulkCategorySelector';
import { SkinTone, Gender } from './MetadataSelectors';

interface BatchReviewConfirmProps {
  category: JewelryCategory;
  images: UploadedImage[];
  skinTone: SkinTone;
  gender: Gender;
  hasAgreedToWait: boolean;
  onAgreementChange: (agreed: boolean) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isFirstBatch?: boolean;
}

const SKIN_TONE_LABELS: Record<SkinTone, string> = {
  'light': 'Light',
  'medium-light': 'Medium Light',
  'medium': 'Medium',
  'medium-dark': 'Medium Dark',
  'dark': 'Dark',
};

const BatchReviewConfirm = ({
  category,
  images,
  skinTone,
  gender,
  hasAgreedToWait,
  onAgreementChange,
  onSubmit,
  isSubmitting = false,
  isFirstBatch = true,
}: BatchReviewConfirmProps) => {
  const canSubmit = hasAgreedToWait && images.length > 0 && !isSubmitting;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <span className="marta-label text-muted-foreground">Step 3</span>
        <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wide mt-1">
          Review & Submit
        </h2>
      </div>

      {/* Summary Card */}
      <div className="marta-frame p-5 space-y-4">
        <h3 className="marta-label text-xs">Your Batch Summary</h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Category</span>
            <p className="font-medium">{category.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Images</span>
            <p className="font-medium">{images.length}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Skin Tone</span>
            <p className="font-medium">{SKIN_TONE_LABELS[skinTone]}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Model</span>
            <p className="font-medium capitalize">{gender}</p>
          </div>
        </div>

        {/* Thumbnail Preview */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {images.slice(0, 6).map((image) => (
            <div key={image.id} className="w-12 h-12 flex-shrink-0 marta-frame overflow-hidden">
              <img src={image.preview} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {images.length > 6 && (
            <div className="w-12 h-12 flex-shrink-0 marta-frame flex items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground">+{images.length - 6}</span>
            </div>
          )}
        </div>
      </div>

      {/* Processing Time Notice */}
      <div className="marta-frame p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-formanova-hero-accent flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Processing Time</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              High-fidelity generation takes <span className="text-foreground font-medium">up to 24 hours</span>. 
              We'll email you the moment your images are ready.
            </p>
            <p className="text-[11px] text-muted-foreground/80 italic">
              (Most batches complete in 4-8 hours)
            </p>
          </div>
        </div>
      </div>

      {/* Agreement Checkbox */}
      <div className="flex items-start gap-3 p-4 marta-frame">
        <Checkbox
          id="wait-agreement"
          checked={hasAgreedToWait}
          onCheckedChange={(checked) => onAgreementChange(checked === true)}
          disabled={isSubmitting}
          className="mt-0.5"
        />
        <label 
          htmlFor="wait-agreement" 
          className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
        >
          I understand this will take <span className="text-foreground font-medium">up to 24 hours</span> to process
        </label>
      </div>

      {/* Free Batch Indicator */}
      {isFirstBatch && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 justify-center p-3 bg-formanova-hero-accent/10 marta-frame border-formanova-hero-accent/30"
        >
          <Gift className="w-4 h-4 text-formanova-hero-accent" />
          <span className="text-sm text-formanova-hero-accent font-medium">
            This is your first batch — it's free!
          </span>
        </motion.div>
      )}

      {/* Submit Button */}
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`w-full py-4 marta-frame font-display text-lg uppercase tracking-wider transition-all duration-300 ${
          canSubmit
            ? 'bg-formanova-hero-accent text-primary-foreground hover:bg-formanova-hero-accent/90 hover:shadow-lg'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
            />
            Submitting...
          </span>
        ) : (
          'Submit Batch'
        )}
      </button>

      {!hasAgreedToWait && images.length > 0 && (
        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Please acknowledge the processing time to continue
        </p>
      )}
    </motion.div>
  );
};

export default BatchReviewConfirm;
