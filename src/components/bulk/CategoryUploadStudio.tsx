import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, Gift, Plus, Diamond, Sparkles } from 'lucide-react';

import { SkinTone } from './ImageUploadCard';
import BatchSubmittedConfirmation from './BatchSubmittedConfirmation';
import ExampleGuidePanel from './ExampleGuidePanel';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}

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

const MAX_IMAGES = 10;

const CategoryUploadStudio = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  
  const [images, setImages] = useState<ImageWithSkinTone[]>([]);
  // Removed hasAcknowledgedTime - no longer needed
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedBatchId, setSubmittedBatchId] = useState<string | null>(null);
  const [globalSkinTone, setGlobalSkinTone] = useState<SkinTone>('medium');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jewelryType = type || 'necklace';
  const categoryName = CATEGORY_NAMES[jewelryType] || 'Jewelry';
  const showSkinTone = jewelryType !== 'necklace';

  // Add files helper
  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = MAX_IMAGES - images.length;
    const filesToAdd = fileArray.slice(0, remainingSlots).filter(f => f.type.startsWith('image/'));
    
    const newImages: ImageWithSkinTone[] = filesToAdd.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      skinTone: globalSkinTone,
    }));

    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
    }
  }, [images.length, globalSkinTone]);

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

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) return;

    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockBatchId = `batch_${Date.now()}`;
      setSubmittedBatchId(mockBatchId);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit batch:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [images]);

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
              /* Grid of uploaded images */
              <div className="w-full max-w-2xl">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
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
                        {/* Thumbnail */}
                        <div className="relative aspect-square rounded-lg overflow-hidden group border border-border/50">
                          <img
                            src={image.preview}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
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
                      className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-foreground/50 hover:bg-muted/30 transition-all"
                    >
                      <Plus className="w-6 h-6 text-muted-foreground" />
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

                {/* Image count */}
                <p className="text-center text-xs text-muted-foreground mt-4">
                  {images.length} of {MAX_IMAGES} images
                </p>
              </div>
            ) : (
              /* Diamond upload empty state */
              <div className="text-center cursor-pointer group">
                {/* Dotted circle container */}
                <div className="relative w-32 h-32 mx-auto mb-6">
                  {/* Animated dotted border */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-dashed border-formanova-hero-accent/40 group-hover:border-formanova-hero-accent/70"
                    animate={{ 
                      rotate: 360,
                      scale: [1, 1.02, 1],
                    }}
                    transition={{ 
                      rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                      scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                    }}
                  />
                  
                  {/* Inner glow ring */}
                  <motion.div
                    className="absolute inset-2 rounded-full border border-formanova-hero-accent/20"
                    animate={{ 
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                  />
                  
                  {/* Diamond with blink animation */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ 
                      rotateY: [0, 180, 360],
                    }}
                    transition={{ 
                      duration: 8, 
                      repeat: Infinity, 
                      ease: "linear" 
                    }}
                  >
                    <motion.div
                      animate={{ 
                        opacity: [0.6, 1, 0.6],
                        scale: [1, 1.05, 1],
                      }}
                      transition={{ 
                        duration: 1.5, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                      }}
                    >
                      <Diamond 
                        className="w-16 h-16 text-formanova-hero-accent group-hover:text-formanova-hero-accent transition-colors duration-300" 
                        strokeWidth={1.5}
                      />
                    </motion.div>
                  </motion.div>
                  
                  {/* Pulsing plus icon */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    animate={{ 
                      scale: [1, 1.15, 1],
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Plus className="w-6 h-6 text-formanova-hero-accent" />
                  </motion.div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
                  Drop images here or click to upload
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
                    disabled={!canSubmit}
                    className={`w-full py-4 px-6 font-display text-base uppercase tracking-wider transition-all flex items-center justify-center gap-3 rounded-lg shadow-lg ${
                      canSubmit
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
                    ) : (
                      <>Generate Photoshoots</>
                    )}
                  </button>

                  {/* Info row below button */}
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>
                      <span className="text-foreground font-medium">{images.length}</span> image{images.length !== 1 ? 's' : ''} · Ready in up to 24 hours
                    </span>
                    
                    <div className="flex items-center gap-1.5 text-formanova-hero-accent">
                      <Gift className="w-3 h-3" />
                      <span>First batch free</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT SIDEBAR: Guide (always visible) */}
        <div className="w-72 border-l border-border/50 p-4 bg-muted/10 overflow-y-auto flex-shrink-0">
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
    </div>
  );
};

export default CategoryUploadStudio;
