import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Paintbrush, 
  Lightbulb, 
  Loader2, 
  ArrowLeft, 
  Undo, 
  Redo, 
  Download,
  CheckCircle2,
  XCircle,
  BarChart3,
  Expand,
  Play,
  RefreshCw,
  Gem,
} from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { a100Api } from '@/lib/a100-api';

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

  // Generate state
  const [progress, setProgress] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; title: string } | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();

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
    if (!state.originalImage || !state.maskBinary) {
      toast({
        variant: 'destructive',
        title: 'Missing data',
        description: 'Please complete the previous steps first.',
      });
      return;
    }

    // Switch to generating view
    setCurrentView('generating');
    setProgress(0);
    updateState({ isGenerating: true });

    progressInterval.current = setInterval(() => {
      setProgress(prev => Math.min(prev + 1, 95));
    }, 600);

    try {
      // If there are brush strokes, apply them first
      let currentMask = state.editedMask || state.maskBinary;
      
      if (effectiveStrokes.length > 0) {
        let originalBase64 = state.originalImage;
        if (originalBase64.includes(',')) originalBase64 = originalBase64.split(',')[1];

        let maskBase64 = currentMask;
        if (maskBase64.includes(',')) maskBase64 = maskBase64.split(',')[1];

        const refineResponse = await a100Api.refineMask({
          original_image_base64: originalBase64,
          current_mask_base64: maskBase64,
          brush_strokes: effectiveStrokes,
        });

        if (refineResponse) {
          currentMask = `data:image/png;base64,${refineResponse.mask_base64}`;
          updateState({
            maskBinary: currentMask,
            maskOverlay: `data:image/jpeg;base64,${refineResponse.mask_overlay_base64}`,
            editedMask: currentMask,
          });
        }
      }

      // Now generate
      let imageBase64 = state.originalImage;
      if (imageBase64.includes(',')) imageBase64 = imageBase64.split(',')[1];

      let maskBase64 = currentMask;
      if (maskBase64.includes(',')) maskBase64 = maskBase64.split(',')[1];

      let originalMaskBase64: string | undefined;
      if (state.originalMask) {
        originalMaskBase64 = state.originalMask.includes(',') ? state.originalMask.split(',')[1] : state.originalMask;
      }

      const response = await a100Api.generate({
        image_base64: imageBase64,
        mask_base64: maskBase64,
        original_mask_base64: originalMaskBase64,
        gender: state.gender,
        use_gemini: true,
        scaled_points: state.scaledPoints || undefined,
      });

      if (!response) throw new Error('Generation failed');

      const safeNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      
      let status: 'good' | 'bad' | null = null;
      let metricsData: StudioState['metrics'] = null;
      const rawMetrics = (response as any).metrics as any;
      if (rawMetrics && typeof rawMetrics === 'object') {
        const precision = safeNumber(rawMetrics.precision);
        const recall = safeNumber(rawMetrics.recall);
        const iou = safeNumber(rawMetrics.iou);
        const growthRatio = safeNumber(rawMetrics.growth_ratio ?? rawMetrics.growthRatio);
        if (precision !== null && recall !== null && iou !== null && growthRatio !== null) {
          metricsData = { precision, recall, iou, growthRatio };
          const isGood = precision >= 0.95 && recall >= 0.9 && iou >= 0.85;
          status = isGood ? 'good' : 'bad';
        }
      }

      let metricsGeminiData: StudioState['metricsGemini'] = null;
      const rawMetricsGemini = (response as any).metrics_gemini as any;
      if (rawMetricsGemini && typeof rawMetricsGemini === 'object') {
        const precision = safeNumber(rawMetricsGemini.precision);
        const recall = safeNumber(rawMetricsGemini.recall);
        const iou = safeNumber(rawMetricsGemini.iou);
        const growthRatio = safeNumber(rawMetricsGemini.growth_ratio ?? rawMetricsGemini.growthRatio);
        if (precision !== null && recall !== null && iou !== null && growthRatio !== null) {
          metricsGeminiData = { precision, recall, iou, growthRatio };
        }
      }

      const fidelityVizBase64 = (response as any).fidelity_viz_base64 ?? null;
      const fidelityVizDataUrl = fidelityVizBase64 ? `data:image/jpeg;base64,${fidelityVizBase64}` : null;
      
      const fidelityVizGeminiBase64 = (response as any).fidelity_viz_gemini_base64 ?? null;
      const fidelityVizGeminiDataUrl = fidelityVizGeminiBase64 ? `data:image/jpeg;base64,${fidelityVizGeminiBase64}` : null;

      const generatedImageUrl = `data:image/jpeg;base64,${response.result_base64}`;
      const geminiImageUrl = response.result_gemini_base64 ? `data:image/jpeg;base64,${response.result_gemini_base64}` : null;

      setProgress(100);
      
      updateState({
        fluxResult: generatedImageUrl,
        geminiResult: geminiImageUrl,
        fidelityViz: fidelityVizDataUrl,
        fidelityVizGemini: fidelityVizGeminiDataUrl,
        metrics: metricsData,
        metricsGemini: metricsGeminiData,
        status,
        isGenerating: false,
        sessionId: response.session_id,
      });

      // Switch to results view
      setCurrentView('results');

    } catch (error) {
      console.error('Generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate. Please try again.',
      });
      updateState({ isGenerating: false });
      setCurrentView('refine');
    } finally {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }
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
        <Card className="border-border/30 w-full max-w-md">
          <CardContent className="pt-10 pb-10">
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-8">
                <div className="w-28 h-28 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Gem className="absolute inset-0 m-auto h-12 w-12 text-primary" />
              </div>
              <h3 className="font-display text-2xl mb-2">Generating Photoshoot</h3>
              <p className="text-muted-foreground mb-6">Creating your professional jewelry photo...</p>
              <div className="w-full max-w-xs h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
              <p className="mt-3 text-lg font-mono text-primary">{progress}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========== RESULTS VIEW ==========
  if (currentView === 'results' && (state.fluxResult || state.geminiResult)) {
    return (
      <div className="space-y-6">
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

        {/* Header with status and regenerate */}
        <Card className="border-border/30">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => setCurrentView('refine')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Edit Mask
                </Button>
                {state.status && <StatusBadge status={state.status} />}
              </div>
              <Button 
                onClick={handleGenerate}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <Gem className="h-5 w-5 text-primary" />
              Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="standard" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="standard">Standard</TabsTrigger>
                <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
              </TabsList>

              <TabsContent value="standard" className="mt-6">
                {state.fluxResult && (
                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      <div 
                        className="rounded-xl overflow-hidden border border-border shadow-lg cursor-pointer group relative"
                        onClick={() => setFullscreenImage({ url: state.fluxResult!, title: 'Standard Result' })}
                      >
                        <img src={state.fluxResult} alt="Standard result" className="w-full h-auto" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Expand className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <Button size="lg" className="w-full" onClick={() => handleDownload(state.fluxResult!, 'standard_result.jpg')}>
                        <Download className="h-4 w-4 mr-2" /> Download Standard
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {state.fidelityViz && (
                        <Card className="bg-primary/5 border-primary/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <Gem className="h-4 w-4 text-primary" /> Accuracy
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-lg overflow-hidden border-2 border-primary/20">
                              <img src={state.fidelityViz} alt="Accuracy" className="w-full h-auto" />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {state.metrics && (
                        <Card className="bg-card/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-primary" /> Metrics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-2">
                              <MetricCard label="Precision" value={state.metrics.precision} />
                              <MetricCard label="Recall" value={state.metrics.recall} />
                              <MetricCard label="IoU" value={state.metrics.iou} />
                              <MetricCard label="Growth" value={state.metrics.growthRatio} format="ratio" />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="enhanced" className="mt-6">
                {(state.geminiResult || state.fluxResult) && (
                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      <div 
                        className="rounded-xl overflow-hidden border border-border shadow-lg cursor-pointer group relative"
                        onClick={() => setFullscreenImage({ url: state.geminiResult || state.fluxResult!, title: 'Enhanced Result' })}
                      >
                        <img src={state.geminiResult || state.fluxResult!} alt="Enhanced result" className="w-full h-auto" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Expand className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <Button size="lg" className="w-full" onClick={() => handleDownload(state.geminiResult || state.fluxResult!, 'enhanced_result.jpg')}>
                        <Download className="h-4 w-4 mr-2" /> Download Enhanced
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {state.fidelityVizGemini && (
                        <Card className="bg-primary/5 border-primary/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <Gem className="h-4 w-4 text-primary" /> Accuracy
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-lg overflow-hidden border-2 border-primary/20">
                              <img src={state.fidelityVizGemini} alt="Accuracy" className="w-full h-auto" />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {state.metricsGemini && (
                        <Card className="bg-card/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-primary" /> Metrics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-2">
                              <MetricCard label="Precision" value={state.metricsGemini.precision} />
                              <MetricCard label="Recall" value={state.metricsGemini.recall} />
                              <MetricCard label="IoU" value={state.metricsGemini.iou} />
                              <MetricCard label="Growth" value={state.metricsGemini.growthRatio} format="ratio" />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========== REFINE VIEW (Default) ==========
  return (
    <div className="space-y-8">
      {/* Fullscreen Image Dialog */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-border/20">
          <div className="relative w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/20">
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
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
            </div>
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
            <p className="text-muted-foreground mt-2">Paint to adjust mask, then generate your photoshoot</p>
          </div>
          
          <div className="space-y-4">
            <Tabs defaultValue="overlay">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overlay">Overlay View</TabsTrigger>
                <TabsTrigger value="binary">Binary Mask</TabsTrigger>
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
                disabled={!state.maskBinary}
              >
                <Play className="h-5 w-5 mr-2" />
                Generate
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
