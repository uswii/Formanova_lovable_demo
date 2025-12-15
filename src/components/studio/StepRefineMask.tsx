import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Paintbrush, Lightbulb, Loader2, ArrowLeft, ArrowRight, Undo, Redo, Sparkles } from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepRefineMask({ state, updateState, onNext, onBack }: Props) {
  const [brushColor, setBrushColor] = useState<'green' | 'black'>('green');
  const [brushSize, setBrushSize] = useState(30);
  const [isApplying, setIsApplying] = useState(false);
  const [canvasData, setCanvasData] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { toast } = useToast();

  const handleApplyEdits = async () => {
    if (!canvasData) {
      onNext();
      return;
    }

    setIsApplying(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    updateState({
      editedMask: canvasData,
    });
    
    setIsApplying(false);
    toast({
      title: 'Mask edits applied',
      description: 'Your refinements have been saved.',
    });
    onNext();
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCanvasData(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCanvasData(history[historyIndex + 1]);
    }
  };

  const handleCanvasChange = (data: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(data);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCanvasData(data);
  };

  const baseImage = state.maskOverlay || state.originalImage;

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <Card className="bg-card/50 backdrop-blur border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Brush Type Selection */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Brush:</span>
              <div className="flex gap-2">
                <Button
                  variant={brushColor === 'green' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrushColor('green')}
                  className={brushColor === 'green' ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}
                >
                  <div className="h-3 w-3 rounded-full bg-green-500 mr-2" />
                  Add Area
                </Button>
                <Button
                  variant={brushColor === 'black' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrushColor('black')}
                  className={brushColor === 'black' ? 'bg-gray-800 hover:bg-gray-900 border-gray-800' : ''}
                >
                  <div className="h-3 w-3 rounded-full bg-black border border-white/20 mr-2" />
                  Remove Area
                </Button>
              </div>
            </div>

            {/* Brush Size */}
            <div className="flex items-center gap-3 min-w-[200px]">
              <span className="text-sm font-medium text-muted-foreground">Size:</span>
              <Slider
                value={[brushSize]}
                onValueChange={(v) => setBrushSize(v[0])}
                min={5}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-sm font-mono w-10">{brushSize}px</span>
            </div>

            {/* Undo/Redo */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Editor - 3 columns */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <Tabs defaultValue="overlay">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="overlay">Overlay View</TabsTrigger>
                  <TabsTrigger value="binary">Binary Mask</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overlay" className="mt-0">
                  <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
                    {baseImage ? (
                      <MaskCanvas
                        image={baseImage}
                        brushColor={brushColor === 'green' ? '#00FF00' : '#000000'}
                        brushSize={brushSize}
                        mode="brush"
                        onCanvasChange={handleCanvasChange}
                      />
                    ) : (
                      <div className="aspect-[4/3] flex items-center justify-center">
                        <p className="text-muted-foreground">No mask generated yet</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="binary" className="mt-0">
                  <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
                    {state.maskBinary ? (
                      <img 
                        src={state.maskBinary} 
                        alt="Binary mask"
                        className="w-full h-auto"
                      />
                    ) : (
                      <div className="aspect-[4/3] flex items-center justify-center">
                        <p className="text-muted-foreground">No mask generated yet</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button 
              className="flex-1 formanova-glow"
              size="lg"
              onClick={handleApplyEdits}
              disabled={isApplying}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Continue to Generate
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Instructions Panel - 1 column */}
        <div className="space-y-4">
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Paintbrush className="h-4 w-4 text-primary" />
                How to Refine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="h-4 w-4 rounded-full bg-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Add Area</p>
                    <p className="text-xs text-muted-foreground">Paint over jewelry that should be preserved</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="h-4 w-4 rounded-full bg-black border border-white/20 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Remove Area</p>
                    <p className="text-xs text-muted-foreground">Paint over areas to exclude from mask</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert className="border-primary/30 bg-primary/5">
            <Lightbulb className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              <strong>Tip:</strong> If hair or clothing covers the jewelry, use the green brush to include those covered areas.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
