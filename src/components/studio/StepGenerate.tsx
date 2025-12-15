import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  User
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
      // Extract base64 from data URLs
      let imageBase64 = state.originalImage;
      if (imageBase64.includes(',')) {
        imageBase64 = imageBase64.split(',')[1];
      }
      
      let maskBase64 = state.editedMask || state.maskBinary;
      if (maskBase64.includes(',')) {
        maskBase64 = maskBase64.split(',')[1];
      }
      
      const response = await a100Api.generate({
        image_base64: imageBase64,
        mask_base64: maskBase64,
        gender: state.gender,
        use_gemini: true,
      });
      
      if (response) {
        // Determine status based on metrics
        let status: 'good' | 'bad' | null = null;
        let metricsData = null;
        if (response.metrics) {
          metricsData = {
            precision: response.metrics.precision,
            recall: response.metrics.recall,
            iou: response.metrics.iou,
            growthRatio: response.metrics.growth_ratio,
          };
          const isGood = metricsData.precision >= 0.95 && 
                         metricsData.recall >= 0.90 && 
                         metricsData.iou >= 0.85;
          status = isGood ? 'good' : 'bad';
        }
        
        updateState({
          fluxResult: `data:image/jpeg;base64,${response.result_base64}`,
          geminiResult: response.result_gemini_base64 
            ? `data:image/jpeg;base64,${response.result_gemini_base64}` 
            : null,
          fidelityViz: response.fidelity_viz_base64
            ? `data:image/jpeg;base64,${response.fidelity_viz_base64}` 
            : null,
          metrics: metricsData,
          status: status,
          isGenerating: false,
          sessionId: response.session_id,
        });
        
        toast({
          title: 'Generation complete!',
          description: 'Your photoshoot has been generated successfully.',
        });
      } else {
        throw new Error('Generation failed');
      }
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
      {/* Top Section: Controls */}
      <Card className="bg-card/50 backdrop-blur border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* Gender Selection */}
            <div className="flex-1 w-full lg:w-auto">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/20">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block text-muted-foreground">Select Model</label>
                  <Select 
                    value={state.gender} 
                    onValueChange={(v) => updateState({ gender: v as 'female' | 'male' })}
                  >
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

            {/* Generate Button */}
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

            {/* Status Badge */}
            {state.status && <StatusBadge status={state.status} />}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Results Area - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Results or Placeholder */}
          {(state.fluxResult || state.geminiResult) ? (
            <Card className="bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Diamond className="h-5 w-5 text-primary" />
                  Your Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="enhanced" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="enhanced">Enhanced Result</TabsTrigger>
                    <TabsTrigger value="basic">Standard Result</TabsTrigger>
                  </TabsList>
                  
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
                          Download Enhanced Result
                        </Button>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="basic" className="mt-4 space-y-4">
                    {state.fluxResult && (
                      <>
                        <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
                          <img 
                            src={state.fluxResult} 
                            alt="Standard result"
                            className="w-full h-auto"
                          />
                        </div>
                        <Button 
                          variant="outline"
                          size="lg"
                          className="w-full"
                          onClick={() => handleDownload(state.fluxResult!, 'standard_result.jpg')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Standard Result
                        </Button>
                      </>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Before/After Comparison */}
                {(state.geminiResult || state.fluxResult) && state.originalImage && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    <h4 className="font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Before / After Comparison
                    </h4>
                    <BeforeAfterSlider 
                      before={state.originalImage}
                      after={state.geminiResult || state.fluxResult!}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Placeholder with Animation */
            <Card className="bg-card/50 backdrop-blur min-h-[400px] flex items-center justify-center">
              <div className="text-center space-y-6 p-8">
                {/* Animated jewelry icon */}
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

          {/* Navigation */}
          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Refine Mask
          </Button>
        </div>

        {/* Metrics Panel - 1 column */}
        <div className="space-y-4">
          {/* Fidelity Visualization */}
          {state.fidelityViz && (
            <Accordion type="single" collapsible defaultValue="fidelity">
              <AccordionItem value="fidelity" className="border rounded-xl bg-card/50 backdrop-blur overflow-hidden">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <span className="flex items-center gap-2 text-sm">
                    <Info className="h-4 w-4 text-primary" />
                    Accuracy Visualization
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img 
                        src={state.fidelityViz} 
                        alt="Fidelity visualization"
                        className="w-full h-auto"
                      />
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
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Quality Metrics */}
          {state.metrics && (
            <Accordion type="single" collapsible defaultValue="metrics">
              <AccordionItem value="metrics" className="border rounded-xl bg-card/50 backdrop-blur overflow-hidden">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <span className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Quality Metrics
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Precision" value={state.metrics.precision} isMain />
                    <MetricCard label="Recall" value={state.metrics.recall} />
                    <MetricCard label="IoU Score" value={state.metrics.iou} />
                    <MetricCard label="Growth" value={state.metrics.growthRatio} format="ratio" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Tips when no results */}
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
  format = 'percent'
}: { 
  label: string; 
  value: number; 
  isMain?: boolean;
  format?: 'percent' | 'ratio';
}) {
  const displayValue = format === 'ratio' 
    ? `${value.toFixed(2)}x`
    : `${(value * 100).toFixed(1)}%`;
  
  const isGood = format === 'percent' ? value >= 0.96 : value >= 0.95 && value <= 1.1;
  
  return (
    <div className={`p-3 rounded-lg border transition-all ${isMain ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${isGood ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
        {displayValue}
      </p>
    </div>
  );
}