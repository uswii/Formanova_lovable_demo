import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Lightbulb, 
  ArrowLeft, 
  Undo, 
  Redo, 
  Download,
  CheckCircle2,
  XCircle,
  BarChart3,
  Expand,
  RefreshCw,
  Gem,
  XOctagon,
  Bug,
  Paintbrush,
  Eraser,
} from 'lucide-react';
import { StudioState, SkinTone } from '@/pages/JewelryStudio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { BinaryMaskPreview } from './BinaryMaskPreview';
import { WorkflowDebugView } from './WorkflowDebugView';
import { workflowApi, imageSourceToBlob, getStepProgress, type AgenticMaskingResponse } from '@/lib/workflow-api';
import { compressImageBlob, compressDataUrl } from '@/lib/image-compression';
import type { SkinTone as WorkflowSkinTone, MaskingOutputsForGeneration } from '@/lib/workflow-api';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onBack: () => void;
  jewelryType?: string;
}

type BrushStroke = {
  type: 'add' | 'remove';
  points: number[][];
  radius: number;
};

type ViewState = 'refine' | 'generating' | 'results';

const SKIN_TONES: { value: SkinTone; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'fair', label: 'Fair' },
  { value: 'medium', label: 'Medium' },
  { value: 'olive', label: 'Olive' },
  { value: 'brown', label: 'Brown' },
  { value: 'dark', label: 'Dark' },
];

export function StepRefineAndGenerate({ state, updateState, onBack, jewelryType = 'necklace' }: Props) {
  const { toast } = useToast();
  
  // View state
  const [currentView, setCurrentView] = useState<ViewState>(
    state.fluxResult || state.geminiResult ? 'results' : 'refine'
  );

  // Mask editing state
  const [brushMode, setBrushMode] = useState<'add' | 'remove'>('add');
  const [brushSize, setBrushSize] = useState(30);
  const [history, setHistory] = useState<BrushStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeStroke, setActiveStroke] = useState<BrushStroke | null>(null);

  // Overlay color state for mask visualization
  const OVERLAY_COLORS = [
    { name: 'Green', hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } },
    { name: 'Blue', hex: '#00AAFF', rgb: { r: 0, g: 170, b: 255 } },
    { name: 'Pink', hex: '#FF69B4', rgb: { r: 255, g: 105, b: 180 } },
    { name: 'Yellow', hex: '#FFFF00', rgb: { r: 255, g: 255, b: 0 } },
    { name: 'Peach', hex: '#D4845C', rgb: { r: 212, g: 132, b: 92 } },
    { name: 'Red', hex: '#FF4444', rgb: { r: 255, g: 68, b: 68 } },
  ];
  const [selectedOverlayColor, setSelectedOverlayColor] = useState(OVERLAY_COLORS[0]);
  
  // Dynamic overlay image that updates when color changes
  const [dynamicOverlay, setDynamicOverlay] = useState<string | null>(null);

  // Regenerate overlay when color changes or mask changes
  React.useEffect(() => {
    if (!state.originalImage || !state.maskBinary) {
      setDynamicOverlay(null);
      return;
    }

    const createOverlay = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Load both images
        const [originalImg, maskImg] = await Promise.all([
          loadImageAsync(state.originalImage!),
          loadImageAsync(state.maskBinary!),
        ]);

        canvas.width = originalImg.width;
        canvas.height = originalImg.height;

        // Draw original image
        ctx.drawImage(originalImg, 0, 0);

        // Create mask canvas at original size
        const maskCanvas = document.createElement('canvas');
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return;

        maskCanvas.width = originalImg.width;
        maskCanvas.height = originalImg.height;
        maskCtx.drawImage(maskImg, 0, 0, originalImg.width, originalImg.height);

        // Get image data
        const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const overlayData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const overlayOpacity = 0.35;
        const { r, g, b } = selectedOverlayColor.rgb;

        const isNecklace = jewelryType === 'necklace' || jewelryType === 'necklaces';
        
        for (let i = 0; i < maskData.data.length; i += 4) {
          const brightness = (maskData.data[i] + maskData.data[i + 1] + maskData.data[i + 2]) / 3;

          // For necklaces: BLACK pixels get overlay (jewelry area)
          // For other jewelry: WHITE pixels get overlay (background area)
          const shouldApplyOverlay = isNecklace ? (brightness < 128) : (brightness >= 128);

          if (shouldApplyOverlay) {
            overlayData.data[i] = Math.round(overlayData.data[i] * (1 - overlayOpacity) + r * overlayOpacity);
            overlayData.data[i + 1] = Math.round(overlayData.data[i + 1] * (1 - overlayOpacity) + g * overlayOpacity);
            overlayData.data[i + 2] = Math.round(overlayData.data[i + 2] * (1 - overlayOpacity) + b * overlayOpacity);
          }
        }

        ctx.putImageData(overlayData, 0, 0);
        setDynamicOverlay(canvas.toDataURL('image/png'));
      } catch (error) {
        console.error('[StepRefine] Failed to create dynamic overlay:', error);
        // Fall back to original maskOverlay
        setDynamicOverlay(null);
      }
    };

    createOverlay();
  }, [state.originalImage, state.maskBinary, selectedOverlayColor]);

  // Helper to load image as promise
  const loadImageAsync = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; title: string } | null>(null);

  // Debug view state
  const [showDebugView, setShowDebugView] = useState(false);

  // Generation state - Temporal workflow
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStepLabel, setCurrentStepLabel] = useState('Starting workflow...');

  const effectiveStrokes = useMemo(() => {
    if (historyIndex < 0) return [];
    return history[historyIndex] ?? [];
  }, [history, historyIndex]);

  const canvasKey = useMemo(() => `canvas-${historyIndex}-${history.length}`, [historyIndex, history.length]);

  const pushHistory = useCallback((next: BrushStroke[]) => {
    const trimmed = history.slice(0, historyIndex + 1);
    trimmed.push(next);
    setHistory(trimmed);
    setHistoryIndex(trimmed.length - 1);
  }, [history, historyIndex]);

  const handleStrokeStart = useCallback(() => {
    setActiveStroke({
      type: brushMode,
      points: [],
      radius: brushSize,
    });
  }, [brushMode, brushSize]);

  const handleStrokePoint = useCallback((x: number, y: number) => {
    setActiveStroke((prev) => {
      if (!prev) return prev;
      return { ...prev, points: [...prev.points, [x, y]] };
    });
  }, []);

  const handleStrokeEnd = useCallback(() => {
    setActiveStroke((prev) => {
      if (!prev) return null;
      if (prev.points.length === 0) return null;
      const next = [...effectiveStrokes, prev];
      pushHistory(next);
      return null;
    });
  }, [effectiveStrokes, pushHistory]);

  const handleUndo = () => {
    if (historyIndex >= 0) setHistoryIndex(historyIndex - 1);
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
  };

  /**
   * Bakes brush strokes into the mask and returns a data URL.
   * This ensures edited masks are sent to the backend, not just rendered visually.
   */
  const bakeMaskWithStrokes = useCallback(async (baseMaskUrl: string, strokes: BrushStroke[]): Promise<string> => {
    return new Promise((resolve, reject) => {
      const isNecklace = jewelryType === 'necklace' || jewelryType === 'necklaces';
      
      // Use the actual mask dimensions from backend
      // Necklaces use 2000x2667 (Flux pipeline), other jewelry uses 912x1168 (Gemini pipeline)
      const SAM_WIDTH = isNecklace ? 2000 : 912;
      const SAM_HEIGHT = isNecklace ? 2667 : 1168;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Create canvas at SAM dimensions to match backend expectations
        const canvas = document.createElement('canvas');
        canvas.width = SAM_WIDTH;
        canvas.height = SAM_HEIGHT;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw original mask scaled to SAM dimensions
        ctx.drawImage(img, 0, 0, SAM_WIDTH, SAM_HEIGHT);
        
        // Apply strokes at SAM coordinate space (strokes are already in SAM coords)
        const drawStroke = (points: number[][], radius: number, color: string) => {
          if (points.length === 0) return;
          
          ctx.strokeStyle = color;
          ctx.lineWidth = radius;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (points.length === 1) {
            ctx.beginPath();
            ctx.arc(points[0][0], points[0][1], radius / 2, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            return;
          }
          
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
          }
          ctx.stroke();
        };
        
        // Draw strokes: add = white (AI area/background), remove = black (jewelry to preserve)
        strokes.forEach((stroke) => {
          const color = stroke.type === 'add' ? '#FFFFFF' : '#000000';
          drawStroke(stroke.points, stroke.radius, color);
        });
        
        // Enforce strict binary (no anti-aliasing grays)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const threshold = 128;
        
        for (let i = 0; i < data.length; i += 4) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const binary = gray < threshold ? 0 : 255;
          data[i] = binary;
          data[i + 1] = binary;
          data[i + 2] = binary;
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Export as PNG data URL
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load mask image'));
      img.src = baseMaskUrl;
    });
  }, [jewelryType]);

  const handleGenerate = async () => {
    // Base mask from state
    const baseMask = state.editedMask || state.maskBinary;
    
    if (!baseMask || !state.originalImage) {
      toast({
        variant: 'destructive',
        title: 'Missing data',
        description: 'Please complete Step 1 first to generate the mask.',
      });
      return;
    }

    setCurrentView('generating');
    updateState({ isGenerating: true });
    setGenerationProgress(0);
    setCurrentStepLabel('Preparing mask...');

    const isNecklace = jewelryType === 'necklace' || jewelryType === 'necklaces';

    try {
      // IMPORTANT: If user has made brush edits, bake them into the mask before sending
      let maskToUse = baseMask;
      
      if (effectiveStrokes.length > 0) {
        console.log('[Generation] Baking', effectiveStrokes.length, 'brush strokes into mask');
        try {
          maskToUse = await bakeMaskWithStrokes(baseMask, effectiveStrokes);
          console.log('[Generation] Baked mask ready, length:', maskToUse.length);
          
          // Also update state so user can see the final mask was used
          updateState({ editedMask: maskToUse });
        } catch (bakeError) {
          console.error('[Generation] Failed to bake strokes, using base mask:', bakeError);
          // Fall back to base mask if baking fails
        }
      }
      
      console.log('[Generation] Starting workflow');
      console.log('[Generation] Jewelry type:', jewelryType, 'isNecklace:', isNecklace);
      console.log('[Generation] Skin tone:', state.skinTone);
      console.log('[Generation] Mask has strokes baked:', effectiveStrokes.length > 0);

      // Convert image to Blob and compress if needed
      const rawBlob = await imageSourceToBlob(state.originalImage);
      const { blob: imageBlob, wasCompressed } = await compressImageBlob(rawBlob);
      if (wasCompressed) {
        console.log('[Generation] Image compressed for upload');
      }

      // Also compress the mask if it's large
      let compressedMask = maskToUse;
      const maskSizeKB = (maskToUse.length * 0.75) / 1024; // Approximate base64 to bytes
      console.log('[Generation] Mask size estimate:', maskSizeKB.toFixed(1), 'KB');
      
      if (maskSizeKB > 800) {
        console.log('[Generation] Mask exceeds 800KB, compressing...');
        setCurrentStepLabel('Compressing mask...');
        const { blob: compressedMaskBlob, wasCompressed: maskWasCompressed } = await compressDataUrl(maskToUse, 800);
        if (maskWasCompressed) {
          // Convert blob back to base64
          const reader = new FileReader();
          compressedMask = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(compressedMaskBlob);
          });
          console.log('[Generation] Mask compressed to', (compressedMask.length * 0.75 / 1024).toFixed(1), 'KB');
        }
      }

      let result: Record<string, unknown>;

      if (isNecklace) {
        // Necklace: Use flux_gen_pipeline
        setCurrentStepLabel('Starting AI generation...');
        
        const startResponse = await workflowApi.startFluxGen({
          imageBlob,
          maskBase64: compressedMask,
          prompt: 'Necklace worn by female model, luxury editorial portrait, studio lighting',
        });

        console.log('[Generation] flux_gen_pipeline started:', startResponse.workflow_id);

        // Poll until complete
        const rawResult = await workflowApi.pollUntilComplete(
          startResponse.workflow_id,
          'flux_gen',
          (progress, label) => {
            setGenerationProgress(progress);
            setCurrentStepLabel(label);
          }
        );

        result = rawResult as Record<string, unknown>;
      } else {
        // Other jewelry: Use two-step sync flow (port 8001)
        // Step 1: agentic_masking → Step 2: agentic_photoshoot
        
        // Map skin tone to workflow format (light/medium/dark)
        let workflowSkinTone: WorkflowSkinTone = 'medium';
        if (state.skinTone === 'light' || state.skinTone === 'fair') {
          workflowSkinTone = 'light';
        } else if (state.skinTone === 'dark' || state.skinTone === 'brown') {
          workflowSkinTone = 'dark';
        }

        // Map jewelry type to singular form
        let singularType: 'ring' | 'bracelet' | 'earrings' | 'watch' = 'ring';
        if (jewelryType === 'rings' || jewelryType === 'ring') singularType = 'ring';
        else if (jewelryType === 'bracelets' || jewelryType === 'bracelet') singularType = 'bracelet';
        else if (jewelryType === 'earrings' || jewelryType === 'earring') singularType = 'earrings';
        else if (jewelryType === 'watches' || jewelryType === 'watch') singularType = 'watch';

        // ===== STEP 1: Agentic Masking (sync) =====
        setCurrentStepLabel('Preparing your photoshoot...');
        setGenerationProgress(10);
        
        console.log('[Generation] Step 1: Running agentic masking');
        
        // Convert image blob to base64 for the JSON endpoint
        const imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageBlob);
        });
        
        const maskingResponse = await workflowApi.runAgenticMasking({
          imageBase64,
          textPrompt: singularType,
        });
        
        console.log('[Generation] Step 1 complete, got masking outputs');
        setGenerationProgress(30);
        
        // Note: Temporal workflow will re-run masking on the backend, but we use
        // the mask from Step 1 to ensure consistency with what the user sees
        
        // ===== STEP 2: Agentic Photoshoot via Temporal (with polling) =====
        setCurrentStepLabel('Starting photoshoot workflow...');
        setGenerationProgress(35);
        
        console.log('[Generation] Step 2: Starting Temporal photoshoot workflow');
        
        // Start the workflow via Temporal gateway (/process on port 8000)
        const workflowStart = await workflowApi.startAllJewelryGeneration({
          imageBlob,
          jewelryType: singularType,
          skinTone: workflowSkinTone,
        });
        
        console.log('[Generation] Photoshoot workflow started:', workflowStart.workflow_id);
        setCurrentStepLabel('Generating photoshoot...');
        
        // Poll for completion with progress updates
        result = await workflowApi.pollUntilComplete(
          workflowStart.workflow_id,
          'all_jewelry',
          (progress, label) => {
            // Map workflow progress (0-100) to our 35-90 range
            const mappedProgress = 35 + (progress * 0.55);
            setGenerationProgress(Math.round(mappedProgress));
            setCurrentStepLabel(label);
          },
          3000, // Poll every 3 seconds
          600000 // 10 minute timeout
        );
        
        console.log('[Generation] Photoshoot workflow complete');
      }

      setCurrentStepLabel('Final quality check...');
      setGenerationProgress(95);
      
      // Brief delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setGenerationProgress(100);
      setCurrentStepLabel('Complete!');

      console.log('[Generation] Complete, result keys:', Object.keys(result));

      // Extract results from DAG output
      // Log critical nodes to debug
      console.log('[Generation] CRITICAL DEBUG - result structure:');
      console.log('[Generation] transform_apply exists:', result.transform_apply !== undefined);
      console.log('[Generation] transform_apply type:', result.transform_apply ? 
        (Array.isArray(result.transform_apply) ? `array[${(result.transform_apply as unknown[]).length}]` : typeof result.transform_apply) : 'undefined');
      if (result.transform_apply) {
        if (Array.isArray(result.transform_apply) && (result.transform_apply as unknown[]).length > 0) {
          console.log('[Generation] transform_apply[0] keys:', Object.keys((result.transform_apply as Record<string, unknown>[])[0]));
          console.log('[Generation] transform_apply[0].image_base64 preview:', 
            String((result.transform_apply as Record<string, unknown>[])[0]?.image_base64 || '').substring(0, 80));
        } else if (!Array.isArray(result.transform_apply)) {
          console.log('[Generation] transform_apply keys:', Object.keys(result.transform_apply as Record<string, unknown>));
        }
      }
      console.log('[Generation] composite exists:', result.composite !== undefined);
      console.log('[Generation] ALL result keys:', Object.keys(result));
      
      // Detect pipeline type
      // NEW: agentic_photoshoot is the unified agentic pipeline
      const hasAgenticPhotoshoot = result.agentic_photoshoot !== undefined;
      const hasAllJewelryNodes = result.transform_apply !== undefined || 
                                  result.gemini_hand_inpaint !== undefined ||
                                  result.gemini_viton !== undefined;
      const hasNecklaceNodes = result.composite !== undefined || result.composite_gemini !== undefined;
      
      console.log('[Generation] Pipeline detection:', { 
        hasAgenticPhotoshoot,
        hasAllJewelryNodes, 
        hasNecklaceNodes,
        resultKeys: Object.keys(result),
      });
      
      // Get nodes for ALL_JEWELRY or NECKLACE pipeline (can be array-indexed or flat)
      const getNode = (key: string): Record<string, unknown> | undefined => {
        const val = result[key];
        if (!val) {
          return undefined;
        }
        // Handle both array-indexed and flat structures
        if (Array.isArray(val) && val.length > 0) {
          console.log(`[getNode] "${key}" is array[${val.length}], keys:`, Object.keys(val[0]));
          return val[0] as Record<string, unknown>;
        }
        if (typeof val === 'object') {
          console.log(`[getNode] "${key}" is object, keys:`, Object.keys(val as Record<string, unknown>));
          return val as Record<string, unknown>;
        }
        return undefined;
      };
      
      // AGENTIC_PHOTOSHOOT node (new unified pipeline)
      const agenticPhotoshootNode = getNode('agentic_photoshoot');
      
      // ALL_JEWELRY nodes (legacy)
      const transformApplyNode = getNode('transform_apply');
      const geminiHandInpaintNode = getNode('gemini_hand_inpaint');
      const geminiVitonNode = getNode('gemini_viton');
      const compositeAllJewelryNode = getNode('composite_all_jewelry');
      const maskInvertFinalNode = getNode('mask_invert_final');
      const transformMaskNode = getNode('transform_mask');
      
      // NECKLACE nodes (flat objects, not arrays)
      const compositeNode = getNode('composite');
      const compositeGeminiNode = getNode('composite_gemini');
      const maskInvertFluxNode = getNode('mask_invert_flux');
      const maskInvertGeminiNode = getNode('mask_invert_gemini');
      const qualityMetricsFluxNode = getNode('quality_metrics');
      const qualityMetricsGeminiNode = getNode('quality_metrics_gemini');
      
      console.log('[Generation] Node availability:', {
        // All jewelry nodes
        transformApply: !!transformApplyNode,
        geminiHandInpaint: !!geminiHandInpaintNode,
        geminiViton: !!geminiVitonNode,
        compositeAllJewelry: !!compositeAllJewelryNode,
        maskInvertFinal: !!maskInvertFinalNode,
        transformMask: !!transformMaskNode,
        // Necklace nodes
        composite: !!compositeNode,
        compositeGemini: !!compositeGeminiNode,
        maskInvertFlux: !!maskInvertFluxNode,
        maskInvertGemini: !!maskInvertGeminiNode,
      });
      
      // Helper to extract image - handles Azure URIs and base64
      const extractImage = async (node: Record<string, unknown> | undefined, fieldName: string = 'image_base64'): Promise<string | null> => {
        if (!node) {
          return null;
        }
        
        // Get the field value
        const imageField = node[fieldName];
        
        if (!imageField) {
          console.log(`[extractImage] Field "${fieldName}" not found in node. Available keys:`, Object.keys(node));
          return null;
        }
        
        console.log(`[extractImage] Field "${fieldName}" type:`, typeof imageField);
        
        // Check for Azure URI object: { uri: "azure://...", type: "...", ... }
        if (typeof imageField === 'object' && imageField !== null) {
          const imageObj = imageField as Record<string, unknown>;
          const uriValue = imageObj.uri;
          
          if (typeof uriValue === 'string' && uriValue.startsWith('azure://')) {
            console.log('[extractImage] Fetching from Azure URI:', uriValue.substring(0, 80));
            try {
              const { data, error } = await supabase.functions.invoke('azure-fetch-image', {
                body: { azure_uri: uriValue },
              });
              if (error) {
                console.error('[extractImage] Azure fetch error:', error);
                return null;
              }
              if (!data?.base64) {
                console.error('[extractImage] Azure response missing base64');
                return null;
              }
              console.log('[extractImage] Azure fetch success, base64 length:', data.base64.length);
              return `data:${data.content_type || 'image/png'};base64,${data.base64}`;
            } catch (fetchError) {
              console.error('[extractImage] Azure fetch threw:', fetchError);
              return null;
            }
          }
          
          // Check if it's a nested object with another uri (e.g., mask.uri.uri)
          if (typeof uriValue === 'object' && uriValue !== null) {
            const nestedUri = (uriValue as Record<string, unknown>).uri;
            if (typeof nestedUri === 'string' && nestedUri.startsWith('azure://')) {
              console.log('[extractImage] Fetching from nested Azure URI:', nestedUri.substring(0, 80));
              try {
                const { data, error } = await supabase.functions.invoke('azure-fetch-image', {
                  body: { azure_uri: nestedUri },
                });
                if (error) {
                  console.error('[extractImage] Nested Azure fetch error:', error);
                  return null;
                }
                if (!data?.base64) {
                  console.error('[extractImage] Nested Azure response missing base64');
                  return null;
                }
                console.log('[extractImage] Nested Azure fetch success');
                return `data:${data.content_type || 'image/png'};base64,${data.base64}`;
              } catch (fetchError) {
                console.error('[extractImage] Nested Azure fetch threw:', fetchError);
                return null;
              }
            }
          }
          
          console.log('[extractImage] Object field but no valid Azure URI. Keys:', Object.keys(imageObj));
          return null;
        }
        
        // Check for direct azure:// string
        if (typeof imageField === 'string' && imageField.startsWith('azure://')) {
          console.log('[extractImage] Fetching from Azure string:', imageField.substring(0, 60));
          try {
            const { data, error } = await supabase.functions.invoke('azure-fetch-image', {
              body: { azure_uri: imageField },
            });
            if (error) {
              console.error('[extractImage] Azure string fetch error:', error);
              return null;
            }
            if (!data?.base64) {
              console.error('[extractImage] Azure string response missing base64');
              return null;
            }
            console.log('[extractImage] Azure string fetch success');
            return `data:${data.content_type || 'image/png'};base64,${data.base64}`;
          } catch (fetchError) {
            console.error('[extractImage] Azure string fetch threw:', fetchError);
            return null;
          }
        }
        
        // Check for direct base64 string
        if (typeof imageField === 'string' && imageField.length > 100) {
          console.log('[extractImage] Using direct base64 string, length:', imageField.length);
          return imageField.startsWith('data:') ? imageField : `data:image/png;base64,${imageField}`;
        }
        
        console.log('[extractImage] No valid image format found');
        return null;
      };
      
      // Extract images based on pipeline structure
      let fluxResult: string | null = null;
      let geminiResult: string | null = null;
      let outputMaskImage: string | null = null;
      let outputMaskGeminiImage: string | null = null;
      let transformedInputMaskImage: string | null = null;
      let backendMetrics: { precision: number; recall: number; iou: number; growthRatio: number } | null = null;
      let backendFidelityViz: string | null = null;
      
      if (hasAgenticPhotoshoot && agenticPhotoshootNode) {
        // AGENTIC_PHOTOSHOOT pipeline (new unified pipeline)
        // Uses: final_image_base64, fidelity_overlay_base64, mask_metrics, output_mask_base64
        console.log('[Generation] Using AGENTIC_PHOTOSHOOT extraction');
        console.log('[Generation] agenticPhotoshootNode keys:', Object.keys(agenticPhotoshootNode));
        
        // Primary output: final_image_base64
        geminiResult = await extractImage(agenticPhotoshootNode, 'final_image_base64');
        fluxResult = geminiResult; // Use same for both slots
        
        // Extract fidelity overlay from backend
        backendFidelityViz = await extractImage(agenticPhotoshootNode, 'fidelity_overlay_base64');
        
        // Extract output mask
        outputMaskImage = await extractImage(agenticPhotoshootNode, 'output_mask_base64');
        outputMaskGeminiImage = outputMaskImage;
        
        // Extract metrics from backend
        const metrics = agenticPhotoshootNode.mask_metrics as Record<string, number> | undefined;
        if (metrics) {
          backendMetrics = {
            precision: metrics.precision ?? 0,
            recall: metrics.recall ?? 0,
            iou: metrics.iou ?? 0,
            growthRatio: metrics.growth_ratio ?? 1,
          };
          console.log('[Generation] Backend metrics:', backendMetrics);
        }
        
        console.log('[Generation] AGENTIC_PHOTOSHOOT extraction:', {
          hasResult: !!geminiResult,
          hasFidelityViz: !!backendFidelityViz,
          hasOutputMask: !!outputMaskImage,
          hasMetrics: !!backendMetrics,
        });
        
      } else if (hasAllJewelryNodes) {
        // ALL_JEWELRY pipeline: array-indexed nodes (legacy)
        // Primary output: transform_apply[0].image_base64 (final composited)
        // Alternative: gemini_hand_inpaint[0].image_base64 (AI inpainted)
        console.log('[Generation] Using ALL_JEWELRY array-indexed extraction');
        
        // Extract final composited image - try multiple nodes
        geminiResult = await extractImage(transformApplyNode, 'image_base64')
          || await extractImage(geminiHandInpaintNode, 'image_base64')
          || await extractImage(geminiVitonNode, 'image_base64')
          || await extractImage(compositeAllJewelryNode, 'image_base64');
        
        // Use same image for both slots (all_jewelry only has one output)
        fluxResult = geminiResult;
        
        console.log('[Generation] ALL_JEWELRY image extraction:', {
          fromTransformApply: !!transformApplyNode,
          fromGeminiHandInpaint: !!geminiHandInpaintNode,
          fromGeminiViton: !!geminiVitonNode,
          fromCompositeAllJewelry: !!compositeAllJewelryNode,
          hasResult: !!geminiResult,
        });
        
        // Extract masks for fidelity visualization
        // IMPORTANT: For perfect metrics, use transform_apply.mask_base64 as OUTPUT mask
        // This is the exact mask we used to composite the original jewelry onto the inpainted image
        // Using mask_invert_final (SAM3 re-extraction) picks up extra areas (ear, shadows)
        
        // Get transformed input mask (what we used for compositing)
        transformedInputMaskImage = await extractImage(transformMaskNode, 'mask_base64')
          || await extractImage(transformMaskNode, 'image_base64');
        
        // Use transform_apply.mask_base64 as output mask (the actual mask used in final composite)
        // This should give perfect match since we're comparing the same mask
        const transformApplyMask = await extractImage(transformApplyNode, 'mask_base64');
        
        // Fallback to mask_invert_final only if transform_apply.mask_base64 not available
        outputMaskImage = transformApplyMask 
          || await extractImage(maskInvertFinalNode, 'mask_base64')
          || await extractImage(maskInvertFinalNode, 'mask');
        outputMaskGeminiImage = outputMaskImage;
          
        console.log('[Generation] ALL_JEWELRY mask extraction:', {
          hasTransformedInputMask: !!transformedInputMaskImage,
          hasTransformApplyMask: !!transformApplyMask,
          hasOutputMask: !!outputMaskImage,
          usingTransformApplyMask: !!transformApplyMask,
        });
        
      } else if (hasNecklaceNodes) {
        // NECKLACE pipeline: flat objects (result.composite.image_base64)
        console.log('[Generation] Using NECKLACE flat object extraction');
        
        // Primary: composite nodes have the final displayable base64 images
        fluxResult = await extractImage(compositeNode, 'image_base64');
        geminiResult = await extractImage(compositeGeminiNode, 'image_base64');
        
        // Extract output masks for necklace fidelity visualization
        outputMaskImage = await extractImage(maskInvertFluxNode, 'mask_base64') 
          || await extractImage(maskInvertFluxNode, 'mask');
        outputMaskGeminiImage = await extractImage(maskInvertGeminiNode, 'mask_base64') 
          || await extractImage(maskInvertGeminiNode, 'mask');
          
        console.log('[Generation] NECKLACE extraction results:', {
          hasFluxResult: !!fluxResult,
          hasGeminiResult: !!geminiResult,
          hasFluxMask: !!outputMaskImage,
          hasGeminiMask: !!outputMaskGeminiImage,
        });
      } else {
        // Fallback: try all possible extraction methods
        console.log('[Generation] Using fallback extraction, trying all nodes');
        
        // Try all_jewelry nodes first
        geminiResult = await extractImage(transformApplyNode, 'image_base64')
          || await extractImage(geminiHandInpaintNode, 'image_base64')
          || await extractImage(geminiVitonNode, 'image_base64')
          || await extractImage(compositeAllJewelryNode, 'image_base64');
        fluxResult = geminiResult;
        
        // Then try necklace nodes (flat objects)
        if (!fluxResult) {
          fluxResult = await extractImage(compositeNode, 'image_base64');
        }
        if (!geminiResult) {
          geminiResult = await extractImage(compositeGeminiNode, 'image_base64');
        }
      }
      
      console.log('[Generation] Extracted images:', {
        hasFluxResult: !!fluxResult,
        hasGeminiResult: !!geminiResult,
        hasOutputMask: !!outputMaskImage,
        hasOutputMaskGemini: !!outputMaskGeminiImage,
        hasTransformedInputMask: !!transformedInputMaskImage,
      });
      
      // Create fidelity visualizations on frontend if we have masks
      let fidelityViz: string | null = null;
      let fidelityVizGemini: string | null = null;
      let calculatedMetrics: { precision: number; recall: number; iou: number; growthRatio: number } | null = null;
      let calculatedMetricsGemini: { precision: number; recall: number; iou: number; growthRatio: number } | null = null;
      
      // For AGENTIC_PHOTOSHOOT, use backend-provided metrics and fidelity viz
      if (hasAgenticPhotoshoot && backendMetrics) {
        calculatedMetrics = backendMetrics;
        calculatedMetricsGemini = backendMetrics; // Same for both slots
        fidelityViz = backendFidelityViz;
        fidelityVizGemini = backendFidelityViz;
        console.log('[Generation] Using backend metrics and fidelity viz from agentic_photoshoot');
      } else {
        // For other pipelines, calculate on frontend
        // For ALL_JEWELRY, use transformed_input_mask (aligned) instead of user's original mask
        const inputMaskForViz = transformedInputMaskImage || state.maskBinary;
        
        if (inputMaskForViz && fluxResult && outputMaskImage) {
          try {
            const { createFidelityVisualization } = await import('@/lib/mask-visualization');
            const vizResult = await createFidelityVisualization(fluxResult, inputMaskForViz, outputMaskImage, false, false);
            fidelityViz = vizResult.visualization;
            calculatedMetrics = {
              precision: vizResult.metrics.precision,
              recall: vizResult.metrics.recall,
              iou: vizResult.metrics.iou,
              growthRatio: vizResult.metrics.growthRatio,
            };
            console.log('[Generation] Created Flux fidelity viz, metrics:', calculatedMetrics);
          } catch (vizError) {
            console.error('[Generation] Failed to create Flux fidelity viz:', vizError);
          }
        }
        
        if (inputMaskForViz && geminiResult && outputMaskGeminiImage) {
          try {
            const { createFidelityVisualization } = await import('@/lib/mask-visualization');
            const vizResult = await createFidelityVisualization(geminiResult, inputMaskForViz, outputMaskGeminiImage, false, false);
            fidelityVizGemini = vizResult.visualization;
            calculatedMetricsGemini = {
              precision: vizResult.metrics.precision,
              recall: vizResult.metrics.recall,
              iou: vizResult.metrics.iou,
              growthRatio: vizResult.metrics.growthRatio,
            };
            console.log('[Generation] Created Gemini fidelity viz, metrics:', calculatedMetricsGemini);
          } catch (vizError) {
            console.error('[Generation] Failed to create Gemini fidelity viz:', vizError);
          }
        }
        
        // Extract quality metrics from backend for legacy pipelines
        // Use the pre-defined nodes from earlier or fall back to array-indexed access
        const metricsNode = qualityMetricsFluxNode || getNode('quality_metrics');
        const metricsGeminiNode = qualityMetricsGeminiNode || getNode('quality_metrics_gemini');
        
        // Use backend metrics if we didn't calculate them
        if (!calculatedMetrics && metricsNode && metricsNode.precision !== undefined) {
          calculatedMetrics = {
            precision: metricsNode.precision as number,
            recall: metricsNode.recall as number,
            iou: metricsNode.iou as number,
            growthRatio: metricsNode.growth_ratio as number,
          };
          console.log('[Generation] Using backend metrics:', calculatedMetrics);
        }
        
        if (!calculatedMetricsGemini) {
          // For all_jewelry, gemini metrics = main metrics (only one output)
          const metricsSource = hasAllJewelryNodes ? metricsNode : metricsGeminiNode;
          if (metricsSource && metricsSource.precision !== undefined) {
            calculatedMetricsGemini = {
              precision: metricsSource.precision as number,
              recall: metricsSource.recall as number,
              iou: metricsSource.iou as number,
              growthRatio: metricsSource.growth_ratio as number,
            };
          }
        }
      }
      
      console.log('[Generation] Final results:', { 
        hasFluxResult: !!fluxResult, 
        hasGeminiResult: !!geminiResult,
        hasFidelityViz: !!fidelityViz,
        hasFidelityVizGemini: !!fidelityVizGemini,
        calculatedMetrics, 
        calculatedMetricsGemini 
      });

      // Check if we got at least one result image
      if (!fluxResult && !geminiResult) {
        console.error('[Generation] No result images extracted! Result structure:', {
          hasAgenticPhotoshoot,
          hasAllJewelryNodes,
          hasNecklaceNodes,
          resultKeys: Object.keys(result),
        });
        throw new Error('Generation completed but no images could be extracted');
      }

      // Determine workflow type for debug view
      let workflowTypeForDebug: 'flux_gen' | 'all_jewelry' = 'all_jewelry';
      if (isNecklace) {
        workflowTypeForDebug = 'flux_gen';
      }

      updateState({
        fluxResult: fluxResult || null,
        geminiResult: geminiResult || null,
        fidelityViz: fidelityViz,
        fidelityVizGemini: fidelityVizGemini,
        metrics: calculatedMetrics,
        metricsGemini: calculatedMetricsGemini,
        status: (calculatedMetrics && calculatedMetrics.precision > 0.9) || (calculatedMetricsGemini && calculatedMetricsGemini.precision > 0.9) ? 'good' : 'bad',
        isGenerating: false,
        hasTwoModes: isNecklace, // Only necklace has two tabs (Standard + Enhanced)
        workflowResults: result,
        workflowType: workflowTypeForDebug,
      });

      setCurrentView('results');

    } catch (error) {
      console.error('Generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate. Please try again.',
      });
      updateState({ isGenerating: false });
      setCurrentView('refine');
    }
  };

  const handleCancel = async () => {
    // Cancel via Temporal if we have a workflow ID
    updateState({ isGenerating: false });
    setCurrentView('refine');
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Use dynamically generated overlay (with selected color) or fall back to state
  const baseImage = dynamicOverlay || state.maskOverlay || state.originalImage;
  console.log('[StepRefine] baseImage exists:', !!baseImage, 'dynamicOverlay:', !!dynamicOverlay, 'maskOverlay:', !!state.maskOverlay);

  const StatusBadge = ({ status }: { status: 'good' | 'bad' | null }) => {
    if (!status) return null;
    return status === 'good' ? (
      <div className="flex items-center gap-2 text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Jewelry Preserved
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-4 py-2 rounded-full text-sm font-medium">
        <XCircle className="h-4 w-4" />
        Needs Review
      </div>
    );
  };

  // ========== GENERATING VIEW ==========
  if (currentView === 'generating') {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="border-2 border-dashed border-border/50 p-8 w-full max-w-lg">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Gem className="absolute inset-0 m-auto h-10 w-10 text-primary" />
            </div>
            
            <h3 className="font-display text-xl mb-2 text-foreground">Generating Photoshoot</h3>
            <p className="text-sm font-medium text-primary mb-4">{currentStepLabel}</p>
            
            <div className="w-full max-w-xs h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${generationProgress}%` }} 
              />
            </div>
            <p className="mt-3 text-lg font-mono text-primary">{generationProgress}%</p>

            <Button 
              variant="outline" 
              size="sm" 
              className="mt-6"
              onClick={handleCancel}
            >
              <XOctagon className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ========== RESULTS VIEW ==========
  if (currentView === 'results' && (state.fluxResult || state.geminiResult)) {
    return (
      <div className="h-[calc(100vh-160px)] flex flex-col overflow-hidden">
        {/* Fullscreen Image Dialog */}
        <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-primary/20">
            <div className="relative w-full h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="font-display text-lg">{fullscreenImage?.title}</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fullscreenImage && handleDownload(fullscreenImage.url, `${fullscreenImage.title.toLowerCase().replace(/\s+/g, '_')}.jpg`)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
                {fullscreenImage && (
                  <img 
                    src={fullscreenImage.url} 
                    alt={fullscreenImage.title} 
                    className="max-w-full max-h-[80vh] object-contain rounded-lg"
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Header row with back button, status, title */}
        <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setCurrentView('refine')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Edit Mask
            </Button>
            {state.status && <StatusBadge status={state.status} />}
          </div>
          <h2 className="font-display text-2xl md:text-3xl uppercase tracking-tight">Generated Photoshoot</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant={showDebugView ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowDebugView(!showDebugView)}
              title="Show all node outputs for debugging"
            >
              <Bug className="h-4 w-4 mr-2" /> Debug View
            </Button>
            <Button size="default" className="px-6" onClick={handleGenerate}>
              <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
            </Button>
          </div>
        </div>

        {/* Debug View - Shows all node outputs */}
        {showDebugView && state.workflowResults && state.workflowType && (
          <div className="mb-4 shrink-0 max-h-[50vh] overflow-auto">
            <WorkflowDebugView 
              results={state.workflowResults as Record<string, unknown[]>} 
              workflowType={state.workflowType}
              onClose={() => setShowDebugView(false)}
            />
          </div>
        )}

        {/* Results content - fills remaining space */}
        <div className="flex-1 min-h-0">
          {/* For necklace (hasTwoModes), show tabs. For other jewelry, show single result */}
          {state.hasTwoModes ? (
            // NECKLACE: Two modes with tabs (Standard + Enhanced)
            <Tabs defaultValue="standard" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 shrink-0">
                <TabsTrigger value="standard">Standard</TabsTrigger>
                <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
              </TabsList>

              <TabsContent value="standard" className="mt-4 flex-1 min-h-0">
                {state.fluxResult && (
                  <div className="grid lg:grid-cols-3 gap-4 h-full">
                    <div className="lg:col-span-2 h-full min-h-0">
                      <div 
                        className="h-full overflow-hidden border border-border cursor-pointer relative flex items-center justify-center bg-muted/20"
                        onClick={() => setFullscreenImage({ url: state.fluxResult!, title: 'Standard Result' })}
                      >
                        <img src={state.fluxResult} alt="Standard result" className="max-w-full max-h-full object-contain" />
                        <div className="absolute top-3 right-3 z-10 flex gap-2">
                          <button
                            className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); setFullscreenImage({ url: state.fluxResult!, title: 'Standard Result' }); }}
                            title="Fullscreen"
                          >
                            <Expand className="h-4 w-4" />
                          </button>
                          <button
                            className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleDownload(state.fluxResult!, 'standard_result.jpg'); }}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6 overflow-y-auto max-h-full">
                      {state.fidelityViz && (
                        <div className="border border-border bg-card/50 p-6 space-y-5 rounded-xl">
                          <h4 className="font-display text-xl uppercase tracking-tight text-foreground">Jewelry Accuracy</h4>
                          <div className="overflow-hidden border border-border/50 rounded-lg">
                            <img src={state.fidelityViz} alt="Jewelry Accuracy" className="w-full h-auto" />
                          </div>
                          <div className="flex flex-wrap gap-6 text-base pt-2">
                            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-green-500" /><span className="text-foreground font-medium">Original</span></div>
                            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-blue-500" /><span className="text-foreground font-medium">Extended</span></div>
                            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-red-500" /><span className="text-foreground font-medium">Shrunk</span></div>
                          </div>
                        </div>
                      )}
                      {state.metrics && (
                        <div className="border border-border bg-card/50 p-6 space-y-5 rounded-xl">
                          <h4 className="font-display text-xl uppercase tracking-tight text-foreground">Quality Metrics</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <MetricCard label="Precision" value={state.metrics.precision} />
                            <MetricCard label="Recall" value={state.metrics.recall} />
                            <MetricCard label="IoU" value={state.metrics.iou} />
                            <MetricCard label="Growth" value={state.metrics.growthRatio} format="ratio" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="enhanced" className="mt-4 flex-1 min-h-0">
                {state.geminiResult && (
                  <div className="grid lg:grid-cols-3 gap-4 h-full">
                    <div className="lg:col-span-2 h-full min-h-0">
                      <div 
                        className="h-full overflow-hidden border border-border cursor-pointer relative flex items-center justify-center bg-muted/20"
                        onClick={() => setFullscreenImage({ url: state.geminiResult!, title: 'Enhanced Result' })}
                      >
                        <img src={state.geminiResult} alt="Enhanced result" className="max-w-full max-h-full object-contain" />
                        <div className="absolute top-3 right-3 z-10 flex gap-2">
                          <button
                            className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); setFullscreenImage({ url: state.geminiResult!, title: 'Enhanced Result' }); }}
                            title="Fullscreen"
                          >
                            <Expand className="h-4 w-4" />
                          </button>
                          <button
                            className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleDownload(state.geminiResult!, 'enhanced_result.jpg'); }}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 overflow-y-auto max-h-full">
                      {state.fidelityVizGemini && (
                        <div className="border border-border bg-card/50 p-6 space-y-5 rounded-xl">
                          <h4 className="font-display text-xl uppercase tracking-tight text-foreground">Jewelry Accuracy</h4>
                          <div className="overflow-hidden border border-border/50 rounded">
                            <img src={state.fidelityVizGemini} alt="Jewelry Accuracy" className="w-full h-auto" />
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-foreground font-medium">Original</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-blue-500" /><span className="text-foreground font-medium">Extended</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-foreground font-medium">Shrunk</span></div>
                          </div>
                        </div>
                      )}
                      {state.metricsGemini && (
                        <div className="border border-border bg-card/50 p-6 space-y-5 rounded-xl">
                          <h4 className="font-display text-xl uppercase tracking-tight text-foreground">Quality Metrics</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <MetricCard label="Precision" value={state.metricsGemini.precision} />
                            <MetricCard label="Recall" value={state.metricsGemini.recall} />
                            <MetricCard label="IoU" value={state.metricsGemini.iou} />
                            <MetricCard label="Growth" value={state.metricsGemini.growthRatio} format="ratio" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            // OTHER JEWELRY (earrings, bracelets, etc.): Single result view
            <div className="grid lg:grid-cols-3 gap-4 h-full">
              <div className="lg:col-span-2 h-full min-h-0">
                <div 
                  className="h-full overflow-hidden border border-border cursor-pointer relative flex items-center justify-center bg-muted/20"
                  onClick={() => state.fluxResult && setFullscreenImage({ url: state.fluxResult, title: 'Generated Result' })}
                >
                  {state.fluxResult && (
                    <img src={state.fluxResult} alt="Generated result" className="max-w-full max-h-full object-contain" />
                  )}
                  <div className="absolute top-3 right-3 z-10 flex gap-2">
                    <button
                      className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                      onClick={(e) => { e.stopPropagation(); state.fluxResult && setFullscreenImage({ url: state.fluxResult, title: 'Generated Result' }); }}
                      title="Fullscreen"
                    >
                      <Expand className="h-4 w-4" />
                    </button>
                    <button
                      className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                      onClick={(e) => { e.stopPropagation(); state.fluxResult && handleDownload(state.fluxResult, 'generated_result.jpg'); }}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-6 overflow-y-auto max-h-full">
                {state.fidelityViz && (
                  <div className="border border-border bg-card/50 p-6 space-y-5 rounded-xl">
                    <h4 className="font-display text-xl uppercase tracking-tight text-foreground">Jewelry Accuracy</h4>
                    <div className="overflow-hidden border border-border/50 rounded-lg">
                      <img src={state.fidelityViz} alt="Jewelry Accuracy" className="w-full h-auto" />
                    </div>
                    <div className="flex flex-wrap gap-6 text-base pt-2">
                      <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-green-500" /><span className="text-foreground font-medium">Original</span></div>
                      <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-blue-500" /><span className="text-foreground font-medium">Extended</span></div>
                      <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-red-500" /><span className="text-foreground font-medium">Shrunk</span></div>
                    </div>
                  </div>
                )}
                {state.metrics && (
                  <div className="border border-border bg-card/50 p-6 space-y-5 rounded-xl">
                    <h4 className="font-display text-xl uppercase tracking-tight text-foreground">Quality Metrics</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard label="Precision" value={state.metrics.precision} />
                      <MetricCard label="Recall" value={state.metrics.recall} />
                      <MetricCard label="IoU" value={state.metrics.iou} />
                      <MetricCard label="Growth" value={state.metrics.growthRatio} format="ratio" />
                    </div>
                  </div>
                )}
                {!state.fidelityViz && !state.metrics && (
                  <div className="border border-border bg-card/50 p-6 rounded-xl">
                    <p className="text-muted-foreground text-sm">Metrics and accuracy visualization will appear here when available.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== REFINE VIEW (Default) ==========
  return (
    <div className="space-y-8">
      {/* Fullscreen Image Dialog */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-border/20">
          <div className="relative w-full h-full">
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {fullscreenImage && (
                <img 
                  src={fullscreenImage.url} 
                  alt={fullscreenImage.title} 
                  className="max-w-full max-h-[85vh] object-contain"
                />
              )}
            </div>
            {/* Download button in top-right corner */}
            <button
              className="absolute top-4 right-12 z-20 w-10 h-10 rounded-lg bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors shadow-lg"
              onClick={() => fullscreenImage && handleDownload(fullscreenImage.url, `${fullscreenImage.title.toLowerCase().replace(/\s+/g, '_')}.jpg`)}
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Grid: Mask Editor + Controls */}
      <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Left: Mask Canvas */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <span className="marta-label mb-3 block">Step 2</span>
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">Refine & Generate</h2>
            <p className="text-muted-foreground mt-2">Draw to Edit the mask if needed, then generate your photoshoot</p>
          </div>
          
          <div className="space-y-4">
            <Tabs defaultValue="overlay">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overlay">Overlay View</TabsTrigger>
                <TabsTrigger value="binary">Binary View</TabsTrigger>
              </TabsList>

              <TabsContent value="overlay" className="mt-4 space-y-4">
                <div className="flex justify-center gap-4">
                  {/* Canvas */}
                  <div className="relative inline-block group">
                    {baseImage ? (
                      <>
                        <MaskCanvas
                          key={canvasKey}
                          image={baseImage}
                          brushMode={brushMode}
                          overlayColor={selectedOverlayColor.hex}
                          brushSize={brushSize}
                          mode="brush"
                          canvasSize={400}
                          jewelryType={jewelryType}
                          initialStrokes={effectiveStrokes}
                          activeStroke={activeStroke}
                          onBrushStrokeStart={handleStrokeStart}
                          onBrushStrokePoint={handleStrokePoint}
                          onBrushStrokeEnd={handleStrokeEnd}
                        />
                        <button
                          className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                          onClick={() => setFullscreenImage({ url: baseImage, title: 'Mask Overlay' })}
                          title="Fullscreen"
                        >
                          <Expand className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="aspect-[3/4] w-[300px] bg-muted flex items-center justify-center rounded-lg">
                        <p className="text-muted-foreground">No mask generated yet</p>
                      </div>
                    )}
                  </div>
                  {/* Vertical color picker outside canvas */}
                  <div className="flex flex-col gap-2 py-2">
                    {OVERLAY_COLORS.map((color) => (
                      <button
                        key={color.name}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          selectedOverlayColor.name === color.name 
                            ? 'border-foreground scale-110 shadow-lg ring-2 ring-primary/50' 
                            : 'border-muted hover:border-muted-foreground/50'
                        }`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setSelectedOverlayColor(color)}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  <span style={{ color: selectedOverlayColor.hex }} className="font-semibold">{selectedOverlayColor.name}</span> = AI-generated area • <span className="font-semibold">Original</span> = Jewelry preserved
                </p>
              </TabsContent>

              <TabsContent value="binary" className="mt-4">
                <div className="flex justify-center">
                  <div className="relative inline-block group">
                    {state.maskBinary ? (
                      <>
                        <BinaryMaskPreview
                          maskImage={state.maskBinary}
                          strokes={effectiveStrokes}
                          activeStroke={activeStroke}
                          canvasSize={400}
                          jewelryType={jewelryType}
                        />
                        <button
                          className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                          onClick={() => setFullscreenImage({ url: state.maskBinary!, title: 'Binary Mask' })}
                          title="Fullscreen"
                        >
                          <Expand className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="aspect-[3/4] w-[300px] bg-muted flex items-center justify-center rounded-lg">
                        <p className="text-muted-foreground">No mask generated yet</p>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  <span className="font-semibold">Black</span> = Jewelry • <span className="font-semibold">White</span> = Background
                </p>
              </TabsContent>
            </Tabs>

            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex < 0}>
                <Undo className="h-4 w-4 mr-1" /> Undo
              </Button>
              <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                Redo <Redo className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button 
                className="flex-1 h-12 text-lg font-semibold"
                onClick={handleGenerate} 
                disabled={!state.originalImage}
              >
                <Gem className="h-5 w-5 mr-2" />
                Generate Photoshoot
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Brush Controls */}
        <div className="space-y-6">
          <div>
            <span className="marta-label mb-3 block">Tools</span>
            <h3 className="font-display text-2xl uppercase tracking-tight">Controls</h3>
          </div>
          
          {/* Model Skin Tone Selection - Only for non-necklace jewelry */}
          {jewelryType !== 'necklace' && (
            <div className="space-y-2 pb-4 border-b border-border/30">
              <label className="text-sm font-medium">Model Skin Tone</label>
              <Select
                value={state.skinTone}
                onValueChange={(value: SkinTone) => updateState({ skinTone: value })}
              >
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectValue placeholder="Select skin tone" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  {SKIN_TONES.map((tone) => (
                    <SelectItem key={tone.value} value={tone.value}>
                      {tone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="space-y-5">
            <div className="space-y-3">
              <label className="text-sm font-medium">Tools</label>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={brushMode === 'add' ? 'default' : 'outline'}
                  onClick={() => setBrushMode('add')}
                  className={`justify-start h-11 ${brushMode === 'add' ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}`}
                >
                  <Paintbrush className="h-4 w-4 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Add to Mask</p>
                  </div>
                </Button>
                <Button
                  variant={brushMode === 'remove' ? 'default' : 'outline'}
                  onClick={() => setBrushMode('remove')}
                  className={`justify-start h-11 ${brushMode === 'remove' ? 'bg-gray-800 hover:bg-gray-900 border-gray-800' : ''}`}
                >
                  <Eraser className="h-4 w-4 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Eraser</p>
                  </div>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
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
            </div>

            <div className="border border-border/20 p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Tip:</strong> Paint green over jewelry areas you want to preserve.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, format = 'percent' }: { label: string; value: number; format?: 'percent' | 'ratio' }) {
  const displayValue = format === 'ratio' ? `${value.toFixed(2)}x` : `${(value * 100).toFixed(1)}%`;
  const isGood = format === 'ratio' ? value >= 0.9 && value <= 1.1 : value >= 0.9;
  
  return (
    <div className="p-5 rounded-xl bg-muted/70 border border-border/50 text-center">
      <p className="text-base text-muted-foreground font-medium mb-2">{label}</p>
      <p className={`text-2xl font-bold ${isGood ? 'text-green-500' : 'text-foreground'}`}>{displayValue}</p>
    </div>
  );
}
