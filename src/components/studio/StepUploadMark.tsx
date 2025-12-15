import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Lightbulb, Loader2, Image as ImageIcon, X, Diamond, Sparkles, Play, Undo2, Redo2 } from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { a100Api, ExampleImage } from '@/lib/a100-api';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
}

export function StepUploadMark({ state, updateState, onNext }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingMask, setIsGeneratingMask] = useState(false);
  const [redDots, setRedDots] = useState<{ x: number; y: number }[]>([]); // image pixel space
  const [undoStack, setUndoStack] = useState<{ x: number; y: number }[][]>([]);
  const [redoStack, setRedoStack] = useState<{ x: number; y: number }[][]>([]);
  const [exampleImages, setExampleImages] = useState<ExampleImage[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(true);
  const { toast } = useToast();

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
      });
      setRedDots([]);
      setUndoStack([]);
      setRedoStack([]);
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

    if (!state.originalImage) {
      toast({
        variant: 'destructive',
        title: 'No image',
        description: 'Please upload an image first.',
      });
      return;
    }

    setIsGeneratingMask(true);

    try {
      const points = redDots.map((dot) => [dot.x, dot.y]);

      let imageBase64 = state.originalImage;
      if (imageBase64.includes(',')) imageBase64 = imageBase64.split(',')[1];

      const response = await a100Api.segment({
        image_base64: imageBase64,
        points,
      });

      if (!response) throw new Error('Segmentation failed');

      updateState({
        originalImage: `data:image/jpeg;base64,${response.processed_image_base64}`,
        maskOverlay: `data:image/jpeg;base64,${response.mask_overlay_base64}`,
        maskBinary: `data:image/png;base64,${response.mask_base64}`,
        originalMask: `data:image/png;base64,${response.original_mask_base64}`,
        sessionId: response.session_id,
        scaledPoints: response.scaled_points ?? null,
      });

      toast({
        title: 'Mask generated',
        description: 'You can now refine the mask in the next step.',
      });
      onNext();
    } catch (error) {
      console.error('Segmentation error:', error);
      toast({
        variant: 'destructive',
        title: 'Segmentation failed',
        description: error instanceof Error ? error.message : 'Failed to generate mask. Please try again.',
      });
    } finally {
      setIsGeneratingMask(false);
    }
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
    });
    setRedDots([]);
    setUndoStack([]);
    setRedoStack([]);
  };

  const loadExample = (example: ExampleImage) => {
    updateState({
      originalImage: `data:image/jpeg;base64,${example.image_base64}`,
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
    });
    setRedDots([]);
    setUndoStack([]);
    setRedoStack([]);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload & Mark Your Jewelry
          </CardTitle>
          <CardDescription>Upload your jewelry image and click to mark the jewelry pieces</CardDescription>
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
              <div className="relative rounded-xl overflow-hidden border border-border">
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-3 right-3 z-10 shadow-lg"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center bg-muted/20 p-6 min-h-[350px]">
                  <MaskCanvas
                    image={state.originalImage}
                    dots={redDots}
                    onCanvasClick={handleCanvasClick}
                    brushColor="#FF0000"
                    brushSize={10}
                    mode="dot"
                    coordinateSpace="image"
                    canvasSize={300}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-sm">
                    <span className="font-bold text-foreground">{redDots.length}</span>
                    <span className="text-muted-foreground"> marks placed</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo">
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo">
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUndoStack((prev) => [...prev, redDots]);
                      setRedoStack([]);
                      setRedDots([]);
                    }}
                    disabled={redDots.length === 0}
                  >
                    Clear All
                  </Button>
                  <Button size="sm" onClick={handleGenerateMask} disabled={isGeneratingMask || redDots.length === 0} className="formanova-glow">
                    {isGeneratingMask ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Generate Mask
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Alert className="border-primary/30 bg-primary/5">
            <Lightbulb className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Pro Tip:</strong> Use high-quality inputs for best results. Sharp, well-lit images produce the most accurate masks.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Diamond className="h-5 w-5 text-primary" />
            Example Gallery
          </CardTitle>
          <CardDescription>Click any example to try it out</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingExamples ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : exampleImages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">No server examples found.</p>
              <p className="text-xs text-muted-foreground text-center">
                Add images to <span className="font-mono">/home/bilal/viton_jewelry_model/examples</span> on the A100.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto">
              {exampleImages.map((example) => (
                <button
                  key={example.id}
                  onClick={() => loadExample(example)}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all bg-muted"
                >
                  <img
                    src={`data:image/jpeg;base64,${example.thumbnail_base64 || example.image_base64}`}
                    alt={example.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <div className="bg-primary/90 text-primary-foreground rounded-full p-1.5">
                      <Play className="h-3 w-3" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
