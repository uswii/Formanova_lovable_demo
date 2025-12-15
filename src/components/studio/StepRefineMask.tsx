import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Paintbrush, Lightbulb, Loader2, ArrowLeft, ArrowRight, Undo, Redo, Sparkles } from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { a100Api } from '@/lib/a100-api';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface BrushStroke {
  type: 'add' | 'remove';
  points: number[][];
  radius: number;
}

export function StepRefineMask({ state, updateState, onNext, onBack }: Props) {
  const [brushColor, setBrushColor] = useState<'green' | 'black'>('green');
  const [brushSize, setBrushSize] = useState(30);
  const [isApplying, setIsApplying] = useState(false);
  const [brushStrokes, setBrushStrokes] = useState<BrushStroke[]>([]);
  const [history, setHistory] = useState<BrushStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { toast } = useToast();

  const handleApplyEdits = async () => {
    setIsApplying(true);
    
    try {
      if (brushStrokes.length > 0 && state.originalImage && state.maskBinary) {
        // Extract base64 from data URLs
        let originalBase64 = state.originalImage;
        if (originalBase64.includes(',')) {
          originalBase64 = originalBase64.split(',')[1];
        }
        
        let maskBase64 = state.maskBinary;
        if (maskBase64.includes(',')) {
          maskBase64 = maskBase64.split(',')[1];
        }
        
        const response = await a100Api.refineMask({
          original_image_base64: originalBase64,
          current_mask_base64: maskBase64,
          brush_strokes: brushStrokes,
        });
        
        if (response) {
          updateState({
            maskBinary: `data:image/png;base64,${response.mask_base64}`,
            maskOverlay: `data:image/jpeg;base64,${response.mask_overlay_base64}`,
            editedMask: `data:image/png;base64,${response.mask_base64}`,
          });
        }
      }
      
      toast({
        title: 'Mask edits applied',
        description: 'Your refinements have been saved.',
      });
      onNext();
    } catch (error) {
      console.error('Refine mask error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to apply edits',
        description: 'Please try again.',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setBrushStrokes(history[historyIndex - 1]);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setBrushStrokes([]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setBrushStrokes(history[historyIndex + 1]);
    }
  };

  const handleCanvasChange = useCallback((dataUrl: string) => {
    // This is called when brush strokes are made on the canvas
    // We'll track the strokes separately for the API
  }, []);

  const handleBrushStroke = useCallback((x: number, y: number) => {
    const newStroke: BrushStroke = {
      type: brushColor === 'green' ? 'add' : 'remove',
      points: [[x, y]],
      radius: brushSize,
    };
    
    const newStrokes = [...brushStrokes, newStroke];
    setBrushStrokes(newStrokes);
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newStrokes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [brushColor, brushSize, brushStrokes, history, historyIndex]);

  const baseImage = state.maskOverlay || state.originalImage;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Main Editor - 2 columns */}
      <Card className="lg:col-span-2 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Paintbrush className="h-5 w-5 text-primary" />
            Refine Your Mask
          </CardTitle>
          <CardDescription>
            Paint to add or remove areas from the jewelry mask
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs for Overlay/Binary view */}
          <Tabs defaultValue="overlay">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overlay">Overlay View</TabsTrigger>
              <TabsTrigger value="binary">Binary Mask</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overlay" className="mt-4">
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
                {baseImage ? (
                  <MaskCanvas
                    image={baseImage}
                    brushColor={brushColor === 'green' ? '#00FF00' : '#000000'}
                    brushSize={brushSize}
                    mode="brush"
                    onCanvasChange={handleCanvasChange}
                    onCanvasClick={handleBrushStroke}
                  />
                ) : (
                  <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                    <p className="text-muted-foreground">No mask generated yet</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Green = Preserved jewelry • Black = AI-generated areas
              </p>
            </TabsContent>
            
            <TabsContent value="binary" className="mt-4">
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
                {state.maskBinary ? (
                  <img 
                    src={state.maskBinary} 
                    alt="Binary mask"
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                    <p className="text-muted-foreground">No mask generated yet</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                White = Preserved • Black = Generated
              </p>
            </TabsContent>
          </Tabs>

          {/* Undo/Redo */}
          <div className="flex justify-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex < 0}
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
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button 
              className="flex-1 formanova-glow"
              onClick={handleApplyEdits}
              disabled={isApplying}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Apply & Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Brush Controls - Side Panel */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Paintbrush className="h-5 w-5 text-primary" />
            Brush Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brush Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Brush Type</label>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant={brushColor === 'green' ? 'default' : 'outline'}
                onClick={() => setBrushColor('green')}
                className={`justify-start h-12 ${brushColor === 'green' ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}`}
              >
                <div className="h-5 w-5 rounded-full bg-green-500 mr-3 shadow-lg shadow-green-500/50" />
                <div className="text-left">
                  <p className="font-medium">Add Area</p>
                  <p className="text-xs opacity-80">Include in mask</p>
                </div>
              </Button>
              <Button
                variant={brushColor === 'black' ? 'default' : 'outline'}
                onClick={() => setBrushColor('black')}
                className={`justify-start h-12 ${brushColor === 'black' ? 'bg-gray-800 hover:bg-gray-900 border-gray-800' : ''}`}
              >
                <div className="h-5 w-5 rounded-full bg-black border-2 border-white/30 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Remove Area</p>
                  <p className="text-xs opacity-80">Exclude from mask</p>
                </div>
              </Button>
            </div>
          </div>

          {/* Brush Size */}
          <div className="space-y-3">
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Fine</span>
              <span>Large</span>
            </div>
          </div>

          {/* Brush Preview */}
          <div className="flex items-center justify-center py-4 bg-muted/30 rounded-lg border border-border/50">
            <div 
              className="rounded-full transition-all duration-200"
              style={{
                width: brushSize,
                height: brushSize,
                backgroundColor: brushColor === 'green' ? '#22c55e' : '#000000',
                boxShadow: brushColor === 'green' ? '0 0 20px rgba(34, 197, 94, 0.5)' : 'none',
                border: brushColor === 'black' ? '2px solid rgba(255,255,255,0.3)' : 'none'
              }}
            />
          </div>

          {/* Instructions */}
          <div className="space-y-2 pt-4 border-t border-border">
            <p className="text-sm font-medium">Quick Guide</p>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500 mt-0.5 shrink-0" />
                <span>Paint green to preserve jewelry areas</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-3 w-3 rounded-full bg-black border border-white/30 mt-0.5 shrink-0" />
                <span>Paint black to let AI generate those areas</span>
              </li>
            </ul>
          </div>

          {/* Pro Tip */}
          <Alert className="border-primary/30 bg-primary/5">
            <Lightbulb className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              <strong>Tip:</strong> If hair or clothing covers the jewelry, paint green over those areas to include them in the preservation mask.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}