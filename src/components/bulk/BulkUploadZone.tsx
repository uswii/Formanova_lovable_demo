import { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useImageValidation } from '@/hooks/use-image-validation';
import { useIsMobile } from '@/hooks/use-mobile';

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  flagged?: boolean;
  flagReason?: string;
}

interface BulkUploadZoneProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
  category?: string;
}

const BulkUploadZone = ({ 
  images, 
  onImagesChange, 
  maxImages = 10,
  disabled = false,
  category = 'jewelry'
}: BulkUploadZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const { validateImages, isValidating, error: validationError } = useImageValidation();
  const isMobile = useIsMobile();

  // Show toast when validation service has issues
  useEffect(() => {
    if (validationError) {
      toast.warning('Image validation unavailable', {
        description: 'Uploads will proceed without quality checks',
        duration: 5000,
      });
    }
  }, [validationError]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || disabled) return;
    
    const remainingSlots = maxImages - images.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    
    const newImages: UploadedImage[] = filesToAdd
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview: URL.createObjectURL(file),
      }));

    // Add images immediately for responsive UI
    const allImages = [...images, ...newImages];
    onImagesChange(allImages);

    // Run validation in background
    if (newImages.length > 0) {
      const filesToValidate = newImages.map(img => img.file);
      const validationResult = await validateImages(filesToValidate, category);
      
      if (validationResult && validationResult.flagged_count > 0) {
        // Update images with flagged status
        const updatedImages = allImages.map((img, idx) => {
          const originalIdx = idx - images.length;
          if (originalIdx >= 0 && originalIdx < validationResult.results.length) {
            const result = validationResult.results[originalIdx];
            if (result.flags.length > 0) {
              return {
                ...img,
                flagged: true,
                flagReason: result.message || 'Image may not meet requirements',
              };
            }
          }
          return img;
        });
        onImagesChange(updatedImages);
        
        toast.warning(`${validationResult.flagged_count} image(s) flagged`, {
          description: 'These may not be worn jewelry photos',
          duration: 5000,
        });
      }
    }
  }, [images, onImagesChange, maxImages, disabled, category, validateImages]);

  // Global paste listener
  useEffect(() => {
    if (disabled) return;
    
    const handlePaste = (e: ClipboardEvent) => {
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
        const remainingSlots = maxImages - images.length;
        const filesToAdd = imageFiles.slice(0, remainingSlots);
        
        const newImages: UploadedImage[] = filesToAdd.map(file => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: URL.createObjectURL(file),
        }));
        
        onImagesChange([...images, ...newImages]);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [images, onImagesChange, maxImages, disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const canAddMore = images.length < maxImages;

  // Empty state - single large drop zone
  if (images.length === 0) {
    return (
      <motion.label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative block w-full aspect-[4/3] marta-frame border-dashed cursor-pointer transition-all duration-200 ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : isDragOver 
              ? 'border-formanova-hero-accent bg-formanova-hero-accent/5' 
              : 'hover:border-foreground/40 hover:bg-muted/20'
        }`}
        whileHover={disabled ? {} : { scale: 1.005 }}
        whileTap={disabled ? {} : { scale: 0.995 }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          disabled={disabled}
          className="sr-only"
        />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground font-medium">
              {isMobile ? 'Tap to add photos' : 'Drop images here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isMobile ? 'or select from gallery' : 'or click to browse · paste with Ctrl+V'}
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            Up to {maxImages} images
          </span>
        </div>
      </motion.label>
    );
  }

  // Responsive grid when images exist
  return (
    <div className="space-y-3 w-full">
      {/* Responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 p-2 sm:p-4">
        <AnimatePresence mode="popLayout">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout
              className={`relative aspect-square bg-muted/30 rounded-lg sm:rounded-xl overflow-hidden ${
                image.flagged ? 'ring-2 ring-amber-500/70' : ''
              }`}
            >
              <img
                src={image.preview}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Flagged indicator */}
              {image.flagged && (
                <div 
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center"
                  title={image.flagReason || 'Image may not meet requirements'}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              {/* Number badge */}
              <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center">
                <span className="text-sm sm:text-base font-mono text-foreground">{index + 1}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add more tile */}
        {canAddMore && (
          <motion.label
            layout
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative aspect-square rounded-lg sm:rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 flex items-center justify-center ${
              disabled 
                ? 'opacity-50 cursor-not-allowed border-muted' 
                : isDragOver 
                  ? 'border-formanova-hero-accent bg-formanova-hero-accent/5' 
                  : 'border-muted-foreground/30 hover:border-foreground/50 hover:bg-muted/20'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInput}
              disabled={disabled}
              className="sr-only"
            />
            <Plus className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
          </motion.label>
        )}
      </div>

      {/* Counter and status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2 sm:px-4">
        <div className="flex items-center gap-2">
          <span>{images.length} of {maxImages}</span>
          {isValidating && (
            <span className="flex items-center gap-1 text-formanova-hero-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking...
            </span>
          )}
        </div>
        {!isMobile && <span className="text-[10px]">Ctrl+V to paste</span>}
      </div>
    </div>
  );
};

export default BulkUploadZone;
