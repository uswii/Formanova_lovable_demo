import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Lightbulb, 
  ArrowLeft, 
  Undo, 
  Redo, 
  Download,
  CheckCircle2,
  XCircle,
  BarChart3,
  Expand,
  RefreshCw,
  Gem,
  XOctagon,
} from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { temporalApi, getStepProgress, getStepLabel } from '@/lib/temporal-api';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onBack: () => void;
}

type BrushStroke = {
  type: 'add' | 'remove';
  points: number[][];
  radius: number;
};

type ViewState = 'refine' | 'generating' | 'results';

export function StepRefineAndGenerate({ state, updateState, onBack }: Props) {
  const { toast } = useToast();
  
  // View state
  const [currentView, setCurrentView] = useState<ViewState>(
    state.fluxResult || state.geminiResult ? 'results' : 'refine'
  );

  // Mask editing state
  const [brushMode, setBrushMode] = useState<'add' | 'remove'>('add');
  const [brushSize, setBrushSize] = useState(30);
  const [history, setHistory] = useState<BrushStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeStroke, setActiveStroke] = useState<BrushStroke | null>(null);

  // Fullscreen state
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; title: string } | null>(null);

  // Generation state - Temporal workflow
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStepLabel, setCurrentStepLabel] = useState('Starting workflow...');

  const effectiveStrokes = useMemo(() => {
    if (historyIndex < 0) return [];
    return history[historyIndex] ?? [];
  }, [history, historyIndex]);

  const canvasKey = useMemo(() => `canvas-${historyIndex}-${history.length}`, [historyIndex, history.length]);

  const pushHistory = useCallback((next: BrushStroke[]) => {
    const trimmed = history.slice(0, historyIndex + 1);
    trimmed.push(next);
    setHistory(trimmed);
    setHistoryIndex(trimmed.length - 1);
  }, [history, historyIndex]);

  const handleStrokeStart = useCallback(() => {
    setActiveStroke({
      type: brushMode,
      points: [],
      radius: brushSize,
    });
  }, [brushMode, brushSize]);

  const handleStrokePoint = useCallback((x: number, y: number) => {
    setActiveStroke((prev) => {
      if (!prev) return prev;
      return { ...prev, points: [...prev.points, [x, y]] };
    });
  }, []);

  const handleStrokeEnd = useCallback(() => {
    setActiveStroke((prev) => {
      if (!prev) return null;
      if (prev.points.length === 0) return null;
      const next = [...effectiveStrokes, prev];
      pushHistory(next);
      return null;
    });
  }, [effectiveStrokes, pushHistory]);

  const handleUndo = () => {
    if (historyIndex >= 0) setHistoryIndex(historyIndex - 1);
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
  };

  const handleGenerate = async () => {
    if (!state.processingState?.resizedUri || !state.processingState?.maskUri) {
      toast({
        variant: 'destructive',
        title: 'Missing data',
        description: 'Please complete Step 1 first to generate the mask.',
      });
      return;
    }

    // Switch to generating view
    setCurrentView('generating');
    updateState({ isGenerating: true });
    setGenerationProgress(0);
    setCurrentStepLabel('Starting generation...');

    try {
      // Convert brush strokes if any (normalized 0-1)
      const canvasWidth = 400;
      const canvasHeight = 533;
      
      const brushStrokes = effectiveStrokes.length > 0 ? effectiveStrokes.map(stroke => ({
        points: stroke.points.map(([x, y]) => ({ 
          x: x / canvasWidth, 
          y: y / canvasHeight 
        })),
        mode: stroke.type,
        size: Math.round(stroke.radius / 4),
      })) : undefined;

      // Get the URIs from preprocessing (stored in processingState)
      const imageUri = state.processingState?.resizedUri;
      const maskUri = state.processingState?.maskUri;
      
      if (!imageUri || !maskUri) {
        toast({
          variant: 'destructive',
          title: 'Missing preprocessing data',
          description: 'Please complete Step 1 first to generate the image and mask URIs.',
        });
        updateState({ isGenerating: false });
        setCurrentView('refine');
        return;
      }

      // Start the Generation workflow (Step 2) using URIs from preprocessing
      // Pass scaledPoints for SAM3 fidelity analysis on A100
      const { workflowId } = await temporalApi.startGeneration({
        imageUri,
        maskUri,
        brushStrokes,
        gender: state.gender,
        scaledPoints: state.scaledPoints || undefined,
      });

      // Poll for status with step tracking
      let completed = false;
      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const status = await temporalApi.getWorkflowStatus(workflowId);
        
        // Use step-based progress or fallback to status progress
        // Generation steps start at 55% (after mask refinement)
        const stepProgress = getStepProgress(status.currentStep);
        const effectiveProgress = stepProgress > 0 ? stepProgress : (status.progress || 0);
        setGenerationProgress(effectiveProgress);
        
        // Update step label for UI
        setCurrentStepLabel(getStepLabel(status.currentStep));
        console.log('[Generation] Step:', status.currentStep, 'Progress:', effectiveProgress);

        if (status.status === 'COMPLETED' && status.result) {
          completed = true;
          
          // Fetch images from URIs
          const images = await temporalApi.fetchImages({
            fluxResult: status.result.fluxResultUri,
            geminiResult: status.result.geminiResultUri,
            fluxViz: status.result.fluxFidelityVizUri,
            geminiViz: status.result.geminiFidelityVizUri,
          });
          
          // Map Temporal result to StudioState
          let statusValue: 'good' | 'bad' | null = null;
          let metricsData: StudioState['metrics'] = null;

          if (status.result.fluxMetrics) {
            metricsData = {
              precision: status.result.fluxMetrics.precision,
              recall: status.result.fluxMetrics.recall,
              iou: status.result.fluxMetrics.iou,
              growthRatio: status.result.fluxMetrics.growthRatio,
            };
            const isGood = status.result.fluxMetrics.precision >= 0.95 && 
                           status.result.fluxMetrics.recall >= 0.9 && 
                           status.result.fluxMetrics.iou >= 0.85;
            statusValue = isGood ? 'good' : 'bad';
          }

          let metricsGeminiData: StudioState['metricsGemini'] = null;
          if (status.result.geminiMetrics) {
            metricsGeminiData = {
              precision: status.result.geminiMetrics.precision,
              recall: status.result.geminiMetrics.recall,
              iou: status.result.geminiMetrics.iou,
              growthRatio: status.result.geminiMetrics.growthRatio,
            };
          }

          updateState({
            fluxResult: images.fluxResult ? `data:image/png;base64,${images.fluxResult}` : null,
            geminiResult: images.geminiResult ? `data:image/png;base64,${images.geminiResult}` : null,
            fidelityViz: images.fluxViz ? `data:image/png;base64,${images.fluxViz}` : null,
            fidelityVizGemini: images.geminiViz ? `data:image/png;base64,${images.geminiViz}` : null,
            metrics: metricsData,
            metricsGemini: metricsGeminiData,
            status: statusValue,
            isGenerating: false,
          });

          setCurrentView('results');
        } else if (status.status === 'FAILED') {
          throw new Error(status.error?.message || 'Workflow failed');
        } else if (status.status === 'CANCELLED') {
          throw new Error('Workflow was cancelled');
        }
      }

    } catch (error) {
      console.error('Generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate. Please try again.',
      });
      updateState({ isGenerating: false });
      setCurrentView('refine');
    }
  };

  const handleCancel = async () => {
    // Cancel via Temporal if we have a workflow ID
    updateState({ isGenerating: false });
    setCurrentView('refine');
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const baseImage = state.maskOverlay || state.originalImage;
  console.log('[StepRefine] baseImage exists:', !!baseImage, 'maskOverlay:', !!state.maskOverlay, 'originalImage:', !!state.originalImage);

  const StatusBadge = ({ status }: { status: 'good' | 'bad' | null }) => {
    if (!status) return null;
    return status === 'good' ? (
      <div className="flex items-center gap-2 text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Jewelry Preserved
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-4 py-2 rounded-full text-sm font-medium">
        <XCircle className="h-4 w-4" />
        Needs Review
      </div>
    );
  };

  // ========== GENERATING VIEW ==========
  if (currentView === 'generating') {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="border-2 border-dashed border-border/50 p-8 w-full max-w-lg">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Gem className="absolute inset-0 m-auto h-10 w-10 text-primary" />
            </div>
            
            <h3 className="font-display text-xl mb-2 text-foreground">Generating Photoshoot</h3>
            <p className="text-sm font-medium text-primary mb-4">{currentStepLabel}</p>
            
            <div className="w-full max-w-xs h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${generationProgress}%` }} 
              />
            </div>
            <p className="mt-3 text-lg font-mono text-primary">{generationProgress}%</p>

            <Button 
              variant="outline" 
              size="sm" 
              className="mt-6"
              onClick={handleCancel}
            >
              <XOctagon className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ========== RESULTS VIEW ==========
  if (currentView === 'results' && (state.fluxResult || state.geminiResult)) {
    return (
      <div className="h-[calc(100vh-160px)] flex flex-col overflow-hidden">
        {/* Fullscreen Image Dialog */}
        <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-primary/20">
            <div className="relative w-full h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="font-display text-lg">{fullscreenImage?.title}</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fullscreenImage && handleDownload(fullscreenImage.url, `${fullscreenImage.title.toLowerCase().replace(/\s+/g, '_')}.jpg`)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
                {fullscreenImage && (
                  <img 
                    src={fullscreenImage.url} 
                    alt={fullscreenImage.title} 
                    className="max-w-full max-h-[80vh] object-contain rounded-lg"
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Header row with back button, status, title */}
        <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setCurrentView('refine')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Edit Mask
            </Button>
            {state.status && <StatusBadge status={state.status} />}
          </div>
          <h2 className="font-display text-2xl md:text-3xl uppercase tracking-tight">Generated Photoshoot</h2>
          <Button size="default" className="px-6" onClick={handleGenerate}>
            <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
          </Button>
        </div>

        {/* Results content - fills remaining space */}
        <div className="flex-1 min-h-0">
          <Tabs defaultValue="standard" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 shrink-0">
              <TabsTrigger value="standard">Standard</TabsTrigger>
              <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
            </TabsList>

            <TabsContent value="standard" className="mt-4 flex-1 min-h-0">
              {state.fluxResult && (
                <div className="grid lg:grid-cols-3 gap-4 h-full">
                  {/* Main image - constrained height */}
                  <div className="lg:col-span-2 h-full min-h-0">
                    <div 
                      className="h-full overflow-hidden border border-border cursor-pointer relative flex items-center justify-center bg-muted/20"
                      onClick={() => setFullscreenImage({ url: state.fluxResult!, title: 'Standard Result' })}
                    >
                      <img src={state.fluxResult} alt="Standard result" className="max-w-full max-h-full object-contain" />
                      {/* Top-right corner buttons */}
                      <div className="absolute top-3 right-3 z-10 flex gap-2">
                        <button
                          className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                          onClick={(e) => { e.stopPropagation(); setFullscreenImage({ url: state.fluxResult!, title: 'Standard Result' }); }}
                          title="Fullscreen"
                        >
                          <Expand className="h-4 w-4" />
                        </button>
                        <button
                          className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleDownload(state.fluxResult!, 'standard_result.jpg'); }}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Side panel - scrollable if needed */}
                  <div className="space-y-3 overflow-y-auto max-h-full">
                    {state.fidelityViz && (
                      <div className="border border-border p-4 space-y-3">
                        <h4 className="font-display text-lg font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
                          <Gem className="h-5 w-5" /> Jewelry Accuracy Visualization
                        </h4>
                        <div className="overflow-hidden border border-border/50">
                          <img src={state.fidelityViz} alt="Jewelry Accuracy Visualization" className="w-full h-auto" />
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500" />
                            <span>Original</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500" />
                            <span>Extended</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-red-500" />
                            <span>Shrunk</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {state.metrics && (
                      <div className="border border-border p-4 space-y-3">
                        <h4 className="font-display text-lg font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" /> Quality Metrics
                        </h4>
                        <div className="grid grid-cols-2 gap-1.5">
                          <MetricCard label="Precision" value={state.metrics.precision} />
                          <MetricCard label="Recall" value={state.metrics.recall} />
                          <MetricCard label="IoU" value={state.metrics.iou} />
                          <MetricCard label="Growth" value={state.metrics.growthRatio} format="ratio" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="enhanced" className="mt-4 flex-1 min-h-0">
              {(state.geminiResult || state.fluxResult) && (
                <div className="grid lg:grid-cols-3 gap-4 h-full">
                  {/* Main image - constrained height */}
                  <div className="lg:col-span-2 h-full min-h-0">
                    <div 
                      className="h-full overflow-hidden border border-border cursor-pointer relative flex items-center justify-center bg-muted/20"
                      onClick={() => setFullscreenImage({ url: state.geminiResult || state.fluxResult!, title: 'Enhanced Result' })}
                    >
                      <img src={state.geminiResult || state.fluxResult!} alt="Enhanced result" className="max-w-full max-h-full object-contain" />
                      {/* Top-right corner buttons */}
                      <div className="absolute top-3 right-3 z-10 flex gap-2">
                        <button
                          className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                          onClick={(e) => { e.stopPropagation(); setFullscreenImage({ url: state.geminiResult || state.fluxResult!, title: 'Enhanced Result' }); }}
                          title="Fullscreen"
                        >
                          <Expand className="h-4 w-4" />
                        </button>
                        <button
                          className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleDownload(state.geminiResult || state.fluxResult!, 'enhanced_result.jpg'); }}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Side panel - scrollable if needed */}
                  <div className="space-y-3 overflow-y-auto max-h-full">
                    {state.fidelityVizGemini && (
                      <div className="border border-border p-4 space-y-3">
                        <h4 className="font-display text-lg font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
                          <Gem className="h-5 w-5" /> Jewelry Accuracy Visualization
                        </h4>
                        <div className="overflow-hidden border border-border/50">
                          <img src={state.fidelityVizGemini} alt="Jewelry Accuracy Visualization" className="w-full h-auto" />
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500" />
                            <span>Original</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500" />
                            <span>Extended</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-red-500" />
                            <span>Shrunk</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {state.metricsGemini && (
                      <div className="border border-border p-4 space-y-3">
                        <h4 className="font-display text-lg font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" /> Quality Metrics
                        </h4>
                        <div className="grid grid-cols-2 gap-1.5">
                          <MetricCard label="Precision" value={state.metricsGemini.precision} />
                          <MetricCard label="Recall" value={state.metricsGemini.recall} />
                          <MetricCard label="IoU" value={state.metricsGemini.iou} />
                          <MetricCard label="Growth" value={state.metricsGemini.growthRatio} format="ratio" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // ========== REFINE VIEW (Default) ==========
  return (
    <div className="space-y-8">
      {/* Fullscreen Image Dialog */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-border/20">
          <div className="relative w-full h-full">
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {fullscreenImage && (
                <img 
                  src={fullscreenImage.url} 
                  alt={fullscreenImage.title} 
                  className="max-w-full max-h-[85vh] object-contain"
                />
              )}
            </div>
            {/* Download button in top-right corner */}
            <button
              className="absolute top-4 right-12 z-20 w-10 h-10 rounded-lg bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors shadow-lg"
              onClick={() => fullscreenImage && handleDownload(fullscreenImage.url, `${fullscreenImage.title.toLowerCase().replace(/\s+/g, '_')}.jpg`)}
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Grid: Mask Editor + Controls */}
      <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Left: Mask Canvas */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <span className="marta-label mb-3 block">Step 2</span>
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">Refine & Generate</h2>
            <p className="text-muted-foreground mt-2">Draw to Edit the mask if needed, then generate your photoshoot</p>
          </div>
          
          <div className="space-y-4">
            <Tabs defaultValue="overlay">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overlay">Overlay View</TabsTrigger>
                <TabsTrigger value="binary">Binary View</TabsTrigger>
              </TabsList>

              <TabsContent value="overlay" className="mt-4">
                <div className="flex justify-center">
                  <div className="relative inline-block group">
                    {baseImage ? (
                      <>
                        <MaskCanvas
                          key={canvasKey}
                          image={baseImage}
                          brushColor={brushMode === 'add' ? '#00FF00' : '#000000'}
                          brushSize={brushSize}
                          mode="brush"
                          canvasSize={400}
                          initialStrokes={effectiveStrokes}
                          activeStroke={activeStroke}
                          onBrushStrokeStart={handleStrokeStart}
                          onBrushStrokePoint={handleStrokePoint}
                          onBrushStrokeEnd={handleStrokeEnd}
                        />
                        <button
                          className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                          onClick={() => setFullscreenImage({ url: baseImage, title: 'Mask Overlay' })}
                          title="Fullscreen"
                        >
                          <Expand className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="aspect-[3/4] w-[300px] bg-muted flex items-center justify-center rounded-lg">
                        <p className="text-muted-foreground">No mask generated yet</p>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  <span className="text-green-500 font-semibold">Green</span> = Preserved • <span className="font-semibold">Black</span> = AI-generated
                </p>
              </TabsContent>

              <TabsContent value="binary" className="mt-4">
                <div className="flex justify-center">
                  <div className="relative inline-block group">
                    {state.maskBinary ? (
                      <>
                        <MaskCanvas
                          key={`binary-${canvasKey}`}
                          image={state.maskBinary}
                          brushColor={brushMode === 'add' ? '#FFFFFF' : '#000000'}
                          brushSize={brushSize}
                          mode="brush"
                          canvasSize={400}
                          initialStrokes={effectiveStrokes}
                          activeStroke={activeStroke}
                          onBrushStrokeStart={handleStrokeStart}
                          onBrushStrokePoint={handleStrokePoint}
                          onBrushStrokeEnd={handleStrokeEnd}
                        />
                        <button
                          className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                          onClick={() => setFullscreenImage({ url: state.maskBinary!, title: 'Binary Mask' })}
                          title="Fullscreen"
                        >
                          <Expand className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="aspect-[3/4] w-[300px] bg-muted flex items-center justify-center rounded-lg">
                        <p className="text-muted-foreground">No mask generated yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex < 0}>
                <Undo className="h-4 w-4 mr-1" /> Undo
              </Button>
              <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                Redo <Redo className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button 
                className="flex-1 h-12 text-lg font-semibold"
                onClick={handleGenerate} 
                disabled={!state.originalImage}
              >
                <Gem className="h-5 w-5 mr-2" />
                Generate Photoshoot
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Brush Controls */}
        <div className="space-y-6">
          <div>
            <span className="marta-label mb-3 block">Tools</span>
            <h3 className="font-display text-2xl uppercase tracking-tight">Controls</h3>
          </div>
          
          <div className="space-y-5">
            <div className="space-y-3">
              <label className="text-sm font-medium">Brush Type</label>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={brushMode === 'add' ? 'default' : 'outline'}
                  onClick={() => setBrushMode('add')}
                  className={`justify-start h-11 ${brushMode === 'add' ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}`}
                >
                  <div className="h-4 w-4 rounded-full bg-green-500 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Add to Mask</p>
                  </div>
                </Button>
                <Button
                  variant={brushMode === 'remove' ? 'default' : 'outline'}
                  onClick={() => setBrushMode('remove')}
                  className={`justify-start h-11 ${brushMode === 'remove' ? 'bg-gray-800 hover:bg-gray-900 border-gray-800' : ''}`}
                >
                  <div className="h-4 w-4 rounded-full bg-black border-2 border-white/30 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Remove from Mask</p>
                  </div>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Brush Size</label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{brushSize}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-primary h-2 rounded-lg appearance-none bg-muted cursor-pointer"
              />
            </div>

            <div className="border border-border/20 p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Tip:</strong> Paint green over jewelry areas you want to preserve.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, format = 'percent' }: { label: string; value: number; format?: 'percent' | 'ratio' }) {
  const displayValue = format === 'ratio' ? `${value.toFixed(2)}x` : `${(value * 100).toFixed(1)}%`;
  const isGood = format === 'ratio' ? value >= 0.9 && value <= 1.1 : value >= 0.9;
  
  return (
    <div className="p-2 rounded-lg bg-muted/50 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${isGood ? 'text-green-500' : 'text-foreground'}`}>{displayValue}</p>
    </div>
  );
}
