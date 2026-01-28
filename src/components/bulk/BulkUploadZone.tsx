import { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus } from 'lucide-react';

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}

interface BulkUploadZoneProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

const BulkUploadZone = ({ 
  images, 
  onImagesChange, 
  maxImages = 10,
  disabled = false 
}: BulkUploadZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
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

    onImagesChange([...images, ...newImages]);
  }, [images, onImagesChange, maxImages, disabled]);

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
              Drop images here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse · paste with Ctrl+V
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            Up to {maxImages} images
          </span>
        </div>
      </motion.label>
    );
  }

  // Canva-style grid when images exist
  return (
    <div className="space-y-3">
      {/* Grid with proper spacing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 p-4">
        <AnimatePresence mode="popLayout">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout
              className="relative aspect-square bg-muted/30 rounded-xl overflow-hidden min-w-[400px] min-h-[400px]"
            >
              <img
                src={image.preview}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Number badge */}
              <div className="absolute bottom-5 left-5 w-14 h-14 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center">
                <span className="text-xl font-mono text-foreground">{index + 1}</span>
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
            className={`relative aspect-square rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 flex items-center justify-center min-w-[400px] min-h-[400px] ${
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
            <Plus className="w-16 h-16 text-muted-foreground" />
          </motion.label>
        )}
      </div>

      {/* Counter */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{images.length} of {maxImages}</span>
        <span className="text-[10px]">Ctrl+V to paste</span>
      </div>
    </div>
  );
};

export default BulkUploadZone;
