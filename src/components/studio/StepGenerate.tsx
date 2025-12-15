import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  BarChart3
} from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onBack: () => void;
}

export function StepGenerate({ state, updateState, onBack }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    updateState({ isGenerating: true });
    
    // TODO: Call API endpoint /api/generate
    // For now, simulate with a delay
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Mock response - in production, this comes from your A100 server
    updateState({
      fluxResult: state.originalImage, // Placeholder
      geminiResult: state.originalImage, // Placeholder
      fidelityViz: state.originalImage, // Placeholder
      metrics: {
        precision: 0.978,
        recall: 0.965,
        iou: 0.944,
        growthRatio: 1.023,
      },
      status: 'good',
      isGenerating: false,
    });
    
    setIsGenerating(false);
    toast({
      title: 'Generation complete!',
      description: 'Your photoshoot has been generated successfully.',
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

  const StatusBadge = ({ status }: { status: 'good' | 'bad' | null }) => {
    if (!status) return null;
    
    return status === 'good' ? (
      <div className="flex items-center gap-2 text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Good - Jewelry Preserved
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-full text-sm font-medium">
        <XCircle className="h-4 w-4" />
        Needs Review
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <Card className="lg:col-span-2 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Step 3: Generate Photoshoot
          </CardTitle>
          <CardDescription>
            Generate professional photoshoots with your jewelry
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gender Selection & Generate Button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Model Gender</label>
              <Select 
                value={state.gender} 
                onValueChange={(v) => updateState({ gender: v as 'female' | 'male' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || !state.maskOverlay}
                className="w-full sm:w-auto"
              >
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-5 w-5 mr-2" />
                )}
                Generate Photoshoot
              </Button>
            </div>
          </div>

          {/* Results Tabs */}
          {(state.fluxResult || state.geminiResult) && (
            <Tabs defaultValue="enhanced" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic (Flux)</TabsTrigger>
                <TabsTrigger value="enhanced">Enhanced (Gemini)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="mt-4 space-y-4">
                {state.fluxResult && (
                  <>
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img 
                        src={state.fluxResult} 
                        alt="Flux result"
                        className="w-full h-auto"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleDownload(state.fluxResult!, 'flux_result.jpg')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Basic Result
                    </Button>
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="enhanced" className="mt-4 space-y-4">
                {state.geminiResult && (
                  <>
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img 
                        src={state.geminiResult} 
                        alt="Gemini result"
                        className="w-full h-auto"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleDownload(state.geminiResult!, 'gemini_result.jpg')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Enhanced Result
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Before/After Comparison */}
          {state.geminiResult && state.originalImage && (
            <div className="space-y-2">
              <h4 className="font-medium">Before / After Comparison</h4>
              <BeforeAfterSlider 
                before={state.originalImage}
                after={state.geminiResult}
              />
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Refine
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Panel */}
      <div className="space-y-6">
        {/* Status */}
        {state.status && (
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">Generation Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBadge status={state.status} />
            </CardContent>
          </Card>
        )}

        {/* Fidelity Visualization Accordion */}
        {state.fidelityViz && (
          <Accordion type="single" collapsible defaultValue="fidelity">
            <AccordionItem value="fidelity" className="border rounded-lg bg-card/50 backdrop-blur">
              <AccordionTrigger className="px-4">
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Jewelry Accuracy Visualization
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <Alert className="border-muted">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      This visualization shows how well your jewelry was preserved:
                    </AlertDescription>
                  </Alert>
                  
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img 
                      src={state.fidelityViz} 
                      alt="Fidelity visualization"
                      className="w-full h-auto"
                    />
                  </div>
                  
                  {/* Legend */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Legend:</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-green-500" />
                        <span>Preserved (Correct)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-blue-500" />
                        <span>AI Expansion</span>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Quality Metrics Accordion */}
        {state.metrics && (
          <Accordion type="single" collapsible>
            <AccordionItem value="metrics" className="border rounded-lg bg-card/50 backdrop-blur">
              <AccordionTrigger className="px-4">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Quality Metrics
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard 
                      label="Precision" 
                      value={state.metrics.precision}
                      isMain={true}
                    />
                    <MetricCard 
                      label="Recall" 
                      value={state.metrics.recall}
                    />
                    <MetricCard 
                      label="IoU (Jaccard)" 
                      value={state.metrics.iou}
                    />
                    <MetricCard 
                      label="Growth Ratio" 
                      value={state.metrics.growthRatio}
                      format="ratio"
                    />
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Precision ≥96% indicates excellent jewelry preservation. 
                    Growth ratio shows mask expansion/contraction.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
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
    ? `${value.toFixed(3)}x`
    : `${(value * 100).toFixed(1)}%`;
  
  const isGood = format === 'percent' ? value >= 0.96 : value >= 0.95 && value <= 1.1;
  
  return (
    <div className={`p-3 rounded-lg border ${isMain ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${isGood ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
        {displayValue}
      </p>
    </div>
  );
}
