import React, { useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Lightbulb, Loader2, Image as ImageIcon, X, Diamond, Sparkles } from 'lucide-react';
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
  const { toast } = useToast();

  const exampleImages = [
    { src: necklaceGold, label: 'Gold Pendant' },
    { src: necklacePearl, label: 'Pearl Strand' },
    { src: necklaceDiamond, label: 'Diamond Drop' },
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
    <div className="space-y-6">
      {/* Main Upload/Canvas Area */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader className="pb-4">
          <CardTitle className="font-display flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload & Mark Your Jewelry
          </CardTitle>
          <CardDescription>
            Upload your jewelry image and click on the jewelry to mark it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Upload/Canvas - 2 columns */}
            <div className="lg:col-span-2">
              {!state.originalImage ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="relative border-2 border-dashed border-primary/30 rounded-2xl p-12 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all min-h-[400px] flex flex-col items-center justify-center"
                >
                  {/* Animated background */}
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute top-10 left-10 w-20 h-20 border border-primary/10 rotate-45 animate-pulse" />
                    <div className="absolute bottom-10 right-10 w-16 h-16 border border-primary/10 rotate-12 animate-pulse animation-delay-200" />
                    <div className="absolute top-1/2 right-20 w-8 h-8 bg-primary/5 rotate-45 animate-pulse animation-delay-300" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="relative mx-auto w-24 h-24 mb-6">
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                      <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center">
                        <Diamond className="h-10 w-10 text-primary" />
                      </div>
                    </div>
                    <p className="text-lg font-medium mb-2">
                      Drop your jewelry image here
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse your files
                    </p>
                    <Button variant="outline" size="sm">
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Browse Files
                    </Button>
                  </div>
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
                    <MaskCanvas
                      image={state.originalImage}
                      dots={redDots}
                      onCanvasClick={handleCanvasClick}
                      brushColor="#FF0000"
                      brushSize={10}
                      mode="dot"
                    />
                  </div>
                  
                  {/* Mark counter */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{redDots.length}</span> marks placed
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setRedDots([])}
                        disabled={redDots.length === 0}
                      >
                        Clear Marks
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
            </div>

            {/* Examples Panel - 1 column */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Diamond className="h-4 w-4 text-primary" />
                  Try an Example
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {exampleImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => loadExample(img.src)}
                      className="group relative aspect-video rounded-xl overflow-hidden border-2 border-border hover:border-primary/50 transition-all bg-muted"
                    >
                      <img 
                        src={img.src} 
                        alt={img.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                      <span className="absolute bottom-2 left-3 text-xs font-medium">{img.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pro Tip */}
              <Alert className="border-primary/30 bg-primary/5">
                <Lightbulb className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                  <strong>Tip:</strong> Mark multiple points on the jewelry for better detection accuracy.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
