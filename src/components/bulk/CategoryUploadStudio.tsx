import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, ImagePlus, Send, Gift } from 'lucide-react';

import BulkUploadZone, { UploadedImage } from './BulkUploadZone';
import ImageUploadCard, { SkinTone } from './ImageUploadCard';
import InputGuidePanel from './InputGuidePanel';
import ProcessingTimeNotice from './ProcessingTimeNotice';
import BatchSubmittedConfirmation from './BatchSubmittedConfirmation';

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

const CategoryUploadStudio = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  
  const [images, setImages] = useState<ImageWithSkinTone[]>([]);
  const [hasAcknowledgedTime, setHasAcknowledgedTime] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedBatchId, setSubmittedBatchId] = useState<string | null>(null);

  const jewelryType = type || 'necklace';
  const categoryName = CATEGORY_NAMES[jewelryType] || 'Jewelry';
  
  // Necklaces don't show per-image skin tone controls
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left: Upload Zone & Images */}
          <div className="lg:col-span-3 space-y-6">
            {/* Upload Zone */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="marta-frame p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="marta-label text-muted-foreground text-xs">
                  Drag, drop, or paste images
                </span>
              </div>

              <BulkUploadZone
                images={images}
                onImagesChange={handleImagesChange}
                maxImages={10}
              />
            </motion.div>

            {/* Image Grid with Per-Image Skin Tone */}
            <AnimatePresence>
              {images.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="marta-label text-muted-foreground text-xs">
                      {images.length} image{images.length !== 1 ? 's' : ''} ready
                    </span>
                    {showSkinTonePerImage && (
                      <span className="text-xs text-muted-foreground">
                        Select skin tone for each
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {images.map(image => (
                      <ImageUploadCard
                        key={image.id}
                        id={image.id}
                        preview={image.preview}
                        skinTone={image.skinTone}
                        onSkinToneChange={handleSkinToneChange}
                        onRemove={handleRemoveImage}
                        showSkinTone={showSkinTonePerImage}
                        disabled={isSubmitting}
                      />
                    ))}
                    
                    {/* Add More Button */}
                    {images.length < 10 && (
                      <motion.label
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="aspect-square marta-frame border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-formanova-hero-accent/50 hover:bg-muted/30 transition-all"
                      >
                        <ImagePlus className="w-6 h-6 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-mono">Add more</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            const remaining = 10 - images.length;
                            const newImages = files.slice(0, remaining).map(file => ({
                              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                              file,
                              preview: URL.createObjectURL(file),
                              skinTone: 'medium' as SkinTone,
                            }));
                            setImages(prev => [...prev, ...newImages]);
                            e.target.value = '';
                          }}
                        />
                      </motion.label>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Processing Time Notice & Submit */}
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

          {/* Right: Input Guide Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <InputGuidePanel categoryName={categoryName} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryUploadStudio;
