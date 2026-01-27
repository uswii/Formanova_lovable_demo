import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon, Plus } from 'lucide-react';

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

  const handleRemoveImage = useCallback((id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onImagesChange(images.filter(img => img.id !== id));
  }, [images, onImagesChange]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = ''; // Reset input
  }, [handleFiles]);

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Counter */}
      <div className="flex items-center justify-between">
        <span className="marta-label text-muted-foreground">
          {images.length} of {maxImages} images
        </span>
        {images.length > 0 && (
          <button
            onClick={() => {
              images.forEach(img => URL.revokeObjectURL(img.preview));
              onImagesChange([]);
            }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            disabled={disabled}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Thumbnail Grid + Drop Zone */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        <AnimatePresence mode="popLayout">
          {images.map((image) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout
              className="relative aspect-square marta-frame overflow-hidden group"
            >
              <img
                src={image.preview}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleRemoveImage(image.id)}
                disabled={disabled}
                className="absolute top-1 right-1 w-5 h-5 bg-background/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-primary-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add More / Drop Zone */}
        {canAddMore && (
          <motion.label
            layout
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative aspect-square marta-frame border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
              disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : isDragOver 
                  ? 'border-formanova-hero-accent bg-formanova-hero-accent/10' 
                  : 'hover:border-foreground/40 hover:bg-muted/30'
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
            {images.length === 0 ? (
              <>
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-[9px] font-mono text-muted-foreground text-center px-1">
                  Drop or click
                </span>
              </>
            ) : (
              <Plus className="w-5 h-5 text-muted-foreground" />
            )}
          </motion.label>
        )}
      </div>

      {/* Empty State */}
      {images.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-4"
        >
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="w-4 h-4" />
            <span className="text-sm">Drag and drop up to {maxImages} images</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">
            or click the upload area to browse
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default BulkUploadZone;
