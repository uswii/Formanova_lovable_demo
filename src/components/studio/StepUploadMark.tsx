import React, { useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Lightbulb, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { StudioState } from '@/pages/Studio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
}

// Example images (placeholder - user will provide actual examples)
const exampleImages = [
  '/placeholder.svg',
  '/placeholder.svg',
  '/placeholder.svg',
  '/placeholder.svg',
  '/placeholder.svg',
  '/placeholder.svg',
];

export function StepUploadMark({ state, updateState, onNext }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingMask, setIsGeneratingMask] = useState(false);
  const [redDots, setRedDots] = useState<{ x: number; y: number }[]>([]);
  const { toast } = useToast();

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
    
    // TODO: Call API endpoint /api/mask-generation
    // For now, simulate with a delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock response - in production, this comes from your A100 server
    updateState({
      maskOverlay: state.originalImage, // Placeholder
      maskBinary: state.originalImage,  // Placeholder
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
    setRedDots(prev => [...prev, { x, y }]);
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

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Upload Area */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Step 1: Upload & Mark
          </CardTitle>
          <CardDescription>
            Upload your jewelry image and mark the jewelry with red dots
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!state.originalImage ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
            >
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                Drag & drop your jewelry image here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
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
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
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
              
              <p className="text-sm text-muted-foreground text-center">
                Click on the jewelry to mark it with red dots ({redDots.length} marks)
              </p>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setRedDots([])}
                  disabled={redDots.length === 0}
                >
                  Clear Marks
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleGenerateMask}
                  disabled={isGeneratingMask || redDots.length === 0}
                >
                  {isGeneratingMask ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Generate Mask
                </Button>
              </div>
            </div>
          )}

          {/* Pro Tip */}
          <Alert className="border-primary/30 bg-primary/5">
            <Lightbulb className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Pro Tip:</strong> For best results, upload high-resolution images with clear jewelry visibility. 
              Mark multiple points on the jewelry for better detection.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Right: Example Images */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display">Example Images</CardTitle>
          <CardDescription>
            Click on any example to try it out
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {exampleImages.map((img, index) => (
              <button
                key={index}
                onClick={() => {
                  // In production, load actual example images
                  toast({
                    title: 'Example selected',
                    description: 'Example images will be available when connected to your server.',
                  });
                }}
                className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary/50 transition-all bg-muted"
              >
                <img 
                  src={img} 
                  alt={`Example ${index + 1}`}
                  className="w-full h-full object-cover opacity-50"
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            12 example images from your EXAMPLES folder will appear here
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
