import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, Plus, Diamond, AlertTriangle } from 'lucide-react';

import { SkinTone } from './ImageUploadCard';
import BatchSubmittedConfirmation from './BatchSubmittedConfirmation';
import ExampleGuidePanel from './ExampleGuidePanel';
import { useImageValidation } from '@/hooks/use-image-validation';
import { getStoredToken } from '@/lib/auth-api';
import { toast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;


interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  index: number; // Track original index for validation matching
}

interface ImageWithSkinTone extends UploadedImage {
  skinTone: SkinTone;
  isFlagged?: boolean;
  flagReason?: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  necklace: 'Necklaces',
  earring: 'Earrings',
  ring: 'Rings',
  bracelet: 'Bracelets',
  watch: 'Watches',
};

// Map frontend plural category IDs to database singular enum values
const CATEGORY_TO_DB_ENUM: Record<string, string> = {
  necklace: 'necklace',
  earrings: 'earring',
  rings: 'ring',
  bracelets: 'bracelet',
  watches: 'watch',
};

// Skin tone options
const SKIN_TONES: { id: SkinTone; color: string; label: string }[] = [
  { id: 'light', color: '#FFE0BD', label: 'Light' },
  { id: 'medium-light', color: '#E5C298', label: 'Medium Light' },
  { id: 'medium', color: '#C8A27C', label: 'Medium' },
  { id: 'medium-dark', color: '#A67C52', label: 'Medium Dark' },
  { id: 'dark', color: '#6B4423', label: 'Dark' },
];

const MAX_IMAGES = 10;

const CategoryUploadStudio = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  
  const [images, setImages] = useState<ImageWithSkinTone[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedBatchId, setSubmittedBatchId] = useState<string | null>(null);
  const [globalSkinTone, setGlobalSkinTone] = useState<SkinTone>('medium');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFlagWarning, setShowFlagWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jewelryType = type || 'necklace';
  const categoryName = CATEGORY_NAMES[jewelryType] || 'Jewelry';
  const showSkinTone = jewelryType !== 'necklace';

  // Image validation hook
  const { 
    isValidating, 
    results: validationResults,
    flaggedCount,
    validateImages,
    clearValidation,
  } = useImageValidation();

  // Add files helper - triggers validation
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = MAX_IMAGES - images.length;
    const filesToAdd = fileArray.slice(0, remainingSlots).filter(f => f.type.startsWith('image/'));
    
    if (filesToAdd.length === 0) return;

    const startIndex = images.length;
    const newImages: ImageWithSkinTone[] = filesToAdd.map((file, idx) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      skinTone: globalSkinTone,
      index: startIndex + idx,
    }));

    setImages(prev => [...prev, ...newImages]);

    // Validate the new images (auth headers handled internally)
    const validation = await validateImages(filesToAdd, jewelryType);
    
    if (validation && validation.flagged_count > 0) {
      // Update images with flag status
      setImages(prev => prev.map((img, idx) => {
        if (idx >= startIndex) {
          const validationIdx = idx - startIndex;
          const result = validation.results[validationIdx];
          if (result && result.flags.length > 0) {
            return {
              ...img,
              isFlagged: true,
              flagReason: getFlagMessage(result.flags, result.category),
            };
          }
        }
        return img;
      }));
    }
  }, [images.length, globalSkinTone, validateImages, jewelryType]);

  // Get human-readable flag message
  const getFlagMessage = (flags: string[], category?: string): string => {
    if (flags.includes('not_worn')) {
      if (category === '3d_render') return '3D render detected - needs worn photo';
      if (category === 'flatlay') return 'Flatlay detected - needs worn photo';
      if (category === 'packshot') return 'Product shot detected - needs worn photo';
      if (category === 'floating') return 'Floating product detected - needs worn photo';
      return 'Not worn on person';
    }
    if (flags.includes('no_jewelry')) return 'No jewelry detected';
    if (flags.includes('wrong_category')) return 'Wrong jewelry type';
    if (flags.includes('low_quality')) return 'Low quality image';
    return 'Needs review';
  };

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isSubmitting) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles, isSubmitting]);

  const handleRemoveImage = useCallback((imageId: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === imageId);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== imageId);
    });
  }, []);

  const handleSkinToneChange = useCallback((imageId: string, tone: SkinTone) => {
    setImages(prev => 
      prev.map(img => 
        img.id === imageId ? { ...img, skinTone: tone } : img
      )
    );
  }, []);

  // Check if any images are flagged
  const hasFlaggedImages = images.some(img => img.isFlagged);

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) return;

    // If flagged images exist and user hasn't confirmed, show warning
    if (hasFlaggedImages && !showFlagWarning) {
      setShowFlagWarning(true);
      return;
    }

    setIsSubmitting(true);
    setShowFlagWarning(false);
    
    try {
      // Convert images to data URIs for submission
      const imageData = await Promise.all(
        images.map(async (img) => {
          // Read file as data URI
          const dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(img.file);
          });
          
          return {
            data_uri: dataUri,
            skin_tone: img.skinTone,
            classification: img.isFlagged ? {
              category: img.flagReason || 'unknown',
              is_worn: false,
              flagged: true,
            } : undefined,
          };
        })
      );

      // Get auth token
      const userToken = getStoredToken();
      console.log('[CategoryUploadStudio] User token:', userToken ? `${userToken.substring(0, 20)}...` : 'MISSING');
      
      if (!userToken) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to submit batches',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      console.log('[CategoryUploadStudio] Submitting to:', `${SUPABASE_URL}/functions/v1/batch-submit`);
      console.log('[CategoryUploadStudio] Headers:', {
        'X-User-Token': `${userToken.substring(0, 20)}...`,
        'Authorization': 'Bearer [anon-key]',
      });

      // Call batch-submit edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/batch-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'X-User-Token': userToken,
        },
        body: JSON.stringify({
          jewelry_category: CATEGORY_TO_DB_ENUM[jewelryType] || jewelryType,
          images: imageData,
        }),
      });
      
      console.log('[CategoryUploadStudio] Response status:', response.status);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit batch');
      }

      console.log('[CategoryUploadStudio] Batch submitted:', result);
      setSubmittedBatchId(result.batch_id);
      setIsSubmitted(true);
      clearValidation();
      
    } catch (error) {
      console.error('Failed to submit batch:', error);
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [images, hasFlaggedImages, showFlagWarning, clearValidation, jewelryType, navigate]);

  const handleStartAnother = useCallback(() => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setIsSubmitted(false);
    setSubmittedBatchId(null);
  }, [images]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, []);

  const canSubmit = images.length > 0 && !isSubmitting;

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
    <div className="h-[calc(100vh-5rem)] bg-background flex flex-col">
      {/* Compact Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <button
          onClick={() => navigate('/studio')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-wide">Back</span>
        </button>
        
        <h1 className="font-display text-lg uppercase tracking-wide">
          {categoryName}
        </h1>

        <div />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* CENTER COLUMN: Upload area + Submit */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Upload / Images Grid area */}
          <div 
            className={`flex-1 flex items-center justify-center p-8 overflow-y-auto transition-colors ${
              isDragOver ? 'bg-formanova-hero-accent/5 border-2 border-dashed border-formanova-hero-accent/50' : ''
            }`}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => images.length === 0 && fileInputRef.current?.click()}
          >
            {images.length > 0 ? (
              /* Grid of uploaded images - larger thumbnails */
              <div className="w-full max-w-4xl">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {images.map((image, index) => (
                      <motion.div
                        key={image.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        layout
                        className="space-y-1.5"
                      >
                        {/* Thumbnail - much larger */}
                        <div className={`relative aspect-square rounded-xl overflow-hidden group border-2 min-w-[200px] min-h-[200px] ${
                          image.isFlagged ? 'border-amber-500/70 ring-2 ring-amber-500/30' : 'border-border/50'
                        }`}>
                          <img
                            src={image.preview}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          
                          {/* Flag indicator */}
                          {image.isFlagged && (
                            <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center" title={image.flagReason}>
                              <AlertTriangle className="w-3 h-3" />
                            </div>
                          )}
                          
                          {/* Remove button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(image.id);
                            }}
                            disabled={isSubmitting}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {/* Per-image skin tone selector (non-necklace only) */}
                        {showSkinTone && (
                          <div className="flex justify-center gap-1">
                            {SKIN_TONES.map((tone) => (
                              <button
                                key={tone.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSkinToneChange(image.id, tone.id);
                                }}
                                disabled={isSubmitting}
                                title={tone.label}
                                className={`w-4 h-4 rounded-full transition-all ${
                                  image.skinTone === tone.id 
                                    ? 'ring-1 ring-formanova-hero-accent ring-offset-1 ring-offset-background scale-110' 
                                    : 'opacity-60 hover:opacity-100 hover:scale-105'
                                }`}
                                style={{ backgroundColor: tone.color }}
                              />
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Add more tile */}
                  {images.length < MAX_IMAGES && (
                    <motion.label
                      layout
                      className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-foreground/50 hover:bg-muted/30 transition-all min-w-[200px] min-h-[200px]"
                    >
                      <Plus className="w-10 h-10 text-muted-foreground" />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        disabled={isSubmitting}
                        onChange={(e) => {
                          if (e.target.files) addFiles(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </motion.label>
                  )}
                </div>

                {/* Image count + validation status */}
                <div className="text-center mt-4">
                  <p className="text-xs text-muted-foreground">
                    {images.length} of {MAX_IMAGES} images
                  </p>
                  {isValidating && (
                    <p className="text-xs text-formanova-hero-accent mt-1 animate-pulse">
                      Checking images...
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Diamond upload empty state - striking ping animation */
              <div className="text-center cursor-pointer group">
                <div className="relative mx-auto w-24 h-24 mb-6">
                  {/* Striking ping ring - expands outward */}
                  <div 
                    className="absolute inset-0 rounded-full bg-formanova-hero-accent/20 animate-ping" 
                    style={{ animationDuration: '2s' }} 
                  />
                  {/* Second ping ring - offset timing */}
                  <div 
                    className="absolute inset-0 rounded-full bg-formanova-hero-accent/10 animate-ping" 
                    style={{ animationDuration: '2s', animationDelay: '0.5s' }} 
                  />
                  {/* Core diamond container */}
                  <div className="absolute inset-0 rounded-full bg-formanova-hero-accent/10 flex items-center justify-center border-2 border-formanova-hero-accent/30 group-hover:border-formanova-hero-accent/60 transition-colors">
                    <Diamond className="h-10 w-10 text-formanova-hero-accent" />
                  </div>
                </div>
                <p className="text-xl font-display font-medium mb-2 group-hover:text-foreground transition-colors">
                  Drop your jewelry images here
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground/70">or paste with Ctrl+V</p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isSubmitting}
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            )}
          </div>

          {/* Bottom panel: Submit controls */}
          <AnimatePresence>
            {images.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="border-t border-border bg-background p-5 flex-shrink-0"
              >
                <div className="max-w-xl mx-auto">

                  {/* Main submit button - prominent placement */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isValidating}
                    className={`w-full py-4 px-6 font-display text-base uppercase tracking-wider transition-all flex items-center justify-center gap-3 rounded-lg shadow-lg ${
                      canSubmit && !isValidating
                        ? 'bg-formanova-hero-accent text-primary-foreground hover:bg-formanova-hero-accent/90 hover:shadow-xl'
                        : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                    }`}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                      />
                    ) : isValidating ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                        />
                        <span className="text-sm">Checking images...</span>
                      </>
                    ) : (
                      <>Generate Photoshoots</>
                    )}
                  </button>

                  {/* Info row below button */}
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>
                      <span className="text-foreground font-medium">{images.length}</span> image{images.length !== 1 ? 's' : ''} · Ready in up to 24 hours
                      {hasFlaggedImages && !showFlagWarning && (
                        <span className="ml-2 text-amber-500">
                          ({images.filter(img => img.isFlagged).length} flagged)
                        </span>
                      )}
                    </span>
                    
                    <div className="flex items-center gap-1.5 text-formanova-hero-accent">
                      <Diamond className="w-3 h-3" />
                      <span>First batch free</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT SIDEBAR: Guide (always visible) - wider for larger examples */}
        <div className="w-[480px] border-l border-border/50 p-6 bg-muted/10 overflow-y-auto flex-shrink-0">
          <div className="mb-4">
            <span className="marta-label text-muted-foreground text-[10px]">Upload Guide</span>
          </div>
          <ExampleGuidePanel categoryName={categoryName} categoryType={jewelryType} />
          
          {/* Skin tone explainer (non-necklace only) */}
          {showSkinTone && images.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <span className="marta-label text-muted-foreground text-[10px]">Model Skin Tone</span>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Select the skin tone for the AI-generated model in each photoshoot.
              </p>
              <div className="flex items-center gap-1.5 mt-3">
                {SKIN_TONES.map((tone) => (
                  <div key={tone.id} className="flex flex-col items-center gap-1">
                    <div
                      className="w-5 h-5 rounded-full border border-border/50"
                      style={{ backgroundColor: tone.color }}
                    />
                    <span className="text-[8px] text-muted-foreground/70">{tone.label.split(' ').pop()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flagged Images Warning Modal - Center Screen Overlay */}
      <AnimatePresence>
        {showFlagWarning && hasFlaggedImages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowFlagWarning(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-amber-500/50 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {/* Header with warning icon */}
              <div className="bg-amber-500/20 border-b border-amber-500/30 px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-display text-lg text-foreground">Flagged Images Detected</h2>
                  <p className="text-sm text-amber-200/70">{images.filter(img => img.isFlagged).length} of {images.length} images need review</p>
                </div>
              </div>

              {/* Flagged images preview */}
              <div className="px-6 py-4 max-h-[200px] overflow-y-auto">
                <div className="grid grid-cols-4 gap-2">
                  {images.filter(img => img.isFlagged).map((img) => (
                    <div 
                      key={img.id} 
                      className="aspect-square rounded-lg overflow-hidden border-2 border-amber-500/50 relative"
                    >
                      <img 
                        src={img.preview} 
                        alt="Flagged"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-amber-500/20" />
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <AlertTriangle className="w-2.5 h-2.5 text-black" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning message */}
              <div className="px-6 py-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  These images appear to be <span className="text-amber-400 font-medium">product shots, 3D renders, or flatlays</span>. 
                  Our AI works best with photos of jewelry <span className="text-foreground font-medium">worn on a person</span> (mannequin or model).
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Results for flagged images may not be usable.
                </p>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex gap-3">
                <button
                  onClick={() => setShowFlagWarning(false)}
                  className="flex-1 py-3 px-4 rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium text-sm"
                >
                  Go Back & Fix Images
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 px-4 rounded-lg bg-amber-600 text-white font-medium text-sm hover:bg-amber-500 transition-colors"
                >
                  Submit Anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryUploadStudio;
