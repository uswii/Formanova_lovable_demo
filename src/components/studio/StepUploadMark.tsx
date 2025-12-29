import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Lightbulb, Loader2, Image as ImageIcon, X, Diamond, Sparkles, Play, Undo2, Redo2, Circle, Expand, Download, HelpCircle, Gem, XOctagon } from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { MarkingTutorial } from './MarkingTutorial';
import { a100Api, ExampleImage } from '@/lib/a100-api';
import { temporalApi, getStepLabel, getStepProgress, PreprocessingResult } from '@/lib/temporal-api';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
}

export function StepUploadMark({ state, updateState, onNext }: Props) {
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

  useEffect(() => {
    const loadExamples = async () => {
      setIsLoadingExamples(true);
      const examples = await a100Api.getExamples();
      setExampleImages(examples);
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

  // Run preprocessing via Temporal when user clicks Continue
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
    setProcessingStep('Starting preprocessing...');

    try {
      // Prepare image base64 (strip data URL prefix if present)
      let imageBase64 = state.originalImage;
      if (imageBase64.includes(',')) {
        imageBase64 = imageBase64.split(',')[1];
      }

      // Convert red dots to mask points (normalized 0-1)
      const canvasWidth = 400;
      const canvasHeight = 533; // 400 * (4/3)
      
      const maskPoints = redDots.map(dot => ({
        x: dot.x / canvasWidth,
        y: dot.y / canvasHeight,
        label: 1 as const, // All marks are foreground
      }));

      // Start Temporal preprocessing workflow
      const response = await temporalApi.startPreprocessing({
        originalImageBase64: imageBase64,
        maskPoints,
      });

      console.log('[Preprocessing] Response:', response);
      
      const workflowId = response?.workflowId;
      if (!workflowId) {
        throw new Error('Backend did not return a workflowId. Response: ' + JSON.stringify(response));
      }

      console.log('[Preprocessing] Started workflow:', workflowId);

      // Poll for status
      let completed = false;
      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const status = await temporalApi.getWorkflowStatus(workflowId);
        
        const stepProgress = getStepProgress(status.currentStep);
        const effectiveProgress = stepProgress > 0 ? stepProgress : (status.progress || 0);
        // Scale to 0-60% for preprocessing (mask gen ends at ~48%)
        setProcessingProgress(Math.min(effectiveProgress, 60));
        setProcessingStep(getStepLabel(status.currentStep));

        console.log('[Preprocessing] Step:', status.currentStep, 'Progress:', effectiveProgress);

        if (status.status === 'COMPLETED' && status.result) {
          completed = true;
          
          const result = status.result as unknown as PreprocessingResult;
          
          // Update state with preprocessing results
          updateState({
            maskOverlay: result.maskOverlayBase64 ? `data:image/png;base64,${result.maskOverlayBase64}` : null,
            maskBinary: result.maskBase64 ? `data:image/png;base64,${result.maskBase64}` : null,
            sessionId: result.sessionId,
            scaledPoints: result.scaledPoints,
            processingState: {
              resizedUri: result.resizedUri,
              bgRemovedUri: result.backgroundRemoved ? result.resizedUri : undefined,
              padding: result.padding,
            },
          });

          setIsProcessing(false);
          onNext();
        } else if (status.status === 'FAILED') {
          throw new Error(status.error?.message || 'Preprocessing failed');
        } else if (status.status === 'CANCELLED') {
          throw new Error('Preprocessing was cancelled');
        }
      }

    } catch (error) {
      console.error('Preprocessing error:', error);
      toast({
        variant: 'destructive',
        title: 'Preprocessing failed',
        description: error instanceof Error ? error.message : 'Failed to process image. Please try again.',
      });
      setIsProcessing(false);
    }
  };

  const handleCancelProcessing = () => {
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStep('');
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
                  
                  {/* Processing overlay - shows on top of canvas with dots visible */}
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
                        disabled={redDots.length === 0} 
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
                className="group relative aspect-square overflow-hidden border border-border/30 hover:border-foreground/30 transition-all"
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
