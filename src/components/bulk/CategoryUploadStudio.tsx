import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, Send, Gift, Plus, Diamond, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [hasAcknowledgedTime, setHasAcknowledgedTime] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedBatchId, setSubmittedBatchId] = useState<string | null>(null);
  const [globalSkinTone, setGlobalSkinTone] = useState<SkinTone>('medium');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jewelryType = type || 'necklace';
  const categoryName = CATEGORY_NAMES[jewelryType] || 'Jewelry';
  const showSkinTone = jewelryType !== 'necklace';

  const selectedImage = images[selectedIndex] || null;

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
      // Select the first new image
      setSelectedIndex(images.length);
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
      const newImages = prev.filter(i => i.id !== imageId);
      // Adjust selected index
      if (selectedIndex >= newImages.length && newImages.length > 0) {
        setSelectedIndex(newImages.length - 1);
      }
      return newImages;
    });
  }, [selectedIndex]);

  const handleSkinToneChange = useCallback((imageId: string, tone: SkinTone) => {
    setImages(prev => 
      prev.map(img => 
        img.id === imageId ? { ...img, skinTone: tone } : img
      )
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (images.length === 0 || !hasAcknowledgedTime) return;

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
  }, [images, hasAcknowledgedTime]);

  const handleStartAnother = useCallback(() => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setSelectedIndex(0);
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

      {/* Main Content - Canva Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Images Panel */}
        <div className="w-72 border-r border-border/50 flex flex-col bg-muted/20">
          {/* Images Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 gap-2">
              <AnimatePresence mode="popLayout">
                {images.map((image, index) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                    className="space-y-1"
                  >
                    {/* Thumbnail */}
                    <div
                      onClick={() => setSelectedIndex(index)}
                      className={`relative aspect-square rounded overflow-hidden cursor-pointer group ${
                        selectedIndex === index 
                          ? 'ring-2 ring-formanova-hero-accent' 
                          : 'hover:ring-1 hover:ring-foreground/30'
                      }`}
                    >
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
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {/* Selection indicator */}
                      {selectedIndex === index && (
                        <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-formanova-hero-accent flex items-center justify-center">
                          <span className="text-[8px] text-white font-bold">{index + 1}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Per-image skin tone selector (non-necklace only) */}
                    {showSkinTone && (
                      <div className="flex justify-center gap-0.5">
                        {SKIN_TONES.map((tone) => (
                          <button
                            key={tone.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSkinToneChange(image.id, tone.id);
                            }}
                            disabled={isSubmitting}
                            title={tone.label}
                            className={`w-3.5 h-3.5 rounded-full transition-all ${
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
              {images.length < MAX_IMAGES && images.length > 0 && (
                <motion.label
                  layout
                  className="aspect-square rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-foreground/50 hover:bg-muted/30 transition-all"
                >
                  <Plus className="w-5 h-5 text-muted-foreground" />
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

            {/* Empty state hint */}
            {images.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Upload images to get started</p>
                <p className="text-[10px] opacity-70 mt-1">or paste with Ctrl+V</p>
              </div>
            )}
          </div>

          {/* Counter */}
          {images.length > 0 && (
            <div className="p-3 border-t border-border/50 text-xs text-muted-foreground">
              {images.length} of {MAX_IMAGES} images
            </div>
          )}
        </div>

        {/* CENTER: Canvas / Preview Area */}
        <div className="flex-1 flex flex-col">
          {/* Canvas area */}
          <div 
            className={`flex-1 flex items-center justify-center p-8 transition-colors ${
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
              /* When images exist - show selected image preview */
              selectedImage ? (
                <motion.div
                  key={selectedImage.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative max-w-full max-h-full"
                >
                  <img
                    src={selectedImage.preview}
                    alt="Selected jewelry"
                    className="max-h-[60vh] max-w-full object-contain rounded shadow-lg"
                  />
                </motion.div>
              ) : null
            ) : (
              /* Inviting empty state - matches single upload style */
              <div 
                className="text-center cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="relative mx-auto w-24 h-24 mb-6">
                  <div className="absolute inset-0 rounded-full bg-formanova-hero-accent/10 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-0 rounded-full bg-formanova-hero-accent/5 flex items-center justify-center border-2 border-formanova-hero-accent/20">
                    <Diamond className="h-10 w-10 text-formanova-hero-accent" />
                  </div>
                </div>
                <p className="text-xl font-display font-medium mb-2">Drop your jewelry images here</p>
                <p className="text-sm text-muted-foreground mb-6">
                  or click to browse · paste from clipboard (Ctrl+V)
                </p>
                <Button variant="outline" size="lg" className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Browse Files
                </Button>
                
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
                className="border-t border-border/50 p-4 bg-background"
              >
                <div className="max-w-2xl mx-auto space-y-4">
                  {/* Compact processing notice */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">{images.length} image{images.length !== 1 ? 's' : ''}</span>
                        {' '}· Results delivered in up to 24 hours
                      </p>
                    </div>
                    
                    {!hasAcknowledgedTime ? (
                      <button
                        onClick={() => setHasAcknowledgedTime(true)}
                        className="px-4 py-2 text-xs font-mono uppercase tracking-wider marta-frame hover:bg-muted/50 transition-colors"
                      >
                        I understand
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-formanova-hero-accent">
                        <Gift className="w-3 h-3" />
                        First batch free
                      </div>
                    )}
                  </div>

                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full py-3 marta-frame font-display text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      canSubmit
                        ? 'bg-formanova-hero-accent text-primary-foreground hover:bg-formanova-hero-accent/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Batch
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT SIDEBAR: Guide (only after uploads) */}
        <AnimatePresence>
          {images.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-72 border-l border-border/50 p-4 bg-muted/10 overflow-y-auto"
            >
              <div className="mb-4">
                <span className="marta-label text-muted-foreground text-[10px]">Upload Guide</span>
              </div>
              <ExampleGuidePanel categoryName={categoryName} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CategoryUploadStudio;
