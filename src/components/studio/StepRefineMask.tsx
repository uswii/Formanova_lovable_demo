import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Paintbrush, Lightbulb, Loader2, ArrowLeft, ArrowRight, Undo, Redo } from 'lucide-react';
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
    
    // TODO: Call API endpoint /api/apply-mask-edits
    // For now, simulate with a delay
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

  // Use overlay or original as base for editing
  const baseImage = state.maskOverlay || state.originalImage;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Main Editor */}
      <Card className="lg:col-span-2 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Paintbrush className="h-5 w-5" />
            Step 2: Refine Mask
          </CardTitle>
          <CardDescription>
            Use the brushes to add or remove areas from the mask
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs for Overlay/Binary view */}
          <Tabs defaultValue="overlay">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overlay">Overlay View</TabsTrigger>
              <TabsTrigger value="binary">Binary View</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overlay" className="mt-4">
              <div className="relative rounded-lg overflow-hidden border border-border">
                {baseImage ? (
                  <MaskCanvas
                    image={baseImage}
                    brushColor={brushColor === 'green' ? '#00FF00' : '#000000'}
                    brushSize={brushSize}
                    mode="brush"
                    onCanvasChange={handleCanvasChange}
                  />
                ) : (
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                    <p className="text-muted-foreground">No mask generated yet</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Green areas = Preserved jewelry regions
              </p>
            </TabsContent>
            
            <TabsContent value="binary" className="mt-4">
              <div className="relative rounded-lg overflow-hidden border border-border">
                {state.maskBinary ? (
                  <img 
                    src={state.maskBinary} 
                    alt="Binary mask"
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                    <p className="text-muted-foreground">No mask generated yet</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground text-center mt-2">
                White = Preserved, Black = Generated
              </p>
            </TabsContent>
          </Tabs>

          {/* Undo/Redo */}
          <div className="flex justify-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
            >
              <Undo className="h-4 w-4 mr-1" />
              Undo
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              Redo
              <Redo className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button 
              className="flex-1"
              onClick={handleApplyEdits}
              disabled={isApplying}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Apply & Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Brush Controls */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display text-lg">Brush Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Color Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Brush Type</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={brushColor === 'green' ? 'default' : 'outline'}
                onClick={() => setBrushColor('green')}
                className={brushColor === 'green' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <div className="h-4 w-4 rounded-full bg-green-500 mr-2" />
                Add
              </Button>
              <Button
                variant={brushColor === 'black' ? 'default' : 'outline'}
                onClick={() => setBrushColor('black')}
                className={brushColor === 'black' ? 'bg-gray-800 hover:bg-gray-900' : ''}
              >
                <div className="h-4 w-4 rounded-full bg-black border border-border mr-2" />
                Remove
              </Button>
            </div>
          </div>

          {/* Brush Size */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Brush Size: {brushSize}px</label>
            <input
              type="range"
              min="5"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Instructions */}
          <div className="space-y-2 pt-4 border-t border-border">
            <p className="text-sm font-medium">Instructions:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500 mt-1 shrink-0" />
                <span><strong>Green brush:</strong> Paint to preserve/add jewelry areas</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-3 w-3 rounded-full bg-black border border-border mt-1 shrink-0" />
                <span><strong>Black brush:</strong> Paint to remove unwanted areas</span>
              </li>
            </ul>
          </div>

          {/* Pro Tip */}
          <Alert className="border-primary/30 bg-primary/5">
            <Lightbulb className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Pro Tip:</strong> If hair, clothing, or hands partially cover the jewelry, 
              use the green brush to paint over those covered areas to include them in the preservation mask.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
