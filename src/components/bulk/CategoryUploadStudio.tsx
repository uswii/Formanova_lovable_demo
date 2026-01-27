import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, Send, Gift } from 'lucide-react';

import BulkUploadZone, { UploadedImage } from './BulkUploadZone';
import { SkinTone } from './ImageUploadCard';
import InputGuidePanel from './InputGuidePanel';
import ProcessingTimeNotice from './ProcessingTimeNotice';
import BatchSubmittedConfirmation from './BatchSubmittedConfirmation';
import EmailNotificationPanel from './EmailNotificationPanel';

interface ImageWithSkinTone extends UploadedImage {
  skinTone: SkinTone;
}

const CATEGORY_NAMES: Record<string, string> = {
  necklace: 'Necklaces',
  earrings: 'Earrings',
  rings: 'Rings',
  bracelets: 'Bracelets',
  watches: 'Watches',
};

// Skin tone options
const SKIN_TONES: { id: SkinTone; color: string; label: string }[] = [
  { id: 'light', color: '#FFE0BD', label: 'Light' },
  { id: 'medium-light', color: '#E5C298', label: 'Medium Light' },
  { id: 'medium', color: '#C8A27C', label: 'Medium' },
  { id: 'medium-dark', color: '#A67C52', label: 'Medium Dark' },
  { id: 'dark', color: '#6B4423', label: 'Dark' },
];

const CategoryUploadStudio = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  
  const [images, setImages] = useState<ImageWithSkinTone[]>([]);
  const [hasAcknowledgedTime, setHasAcknowledgedTime] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedBatchId, setSubmittedBatchId] = useState<string | null>(null);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [globalSkinTone, setGlobalSkinTone] = useState<SkinTone>('medium');

  const jewelryType = type || 'necklace';
  const categoryName = CATEGORY_NAMES[jewelryType] || 'Jewelry';
  
  // Necklaces don't show skin tone controls at all
  const showSkinTonePerImage = jewelryType !== 'necklace';

  // Handle base images from BulkUploadZone and add skin tone
  const handleImagesChange = useCallback((newImages: UploadedImage[]) => {
    setImages(prev => {
      // Keep existing skin tones for images that already exist
      const existingMap = new Map(prev.map(img => [img.id, img.skinTone]));
      
      return newImages.map(img => ({
        ...img,
        skinTone: existingMap.get(img.id) || 'medium' as SkinTone,
      }));
    });
  }, []);

  const handleSkinToneChange = useCallback((imageId: string, tone: SkinTone) => {
    setImages(prev => 
      prev.map(img => 
        img.id === imageId ? { ...img, skinTone: tone } : img
      )
    );
  }, []);

  const handleRemoveImage = useCallback((imageId: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === imageId);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== imageId);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (images.length === 0 || !hasAcknowledgedTime) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement actual batch submission via edge function
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockBatchId = `batch_${Date.now()}`;
      setSubmittedBatchId(mockBatchId);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit batch:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [images, hasAcknowledgedTime]);

  const handleStartAnother = useCallback(() => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setHasAcknowledgedTime(false);
    setIsSubmitted(false);
    setSubmittedBatchId(null);
  }, [images]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, []);

  const canSubmit = images.length > 0 && hasAcknowledgedTime && !isSubmitting;

  // Show confirmation after submission
  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-background py-8 px-4 md:px-8">
        <div className="max-w-2xl mx-auto">
          <BatchSubmittedConfirmation
            categoryName={categoryName}
            imageCount={images.length}
            batchId={submittedBatchId ?? undefined}
            onStartAnother={handleStartAnother}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-4 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/studio')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-mono uppercase tracking-wide">Back to Categories</span>
          </button>

          <div className="text-center">
            <span className="marta-label text-muted-foreground text-[10px]">Upload Studio</span>
            <h1 className="font-display text-3xl md:text-4xl uppercase tracking-wide mt-1">
              {categoryName}
            </h1>
          </div>
        </motion.div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Upload & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Zone with Canva-style grid */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="marta-frame p-6"
            >
              <BulkUploadZone
                images={images}
                onImagesChange={handleImagesChange}
                maxImages={10}
                disabled={isSubmitting}
              />

              {/* Image thumbnails with remove buttons */}
              {images.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">
                      {images.length} image{images.length !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => {
                        images.forEach(img => URL.revokeObjectURL(img.preview));
                        setImages([]);
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      disabled={isSubmitting}
                    >
                      Clear all
                    </button>
                  </div>
                  
                  {/* Thumbnail strip with remove buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {images.map((image, index) => (
                      <div key={image.id} className="relative group">
                        <div className="w-16 h-16 rounded overflow-hidden bg-muted/30">
                          <img
                            src={image.preview}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveImage(image.id)}
                          disabled={isSubmitting}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Skin Tone Selector (non-necklace only) */}
            <AnimatePresence>
              {images.length > 0 && showSkinTonePerImage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="marta-frame p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Skin tone</span>
                    <div className="flex gap-2">
                      {SKIN_TONES.map((tone) => (
                        <button
                          key={tone.id}
                          onClick={() => setGlobalSkinTone(tone.id)}
                          disabled={isSubmitting}
                          title={tone.label}
                          className={`w-6 h-6 rounded-full transition-all ${
                            globalSkinTone === tone.id 
                              ? 'ring-2 ring-formanova-hero-accent ring-offset-2 ring-offset-background' 
                              : 'hover:scale-110'
                          } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                          style={{ backgroundColor: tone.color }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Processing Time & Submit */}
            <AnimatePresence>
              {images.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="space-y-4"
                >
                  <ProcessingTimeNotice
                    imageCount={images.length}
                    onAcknowledge={() => setHasAcknowledgedTime(true)}
                    acknowledged={hasAcknowledgedTime}
                  />

                  {/* First Batch Free */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 justify-center p-3 bg-formanova-hero-accent/10 marta-frame border-formanova-hero-accent/30"
                  >
                    <Gift className="w-4 h-4 text-formanova-hero-accent" />
                    <span className="text-sm text-formanova-hero-accent font-medium">
                      Your first batch is free!
                    </span>
                  </motion.div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full py-4 marta-frame font-display text-lg uppercase tracking-wider transition-all flex items-center justify-center gap-3 ${
                      canSubmit
                        ? 'bg-formanova-hero-accent text-primary-foreground hover:bg-formanova-hero-accent/90 hover:shadow-lg'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Submit Batch
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Sidebar: Guide + Email */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-24 space-y-6">
              {/* Input Guide */}
              <InputGuidePanel categoryName={categoryName} />

              {/* Email notification (shows when images uploaded) */}
              <AnimatePresence>
                {images.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <EmailNotificationPanel
                      defaultEmail={notificationEmail}
                      onEmailChange={setNotificationEmail}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryUploadStudio;
