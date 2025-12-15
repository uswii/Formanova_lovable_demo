import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  Download,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  BarChart3,
  Diamond,
  User,
} from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { a100Api } from '@/lib/a100-api';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onBack: () => void;
}

export function StepGenerate({ state, updateState, onBack }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!state.originalImage || !state.maskBinary) {
      toast({
        variant: 'destructive',
        title: 'Missing data',
        description: 'Please complete the previous steps first.',
      });
      return;
    }

    setIsGenerating(true);
    updateState({ isGenerating: true });

    try {
      let imageBase64 = state.originalImage;
      if (imageBase64.includes(',')) imageBase64 = imageBase64.split(',')[1];

      let maskBase64 = state.editedMask || state.maskBinary;
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

      let status: 'good' | 'bad' | null = null;
      let metricsData: StudioState['metrics'] = null;

      const rawMetrics = (response as any).metrics as any;
      const safeNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

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

      const fidelityVizBase64 =
        (response as any).fidelity_viz_base64 ?? (response as any).fidelity_viz ?? null;
      const fidelityVizDataUrl = fidelityVizBase64
        ? `data:image/jpeg;base64,${fidelityVizBase64}`
        : null;

      updateState({
        fluxResult: `data:image/jpeg;base64,${response.result_base64}`,
        geminiResult: response.result_gemini_base64 ? `data:image/jpeg;base64,${response.result_gemini_base64}` : null,
        fidelityViz: fidelityVizDataUrl,
        metrics: metricsData,
        status,
        isGenerating: false,
        sessionId: response.session_id,
      });

      toast({
        title: 'Generation complete!',
        description: 'Your photoshoot has been generated successfully.',
      });
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate photoshoot. Please try again.',
      });
      updateState({ isGenerating: false });
    } finally {
      setIsGenerating(false);
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

  const StatusBadge = ({ status }: { status: 'good' | 'bad' | null }) => {
    if (!status) return null;

    return status === 'good' ? (
      <div className="flex items-center gap-2 text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Jewelry Preserved Perfectly
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-4 py-2 rounded-full text-sm font-medium">
        <XCircle className="h-4 w-4" />
        Needs Review
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="flex-1 w-full lg:w-auto">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/20">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block text-muted-foreground">Select Gender</label>
                  <Select value={state.gender} onValueChange={(v) => updateState({ gender: v as 'female' | 'male' })}>
                    <SelectTrigger className="w-full bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      <SelectItem value="female">Female Model</SelectItem>
                      <SelectItem value="male">Male Model</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || !state.maskBinary}
              className="h-14 px-8 text-lg font-semibold formanova-glow"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-3" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-3" />
                  Generate Photoshoot
                </>
              )}
            </Button>

            {state.status && <StatusBadge status={state.status} />}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {(state.fluxResult || state.geminiResult) ? (
            <Card className="bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Diamond className="h-5 w-5 text-primary" />
                  Your Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="standard" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="standard">Standard</TabsTrigger>
                    <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
                  </TabsList>

                  <TabsContent value="standard" className="mt-4 space-y-4">
                    {state.fluxResult && (
                      <>
                        <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
                          <img src={state.fluxResult} alt="Standard result" className="w-full h-auto" />
                        </div>
                        <Button
                          size="lg"
                          className="w-full"
                          onClick={() => handleDownload(state.fluxResult!, 'standard_result.jpg')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Standard
                        </Button>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="enhanced" className="mt-4 space-y-4">
                    {(state.geminiResult || state.fluxResult) && (
                      <>
                        <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
                          <img
                            src={state.geminiResult || state.fluxResult!}
                            alt="Enhanced result"
                            className="w-full h-auto"
                          />
                        </div>
                        <Button
                          size="lg"
                          className="w-full"
                          onClick={() => handleDownload(state.geminiResult || state.fluxResult!, 'enhanced_result.jpg')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Enhanced
                        </Button>
                      </>
                    )}
                  </TabsContent>
                </Tabs>

                {(state.geminiResult || state.fluxResult) && state.originalImage && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    <h4 className="font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Before / After Comparison
                    </h4>
                    <BeforeAfterSlider before={state.originalImage} after={state.geminiResult || state.fluxResult!} />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/50 backdrop-blur min-h-[400px] flex items-center justify-center">
              <div className="text-center space-y-6 p-8">
                <div className="relative mx-auto w-32 h-32">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse" />
                  <div className="absolute inset-4 rounded-full border-2 border-primary/30 animate-pulse animation-delay-200" />
                  <div className="absolute inset-8 rounded-full border-2 border-primary/40 animate-pulse animation-delay-300" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Diamond className="h-12 w-12 text-primary animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display text-xl mb-2">Ready to Generate</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    Select your model preference and click Generate to create your professional photoshoot
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Refine Mask
          </Button>
        </div>

        <div className="space-y-4">
          {/* Accuracy Visualization - always show section */}
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Jewelry Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {state.fidelityViz ? (
                <div className="space-y-3">
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img src={state.fidelityViz} alt="Accuracy visualization" className="w-full h-auto" />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-green-500/20">
                      <div className="h-3 w-3 rounded bg-green-500" />
                      <span>Preserved</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-blue-500/20">
                      <div className="h-3 w-3 rounded bg-blue-500" />
                      <span>AI Expansion</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {state.scaledPoints ? 'Generate results to see accuracy visualization' : 'Create a mask (Upload step) to enable accuracy visualization'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quality Metrics - always show section */}
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Quality Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {state.metrics ? (
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard label="Precision" value={state.metrics.precision} isMain />
                  <MetricCard label="Recall" value={state.metrics.recall} />
                  <MetricCard label="IoU Score" value={state.metrics.iou} />
                  <MetricCard label="Growth" value={state.metrics.growthRatio} format="ratio" />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {state.scaledPoints
                      ? 'Metrics will appear after generation (if fidelity analysis succeeds).'
                      : 'Metrics require generating a mask from the Upload step.'}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Precision" value={0} placeholder />
                    <MetricCard label="Recall" value={0} placeholder />
                    <MetricCard label="IoU Score" value={0} placeholder />
                    <MetricCard label="Growth" value={0} format="ratio" placeholder />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!state.fluxResult && (
            <Alert className="border-primary/20 bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Your jewelry will be placed on a professional model with studio-quality lighting and backgrounds.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  isMain = false,
  format = 'percent',
  placeholder = false,
}: {
  label: string;
  value: number;
  isMain?: boolean;
  format?: 'percent' | 'ratio';
  placeholder?: boolean;
}) {
  const displayValue = placeholder ? '—' : format === 'ratio' ? `${value.toFixed(2)}x` : `${(value * 100).toFixed(1)}%`;
  const isGood = !placeholder && (format === 'percent' ? value >= 0.96 : value >= 0.95 && value <= 1.1);

  return (
    <div className={`p-3 rounded-lg border transition-all ${isMain && !placeholder ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${placeholder ? 'text-muted-foreground/50' : isGood ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>{displayValue}</p>
    </div>
  );
}
