import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Upload, Lightbulb, Loader2, Image as ImageIcon, X, Diamond, Sparkles, Play, Undo2, Redo2, Circle, Expand, Download, HelpCircle } from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { MarkingTutorial } from './MarkingTutorial';
import { a100Api, ExampleImage } from '@/lib/a100-api';
import { 
  uploadToAzure, 
  resize, 
  zoomCheck, 
  submitBiRefNetJob, 
  pollBiRefNetJob, 
  submitSAM3Job, 
  pollSAM3Job, 
  pollJobUntilComplete,
  fetchImageAsBase64 
} from '@/lib/microservices-api';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
}

// Extended state to track URIs
interface ProcessingState {
  originalUri?: string;
  resizedUri?: string;
  bgRemovedUri?: string;
  padding?: { top: number; bottom: number; left: number; right: number };
}

export function StepUploadMark({ state, updateState, onNext }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingMask, setIsGeneratingMask] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [redDots, setRedDots] = useState<{ x: number; y: number }[]>([]);
  const [undoStack, setUndoStack] = useState<{ x: number; y: number }[][]>([]);
  const [redoStack, setRedoStack] = useState<{ x: number; y: number }[][]>([]);
  const [exampleImages, setExampleImages] = useState<ExampleImage[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(true);
  const [markerSize, setMarkerSize] = useState(10);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({});
  const { toast } = useToast();

  useEffect(() => {
    const loadExamples = async () => {
      setIsLoadingExamples(true);
      const examples = await a100Api.getExamples();
      setExampleImages(examples);
      setIsLoadingExamples(false);
    };
    loadExamples();
  }, []);

  const processUploadedImage = async (base64Data: string) => {
    setIsProcessingUpload(true);
    try {
      // Step 1: Upload original to Azure
      let cleanBase64 = base64Data;
      if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1];
      
      const { uri: originalUri } = await uploadToAzure(cleanBase64);
      console.log('Original uploaded:', originalUri);

      // Step 2: Resize to 2000x2667
      const resizeResult = await resize({ 
        image_uri: originalUri, 
        target_width: 2000, 
        target_height: 2667 
      });
      
      // Step 3: Upload resized image to Azure (since resize returns base64)
      const { uri: resizedUri } = await uploadToAzure(resizeResult.image_base64);
      console.log('Resized uploaded:', resizedUri);

      // Step 4: Check if background removal is needed
      const zoomResult = await zoomCheck({ image_uri: resizedUri });
      console.log('Zoom check result:', zoomResult);

      let finalUri = resizedUri;
      
      // Step 5: If needed, remove background via BiRefNet
      if (zoomResult.should_remove_background) {
        const { job_id } = await submitBiRefNetJob(resizedUri);
        
        const result = await pollJobUntilComplete(
          () => pollBiRefNetJob(job_id),
          {
            maxAttempts: 120,
            intervalMs: 1000,
          }
        );
        
        if (result.result_uri) {
          finalUri = result.result_uri;
          console.log('Background removed:', finalUri);
        }
      }

      // Step 6: Fetch the final image and display it
      const finalBase64 = await fetchImageAsBase64(finalUri);
      
      // Update state with processed image
      setProcessingState({
        originalUri,
        resizedUri,
        bgRemovedUri: zoomResult.should_remove_background ? finalUri : undefined,
        padding: resizeResult.padding,
      });

      updateState({
        originalImage: `data:image/jpeg;base64,${finalBase64}`,
        markedImage: null,
        maskOverlay: null,
        maskBinary: null,
        originalMask: null,
        editedMask: null,
        fluxResult: null,
        geminiResult: null,
        fidelityViz: null,
        metrics: null,
        status: null,
        sessionId: null,
        scaledPoints: null,
      });

      toast({
        title: 'Image processed',
        description: zoomResult.should_remove_background 
          ? 'Image resized and background removed' 
          : 'Image resized and ready',
      });

    } catch (error) {
      console.error('Image processing error:', error);
      toast({
        variant: 'destructive',
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Failed to process image',
      });
    } finally {
      setIsProcessingUpload(false);
    }
  };

  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an image file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      setRedDots([]);
      setUndoStack([]);
      setRedoStack([]);
      setProcessingState({});
      
      // Process the uploaded image through the new pipeline
      await processUploadedImage(result);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleGenerateMask = async () => {
    if (redDots.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No marks found',
        description: 'Please mark the jewelry with red dots first.',
      });
      return;
    }

    if (!processingState.resizedUri) {
      toast({
        variant: 'destructive',
        title: 'No image',
        description: 'Please upload an image first.',
      });
      return;
    }

    setIsGeneratingMask(true);

    try {
      const points = redDots.map((dot) => [dot.x, dot.y]);
      
      // Use the processed URI (bg removed if applicable, otherwise resized)
      const imageUri = processingState.bgRemovedUri || processingState.resizedUri;

      // Submit SAM3 job
      const { job_id } = await submitSAM3Job({
        image_uri: imageUri,
        points,
      });

      // Poll for completion
      const result = await pollJobUntilComplete(
        () => pollSAM3Job(job_id),
        {
          maxAttempts: 120,
          intervalMs: 1000,
        }
      );

      if (!result.mask_uri) {
        throw new Error('No mask returned from SAM3');
      }

      // Fetch all the mask images
      
      const [maskBase64, maskOverlayBase64, originalMaskBase64] = await Promise.all([
        fetchImageAsBase64(result.mask_uri),
        result.mask_overlay_uri ? fetchImageAsBase64(result.mask_overlay_uri) : Promise.resolve(null),
        result.original_mask_uri ? fetchImageAsBase64(result.original_mask_uri) : Promise.resolve(null),
      ]);

      // Also fetch the processed image if we have an overlay
      let processedImageBase64 = state.originalImage;
      if (result.mask_overlay_uri) {
        // The overlay should be based on the processed image
        processedImageBase64 = state.originalImage;
      }


      updateState({
        originalImage: processedImageBase64,
        maskOverlay: maskOverlayBase64 ? `data:image/jpeg;base64,${maskOverlayBase64}` : null,
        maskBinary: `data:image/png;base64,${maskBase64}`,
        originalMask: originalMaskBase64 ? `data:image/png;base64,${originalMaskBase64}` : `data:image/png;base64,${maskBase64}`,
        sessionId: job_id,
        scaledPoints: result.scaled_points ?? null,
      });

      onNext();
    } catch (error) {
      console.error('Segmentation error:', error);
      
      toast({
        variant: 'destructive',
        title: 'Segmentation failed',
        description: error instanceof Error ? error.message : 'Failed to generate mask. Please try again.',
      });
    } finally {
      setIsGeneratingMask(false);
    }
  };

  const handleCanvasClick = (x: number, y: number) => {
    setUndoStack((prev) => [...prev, redDots]);
    setRedoStack([]);
    setRedDots((prev) => [...prev, { x, y }]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, redDots]);
    setRedDots(previousState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, redDots]);
    setRedDots(nextState);
  };

  const clearImage = () => {
    updateState({
      originalImage: null,
      markedImage: null,
      maskOverlay: null,
      maskBinary: null,
      originalMask: null,
      editedMask: null,
      sessionId: null,
      scaledPoints: null,
    });
    setRedDots([]);
    setUndoStack([]);
    setRedoStack([]);
    setProcessingState({});
  };

  const loadExample = async (example: ExampleImage) => {
    setRedDots([]);
    setUndoStack([]);
    setRedoStack([]);
    setProcessingState({});
    
    // Process example image through the same pipeline
    await processUploadedImage(`data:image/jpeg;base64,${example.image_base64}`);
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
      {/* Tutorial Overlay */}
      {showTutorial && <MarkingTutorial onDismiss={() => setShowTutorial(false)} />}
      
      {/* Fullscreen Dialog */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-border/20">
          <div className="relative w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/20">
              <h3 className="font-display text-lg">Image Preview</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fullscreenImage && handleDownload(fullscreenImage, 'jewelry_image.jpg')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {fullscreenImage && (
                <img 
                  src={fullscreenImage} 
                  alt="Full preview" 
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Upload Area */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <span className="marta-label">Step 1</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              💎 Necklaces Only
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">Upload & Mark</h2>
          <p className="text-muted-foreground mt-2">Upload your image and tap on the jewelry to select it</p>
        </div>
        
        <div className="space-y-4">
          {isProcessingUpload ? (
            <div className="border border-dashed border-border/40 text-center p-12 flex-1 flex flex-col items-center justify-center">
              <div className="relative mx-auto w-16 h-16">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
              </div>
            </div>
          ) : !state.originalImage ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="relative border border-dashed border-border/40 text-center cursor-pointer hover:border-foreground/40 hover:bg-foreground/5 transition-all p-12 flex-1 flex flex-col items-center justify-center"
            >
              <div className="relative mx-auto w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                  <Diamond className="h-10 w-10 text-primary" />
                </div>
              </div>
              <p className="text-xl font-display font-medium mb-2">Drop your jewelry image here</p>
              <p className="text-sm text-muted-foreground mb-6">or click to browse your files</p>
              <Button variant="outline" size="lg" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                Browse Files
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative inline-block group">
                  {/* Canvas */}
                  <MaskCanvas
                    image={state.originalImage}
                    dots={redDots}
                    onCanvasClick={handleCanvasClick}
                    brushColor="#FF0000"
                    brushSize={markerSize}
                    mode="dot"
                    canvasSize={400}
                  />
                  {/* Compact control bar */}
                  <div className="absolute top-2 right-2 z-10 flex gap-1">
                    <button
                      className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                      onClick={() => setShowTutorial(true)}
                      title="Tutorial"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                      onClick={() => setFullscreenImage(state.originalImage)}
                      title="Fullscreen"
                    >
                      <Expand className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                      onClick={clearImage}
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4 bg-muted/50 rounded-lg p-3">
                  <Circle className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Marker Size</span>
                  <Slider
                    value={[markerSize]}
                    onValueChange={([v]) => setMarkerSize(v)}
                    min={4}
                    max={24}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-8 text-right">{markerSize}px</span>
                </div>
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-base">
                      <span className="font-bold text-foreground">{redDots.length}</span>
                      <span className="text-muted-foreground"> marks placed</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="default" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo">
                      <Undo2 className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="default" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo">
                      <Redo2 className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        setUndoStack((prev) => [...prev, redDots]);
                        setRedoStack([]);
                        setRedDots([]);
                      }}
                      disabled={redDots.length === 0}
                    >
                      Clear All
                    </Button>
                    <Button size="lg" onClick={handleGenerateMask} disabled={isGeneratingMask || redDots.length === 0} className="font-semibold">
                      {isGeneratingMask ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2" />
                          Generate Mask
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border border-border/20 p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Pro Tip:</strong> Use high-quality inputs for best results. Sharp, well-lit images produce the most accurate masks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Examples Sidebar */}
      <div className="space-y-6">
        <div>
          <span className="marta-label mb-3 block">Gallery</span>
          <h3 className="font-display text-2xl uppercase tracking-tight">Examples</h3>
          <p className="text-muted-foreground text-sm mt-2">Click any example to try it</p>
        </div>
        
        {isLoadingExamples ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : exampleImages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">No examples available</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {exampleImages.map((example) => (
              <button
                key={example.id}
                onClick={() => loadExample(example)}
                disabled={isProcessingUpload}
                className="group relative aspect-square overflow-hidden border border-border/30 hover:border-foreground/30 transition-all disabled:opacity-50"
              >
                <img
                  src={`data:image/jpeg;base64,${example.thumbnail_base64 || example.image_base64}`}
                  alt={example.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <Play className="h-6 w-6 text-white" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
