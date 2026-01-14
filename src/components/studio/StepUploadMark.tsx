import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Loader2, Image as ImageIcon, X, Diamond, Sparkles, Play, Undo2, Redo2, Circle, Expand, Download, HelpCircle, Gem, XOctagon } from 'lucide-react';
import { StudioState, SkinTone } from '@/pages/JewelryStudio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { MarkingTutorial } from './MarkingTutorial';
import { a100Api, ExampleImage } from '@/lib/a100-api';
import { temporalApi, getDAGStepLabel, getDAGStepProgress, base64ToBlob, pollDAGUntilComplete } from '@/lib/temporal-api';

const SKIN_TONES: { value: SkinTone; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'fair', label: 'Fair' },
  { value: 'medium', label: 'Medium' },
  { value: 'olive', label: 'Olive' },
  { value: 'brown', label: 'Brown' },
  { value: 'dark', label: 'Dark' },
];

// Create an overlay by compositing the binary mask (green tint) over the original image
async function createMaskOverlay(originalImage: string, maskBinary: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Cannot create canvas context'));
      return;
    }

    const originalImg = new Image();
    const maskImg = new Image();
    
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount < 2) return;
      
      // Set canvas size to original image size
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      
      // Draw original image
      ctx.drawImage(originalImg, 0, 0);
      
      // Create a temporary canvas for the mask
      const maskCanvas = document.createElement('canvas');
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) {
        reject(new Error('Cannot create mask canvas context'));
        return;
      }
      
      maskCanvas.width = originalImg.width;
      maskCanvas.height = originalImg.height;
      
      // Draw mask scaled to original size
      maskCtx.drawImage(maskImg, 0, 0, originalImg.width, originalImg.height);
      
      // Get mask data and create translucent green overlay where mask is selected
      // Note: The API returns inverted mask - white pixels = selected area to highlight
      const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const overlayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Use 30% opacity for translucent overlay
      const overlayOpacity = 0.3;
      
      for (let i = 0; i < maskData.data.length; i += 4) {
        // Check mask pixel brightness - white = selected area
        const brightness = (maskData.data[i] + maskData.data[i + 1] + maskData.data[i + 2]) / 3;
        // Apply translucent green tint where mask is WHITE (selected jewelry area)
        if (brightness > 128) {
          // Blend with green using translucent opacity
          overlayData.data[i] = Math.round(overlayData.data[i] * (1 - overlayOpacity)); // R
          overlayData.data[i + 1] = Math.round(overlayData.data[i + 1] * (1 - overlayOpacity) + 255 * overlayOpacity); // G
          overlayData.data[i + 2] = Math.round(overlayData.data[i + 2] * (1 - overlayOpacity)); // B
        }
      }
      
      ctx.putImageData(overlayData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    
    originalImg.onload = onLoad;
    maskImg.onload = onLoad;
    originalImg.onerror = () => reject(new Error('Failed to load original image'));
    maskImg.onerror = () => reject(new Error('Failed to load mask image'));
    
    originalImg.src = originalImage;
    maskImg.src = maskBinary;
  });
}

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
  jewelryType?: string;
}

export function StepUploadMark({ state, updateState, onNext, jewelryType = 'necklace' }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [undoStack, setUndoStack] = useState<{ x: number; y: number }[][]>([]);
  const [redoStack, setRedoStack] = useState<{ x: number; y: number }[][]>([]);
  const [exampleImages, setExampleImages] = useState<ExampleImage[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(true);
  const [markerSize, setMarkerSize] = useState(10);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Preprocessing state (Temporal workflow)
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  
  const { toast } = useToast();
  
  const redDots = state.redDots;
  const setRedDots = (dotsOrFn: { x: number; y: number }[] | ((prev: { x: number; y: number }[]) => { x: number; y: number }[])) => {
    if (typeof dotsOrFn === 'function') {
      updateState({ redDots: dotsOrFn(state.redDots) });
    } else {
      updateState({ redDots: dotsOrFn });
    }
  };

  const [examplesError, setExamplesError] = useState(false);
  
  useEffect(() => {
    const loadExamples = async () => {
      setIsLoadingExamples(true);
      setExamplesError(false);
      try {
        const examples = await a100Api.getExamples();
        setExampleImages(examples);
        // If we got empty array but no error, server might be offline
        if (examples.length === 0) {
          setExamplesError(true);
        }
      } catch (error) {
        console.error('Failed to load examples:', error);
        setExamplesError(true);
      }
      setIsLoadingExamples(false);
    };
    loadExamples();
  }, []);

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
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setRedDots([]);
      setUndoStack([]);
      setRedoStack([]);
      
      // Just show preview - no preprocessing, Temporal will handle everything
      updateState({
        originalImage: result,
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
        processingState: {},
      });
    };
    reader.readAsDataURL(file);
  }, [toast, updateState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Run preprocessing via DAG pipeline when user clicks Continue
  const handleProceed = async () => {
    if (redDots.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No marks found',
        description: 'Please mark the jewelry with red dots first.',
      });
      return;
    }

    if (!state.originalImage) {
      toast({
        variant: 'destructive',
        title: 'No image',
        description: 'Please upload an image first.',
      });
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep('Starting masking workflow...');

    try {
      // Convert image to blob
      const imageBlob = base64ToBlob(state.originalImage);
      
      // Send points as absolute pixel coordinates in SAM space (2000x2667)
      // The backend will normalize them internally by dividing by image dimensions
      // DO NOT normalize here - backend does: [[x / w, y / h] for x, y in points]
      const points = redDots.map(dot => [dot.x, dot.y]);
      const pointLabels = redDots.map(() => 1); // All foreground points

      console.log('[Masking] Starting DAG workflow with', points.length, 'points');
      console.log('[Masking] Points (absolute SAM coords):', points);

      // Start DAG masking workflow
      const { workflow_id } = await temporalApi.startMaskingWorkflow(
        imageBlob,
        points,
        pointLabels
      );

      console.log('[Masking] Started workflow:', workflow_id);

      // Poll for status
      const result = await pollDAGUntilComplete(workflow_id, 'masking', {
        intervalMs: 1500,
        onProgress: (visited, progress) => {
          const lastStep = visited[visited.length - 1] || null;
          setProcessingStep(getDAGStepLabel(lastStep, 'masking'));
          setProcessingProgress(progress);
          console.log('[Masking] Step:', lastStep, 'Progress:', progress);
        },
      });

      console.log('[Masking] Workflow completed, result:', result);

      // Extract mask data from sam3 sink
      // Result shape: { sam3: [{ mask: { uri: "...", bytes: ..., type: "..." }, overlay: { uri: "..." } }] }
      const sam3Result = result.sam3?.[0];
      
      if (!sam3Result) {
        throw new Error('No mask result from workflow');
      }

      // Handle both nested { uri: "..." } and flat "uri" formats
      const maskUri = typeof sam3Result.mask === 'object' ? sam3Result.mask?.uri : (sam3Result.mask_uri || sam3Result.mask);
      const overlayUri = typeof sam3Result.overlay === 'object' ? sam3Result.overlay?.uri : (sam3Result.overlay_uri || sam3Result.overlay);

      console.log('[Masking] Mask URI:', maskUri);
      console.log('[Masking] Overlay URI:', overlayUri);

      // Fetch the mask image for display
      setProcessingStep('Fetching mask...');
      setProcessingProgress(90);

      let maskBinary: string | null = null;
      let maskOverlay: string | null = null;

      if (maskUri) {
        try {
          const images = await temporalApi.fetchImages({
            mask: maskUri,
          });
          
          if (images.mask) {
            maskBinary = `data:image/png;base64,${images.mask}`;
            
            // Create overlay by compositing mask over original image
            setProcessingStep('Creating overlay...');
            maskOverlay = await createMaskOverlay(state.originalImage!, maskBinary);
            console.log('[Masking] Created overlay from binary mask');
          }
        } catch (fetchError) {
          console.warn('[Masking] Failed to fetch mask:', fetchError);
        }
      }

      // Update state with results
      updateState({
        maskOverlay,
        maskBinary,
        processingState: {
          resizedUri: sam3Result.resized_uri || sam3Result.image_uri,
          maskUri,
          overlayUri,
        },
      });

      setIsProcessing(false);
      onNext();

    } catch (error) {
      console.error('Masking error:', error);
      toast({
        variant: 'destructive',
        title: 'Masking failed',
        description: error instanceof Error ? error.message : 'Failed to generate mask. Please try again.',
      });
      setIsProcessing(false);
    }
  };

  const handleCancelProcessing = () => {
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStep('');
  };

  const MAX_DOTS = 6;
  const [showMaxDotsWarning, setShowMaxDotsWarning] = useState(false);

  const handleCanvasClick = (x: number, y: number) => {
    // Check if we've reached max
    if (redDots.length >= MAX_DOTS) {
      setShowMaxDotsWarning(true);
      // Auto-hide after 2 seconds
      setTimeout(() => setShowMaxDotsWarning(false), 2000);
      return;
    }
    
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
      redDots: [],
      processingState: {},
    });
    setUndoStack([]);
    setRedoStack([]);
  };

  const loadExample = (example: ExampleImage) => {
    setRedDots([]);
    setUndoStack([]);
    setRedoStack([]);
    
    const previewImage = `data:image/jpeg;base64,${example.image_base64}`;
    
    // Just show preview - Temporal handles all processing
    updateState({
      originalImage: previewImage,
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
      processingState: {},
    });
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Note: We no longer return early during processing - instead we show overlay on the image

  return (
    <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
      {/* Tutorial Overlay */}
      {showTutorial && <MarkingTutorial onDismiss={() => setShowTutorial(false)} />}
      
      {/* Fullscreen Dialog - Interactive mode for marking */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-border/20 [&>button]:hidden">
          <div className="relative w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                  <span className="text-sm font-medium">{redDots.length}/{MAX_DOTS}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fullscreenImage && handleDownload(fullscreenImage, 'jewelry_image.jpg')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFullscreenImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {fullscreenImage && state.originalImage && (
                <div className="relative">
                  <MaskCanvas
                    image={state.originalImage}
                    dots={redDots}
                    brushColor="#FF0000"
                    brushSize={markerSize}
                    mode="dot"
                    canvasSize={Math.min(window.innerHeight * 0.7, 700)}
                    onCanvasClick={handleCanvasClick}
                  />
                  {/* Max dots warning overlay */}
                  {showMaxDotsWarning && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      <div className="bg-destructive text-destructive-foreground rounded-lg px-4 py-3 shadow-xl text-center animate-pulse">
                        <p className="text-sm font-semibold">Maximum {MAX_DOTS} dots allowed</p>
                        <p className="text-xs mt-1 opacity-80">Remove some to add more</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border/20 flex justify-center">
              <p className="text-sm text-muted-foreground">
                Click on jewelry to mark it. Usually 3-5 dots are enough.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Upload Area */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <span className="marta-label">Step 1</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">Upload & Mark</h2>
          <p className="text-muted-foreground mt-2">Upload your image and click on the jewelry to mark it</p>
        </div>
        
        {/* Model Skin Tone - Only for non-necklace categories */}
        {jewelryType !== 'necklace' && (
          <div className="flex items-center gap-4 p-4 bg-muted/30 border border-border/30 rounded-lg">
            <label className="text-sm font-medium whitespace-nowrap">Model Skin Tone</label>
            <Select
              value={state.skinTone}
              onValueChange={(value: SkinTone) => updateState({ skinTone: value })}
            >
              <SelectTrigger className="w-48 bg-background border-border">
                <SelectValue placeholder="Select skin tone" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                {SKIN_TONES.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-4">
          {!state.originalImage ? (
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
                    onCanvasClick={isProcessing ? undefined : handleCanvasClick}
                    brushColor="#FF0000"
                    brushSize={markerSize}
                    mode="dot"
                    canvasSize={400}
                  />
                  
                  {/* Max dots warning overlay */}
                  {showMaxDotsWarning && !isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      <div className="bg-destructive text-destructive-foreground rounded-lg px-4 py-3 shadow-xl text-center animate-pulse">
                        <p className="text-sm font-semibold">Maximum {MAX_DOTS} dots allowed</p>
                        <p className="text-xs mt-1 opacity-80">Remove some to add more</p>
                      </div>
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <Gem className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                      </div>
                      <p className="text-white font-medium text-sm mb-1">{processingStep}</p>
                      <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500" 
                          style={{ width: `${processingProgress}%` }} 
                        />
                      </div>
                      <p className="text-white/80 text-xs mt-2">{processingProgress}%</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-3 text-white/80 hover:text-white hover:bg-white/10"
                        onClick={handleCancelProcessing}
                      >
                        <XOctagon className="h-3.5 w-3.5 mr-1.5" />
                        Cancel
                      </Button>
                    </div>
                  )}
                  
                  {/* Compact control bar - hide during processing */}
                  {!isProcessing && (
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
                  )}
                </div>
              </div>

              {/* Hide controls during processing */}
              {!isProcessing && (
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
                      <Button 
                        size="lg" 
                        onClick={handleProceed} 
                        disabled={redDots.length === 0 || isProcessing} 
                        className="font-semibold"
                      >
                        Generate Mask
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
        ) : examplesError || exampleImages.length === 0 ? (
          <div className="space-y-3 text-center py-4">
            <p className="text-sm text-muted-foreground">Example server unavailable</p>
            <p className="text-xs text-muted-foreground/70">Upload your own image to continue</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {exampleImages.map((example) => (
              <button
                key={example.id}
                onClick={() => loadExample(example)}
                className="group relative aspect-square overflow-hidden border border-border/30 hover:border-foreground/30 transition-all"
              >
                <img
                  src={`data:image/jpeg;base64,${example.thumbnail_base64 || example.image_base64}`}
                  alt={example.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
