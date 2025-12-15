import React, { useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Lightbulb, Loader2, Image as ImageIcon, X, Diamond, Sparkles, Play, Undo2, Redo2 } from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';

// Import jewelry images for examples
import necklaceGold from '@/assets/jewelry/necklace-gold.jpg';
import necklacePearl from '@/assets/jewelry/necklace-pearl.jpg';
import necklaceDiamond from '@/assets/jewelry/necklace-diamond.jpg';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
}

export function StepUploadMark({ state, updateState, onNext }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingMask, setIsGeneratingMask] = useState(false);
  const [redDots, setRedDots] = useState<{ x: number; y: number }[]>([]);
  const [undoStack, setUndoStack] = useState<{ x: number; y: number }[][]>([]);
  const [redoStack, setRedoStack] = useState<{ x: number; y: number }[][]>([]);
  const { toast } = useToast();

  // Example images - these will be replaced with your A100 server images
  const exampleImages = [
    { src: necklaceGold, label: 'Gold Pendant' },
    { src: necklacePearl, label: 'Pearl Strand' },
    { src: necklaceDiamond, label: 'Diamond Drop' },
    { src: necklaceGold, label: 'Chain Necklace' },
    { src: necklacePearl, label: 'Classic Pearls' },
    { src: necklaceDiamond, label: 'Statement Piece' },
  ];

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
      updateState({ 
        originalImage: result,
        markedImage: null,
        maskOverlay: null,
        maskBinary: null,
        fluxResult: null,
        geminiResult: null,
      });
      setRedDots([]);
    };
    reader.readAsDataURL(file);
  }, [updateState, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleGenerateMask = async () => {
    if (redDots.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No marks found',
        description: 'Please mark the jewelry with red dots first.',
      });
      return;
    }

    setIsGeneratingMask(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    updateState({
      maskOverlay: state.originalImage,
      maskBinary: state.originalImage,
      sessionId: `session_${Date.now()}`,
    });
    
    setIsGeneratingMask(false);
    toast({
      title: 'Mask generated',
      description: 'You can now refine the mask in the next step.',
    });
    onNext();
  };

  const handleCanvasClick = (x: number, y: number) => {
    setUndoStack(prev => [...prev, redDots]);
    setRedoStack([]);
    setRedDots(prev => [...prev, { x, y }]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, redDots]);
    setRedDots(previousState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, redDots]);
    setRedDots(nextState);
  };

  const clearImage = () => {
    updateState({ 
      originalImage: null,
      markedImage: null,
      maskOverlay: null,
      maskBinary: null,
    });
    setRedDots([]);
  };

  const loadExample = (src: string) => {
    updateState({ 
      originalImage: src,
      markedImage: null,
      maskOverlay: null,
      maskBinary: null,
      fluxResult: null,
      geminiResult: null,
    });
    setRedDots([]);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Main Upload/Canvas Area - 2 columns */}
      <Card className="lg:col-span-2 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload & Mark Your Jewelry
          </CardTitle>
          <CardDescription>
            Upload your jewelry image and click to mark the jewelry pieces
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 h-full flex flex-col">
          {!state.originalImage ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="relative border-2 border-dashed border-primary/30 rounded-2xl text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all p-12 flex-1 flex flex-col items-center justify-center"
            >
              <div className="relative mx-auto w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                  <Diamond className="h-10 w-10 text-primary" />
                </div>
              </div>
              <p className="text-xl font-display font-medium mb-2">
                Drop your jewelry image here
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                or click to browse your files
              </p>
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
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="relative rounded-xl overflow-hidden border border-border flex-1">
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-3 right-3 z-10 shadow-lg"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
                <MaskCanvas
                  image={state.originalImage}
                  dots={redDots}
                  onCanvasClick={handleCanvasClick}
                  brushColor="#FF0000"
                  brushSize={10}
                  mode="dot"
                />
              </div>
              
              {/* Mark counter and actions */}
              <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-sm">
                    <span className="font-bold text-foreground">{redDots.length}</span>
                    <span className="text-muted-foreground"> marks placed</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    title="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    title="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setUndoStack(prev => [...prev, redDots]);
                      setRedoStack([]);
                      setRedDots([]);
                    }}
                    disabled={redDots.length === 0}
                  >
                    Clear All
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGenerateMask}
                    disabled={isGeneratingMask || redDots.length === 0}
                    className="formanova-glow"
                  >
                    {isGeneratingMask ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate Mask
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Pro Tip */}
          <Alert className="border-primary/30 bg-primary/5">
            <Lightbulb className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Pro Tip:</strong> Use high-quality inputs for best results. Sharp, well-lit images produce the most accurate masks.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Example Images Panel - 1 column */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Diamond className="h-5 w-5 text-primary" />
            Example Gallery
          </CardTitle>
          <CardDescription>
            Click any example to try it out
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {exampleImages.map((img, index) => (
              <button
                key={index}
                onClick={() => loadExample(img.src)}
                className="group relative aspect-square rounded-xl overflow-hidden border-2 border-border hover:border-primary/50 transition-all bg-muted"
              >
                <img 
                  src={img.src} 
                  alt={img.label}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-medium">{img.label}</span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-primary/90 text-primary-foreground rounded-full p-2">
                    <Play className="h-4 w-4" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
