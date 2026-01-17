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
} from 'lucide-react';
import { StudioState, SkinTone } from '@/pages/JewelryStudio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { BinaryMaskPreview } from './BinaryMaskPreview';
import { workflowApi, imageSourceToBlob, getStepProgress } from '@/lib/workflow-api';
import type { SkinTone as WorkflowSkinTone } from '@/lib/workflow-api';
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

  // Fullscreen state
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; title: string } | null>(null);

  // Generation state - Temporal workflow
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStepLabel, setCurrentStepLabel] = useState('Starting workflow...');
  const [prompt, setPrompt] = useState('Necklace worn by female model');
  const [invertMask, setInvertMask] = useState(true);

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
        
        // Draw strokes: add = black (jewelry/preserved), remove = white (AI-generated)
        strokes.forEach((stroke) => {
          const color = stroke.type === 'add' ? '#000000' : '#FFFFFF';
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

      // Convert image to Blob
      const imageBlob = await imageSourceToBlob(state.originalImage);

      let result: Record<string, unknown>;

      if (isNecklace) {
        // Necklace: Use flux_gen_pipeline
        setCurrentStepLabel('Starting Flux generation...');
        
        const startResponse = await workflowApi.startFluxGen({
          imageBlob,
          maskBase64: maskToUse,
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
        // Other jewelry: Use all_jewelry_masking + all_jewelry_generation (two-step process)
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

        // Check if we already have a mask (from user edit or prior masking step)
        let finalMask = maskToUse;
        
        // If no mask exists (shouldn't happen since we require it in step 1), run masking first
        if (!finalMask || finalMask === state.maskBinary) {
          // We have a mask from step 1, use it directly
          console.log('[Generation] Using existing mask from step 1');
        }

        // Step 2: Run generation with the mask
        setCurrentStepLabel(`Starting ${singularType} generation...`);

        const genStartResponse = await workflowApi.startAllJewelryGeneration({
          imageBlob,
          maskBase64: finalMask,
          jewelryType: singularType,
          skinTone: workflowSkinTone,
        });

        console.log('[Generation] all_jewelry_generation started:', genStartResponse.workflow_id);

        // Poll until complete
        const rawResult = await workflowApi.pollUntilComplete(
          genStartResponse.workflow_id,
          'all_jewelry',
          (progress, label) => {
            setGenerationProgress(progress);
            setCurrentStepLabel(label);
          }
        );

        result = rawResult as Record<string, unknown>;
      }

      setGenerationProgress(100);
      setCurrentStepLabel('Complete!');

      console.log('[Generation] Complete, result keys:', Object.keys(result));

      // Extract results from DAG output
      console.log('[Generation] Full result structure:', JSON.stringify(result, null, 2).substring(0, 5000));
      console.log('[Generation] ALL result keys:', Object.keys(result));
      
      // Detect pipeline type based on result structure:
      // Pipeline detection based on result structure:
      // 
      // ALL_JEWELRY pipeline returns ARRAY-INDEXED structure (like necklace but different nodes):
      //   - transform_apply[0].image_base64 (Azure URI) - final composited image
      //   - gemini_hand_inpaint[0].image_base64 (Azure URI) - AI inpainted result  
      //   - quality_metrics[0] - metrics object with iou, precision, recall, dice, etc.
      //   - mask_invert_final[0].mask_base64 (Azure URI) - output mask
      //   - transform_mask[0].mask_base64 (Azure URI) - transformed input mask
      //
      // NECKLACE pipeline returns ARRAY-INDEXED structure:
      //   - composite[0].image_base64
      //   - composite_gemini[0].image_base64
      //   - quality_metrics[0] or quality_metrics_gemini[0]
      
      // Detect all_jewelry by checking for its specific nodes
      const hasAllJewelryNodes = Array.isArray(result.transform_apply) || 
                                  Array.isArray(result.gemini_hand_inpaint) ||
                                  Array.isArray(result.gemini_viton);
      const hasNecklaceNodes = Array.isArray(result.composite) || Array.isArray(result.composite_gemini);
      
      console.log('[Generation] Pipeline detection:', { 
        hasAllJewelryNodes, 
        hasNecklaceNodes,
        resultKeys: Object.keys(result),
      });
      
      // Get nodes for ALL_JEWELRY pipeline (array-indexed)
      const transformApplyNode = (result.transform_apply as unknown[])?.[0] as Record<string, unknown> | undefined;
      const geminiHandInpaintNode = (result.gemini_hand_inpaint as unknown[])?.[0] as Record<string, unknown> | undefined;
      const geminiVitonNode = (result.gemini_viton as unknown[])?.[0] as Record<string, unknown> | undefined;
      const compositeAllJewelryNode = (result.composite_all_jewelry as unknown[])?.[0] as Record<string, unknown> | undefined;
      const maskInvertFinalNode = (result.mask_invert_final as unknown[])?.[0] as Record<string, unknown> | undefined;
      const transformMaskNode = (result.transform_mask as unknown[])?.[0] as Record<string, unknown> | undefined;
      
      // Get nodes for NECKLACE pipeline (array-indexed)
      const compositeNode = (result.composite as unknown[])?.[0] as Record<string, unknown> | undefined;
      const compositeGeminiNode = (result.composite_gemini as unknown[])?.[0] as Record<string, unknown> | undefined;
      const upscalerNode = (result.upscaler as unknown[])?.[0] as Record<string, unknown> | undefined;
      const upscalerGeminiNode = (result.upscaler_gemini as unknown[])?.[0] as Record<string, unknown> | undefined;
      const fluxFillNode = (result.flux_fill as unknown[])?.[0] as Record<string, unknown> | undefined;
      
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
        upscaler: !!upscalerNode,
        upscalerGemini: !!upscalerGeminiNode,
        fluxFill: !!fluxFillNode,
      });
      
      // Helper to extract image - handles Azure URIs and base64
      const extractImage = async (node: Record<string, unknown> | undefined, fieldName: string = 'image_base64'): Promise<string | null> => {
        if (!node) {
          console.log('[extractImage] Node is null/undefined');
          return null;
        }
        
        console.log('[extractImage] Node keys:', Object.keys(node), 'fieldName:', fieldName);
        
        // Get the field value
        const imageField = node[fieldName];
        console.log('[extractImage] imageField type:', typeof imageField, 'value preview:', 
          typeof imageField === 'object' && imageField !== null ? JSON.stringify(imageField)?.substring(0, 200) : 
          typeof imageField === 'string' ? imageField.substring(0, 100) : String(imageField));
        
        // Check for Azure URI - handle both object with uri property and direct azure:// string
        if (typeof imageField === 'object' && imageField !== null) {
          const uriValue = (imageField as Record<string, unknown>).uri;
          if (typeof uriValue === 'string' && uriValue.startsWith('azure://')) {
            console.log('[extractImage] Fetching image from Azure (object.uri):', uriValue);
            try {
              const { data, error } = await supabase.functions.invoke('azure-fetch-image', {
                body: { azure_uri: uriValue },
              });
              if (error) {
                console.error('[extractImage] Azure fetch error:', error);
                return null;
              }
              if (!data?.base64) {
                console.error('[extractImage] Azure response missing base64:', data);
                return null;
              }
              console.log('[extractImage] Azure fetch success, base64 length:', data.base64.length);
              return `data:${data.content_type || 'image/jpeg'};base64,${data.base64}`;
            } catch (fetchError) {
              console.error('[extractImage] Azure fetch threw:', fetchError);
              return null;
            }
          }
        }
        
        // Check for direct azure:// string
        if (typeof imageField === 'string' && imageField.startsWith('azure://')) {
          console.log('[extractImage] Fetching image from Azure (string):', imageField.substring(0, 60));
          try {
            const { data, error } = await supabase.functions.invoke('azure-fetch-image', {
              body: { azure_uri: imageField },
            });
            if (error) {
              console.error('[extractImage] Azure fetch error:', error);
              return null;
            }
            if (!data?.base64) {
              console.error('[extractImage] Azure response missing base64:', data);
              return null;
            }
            console.log('[extractImage] Azure fetch success, base64 length:', data.base64.length);
            return `data:${data.content_type || 'image/jpeg'};base64,${data.base64}`;
          } catch (fetchError) {
            console.error('[extractImage] Azure fetch threw:', fetchError);
            return null;
          }
        }
        
        // Check for direct base64 string
        if (typeof imageField === 'string') {
          console.log('[extractImage] Using direct string, length:', imageField.length);
          return imageField.startsWith('data:') ? imageField : `data:image/jpeg;base64,${imageField}`;
        }
        
        console.log('[extractImage] No valid image found');
        return null;
      };
      
      // Extract images based on pipeline structure
      let fluxResult: string | null = null;
      let geminiResult: string | null = null;
      let outputMaskImage: string | null = null;
      let outputMaskGeminiImage: string | null = null;
      let transformedInputMaskImage: string | null = null;
      
      if (hasAllJewelryNodes) {
        // ALL_JEWELRY pipeline: array-indexed nodes
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
        outputMaskImage = await extractImage(maskInvertFinalNode, 'mask_base64')
          || await extractImage(maskInvertFinalNode, 'mask');
        outputMaskGeminiImage = outputMaskImage;
        
        transformedInputMaskImage = await extractImage(transformMaskNode, 'mask_base64')
          || await extractImage(transformMaskNode, 'image_base64');
          
        console.log('[Generation] ALL_JEWELRY mask extraction:', {
          hasOutputMask: !!outputMaskImage,
          hasTransformedInputMask: !!transformedInputMaskImage,
        });
        
      } else if (hasNecklaceNodes) {
        // NECKLACE pipeline: array-indexed nodes
        console.log('[Generation] Using NECKLACE array-indexed extraction');
        
        fluxResult = await extractImage(compositeNode, 'image_base64') 
          || await extractImage(upscalerNode, 'image')
          || await extractImage(fluxFillNode, 'image');
        
        geminiResult = await extractImage(compositeGeminiNode, 'image_base64')
          || await extractImage(upscalerGeminiNode, 'image');
        
        // Extract output masks for necklace fidelity visualization
        const maskInvertGemini = (result.mask_invert_gemini as unknown[])?.[0] as Record<string, unknown> | undefined;
        const maskInvertFlux = (result.mask_invert_flux as unknown[])?.[0] as Record<string, unknown> | undefined;
        
        outputMaskGeminiImage = await extractImage(maskInvertGemini, 'mask') 
          || await extractImage(maskInvertGemini, 'mask_base64') 
          || await extractImage(maskInvertGemini, 'image_base64');
        outputMaskImage = await extractImage(maskInvertFlux, 'mask') 
          || await extractImage(maskInvertFlux, 'mask_base64') 
          || await extractImage(maskInvertFlux, 'image_base64');
      } else {
        // Fallback: try all possible extraction methods
        console.log('[Generation] Using fallback extraction, trying all nodes');
        
        // Try all_jewelry nodes first
        geminiResult = await extractImage(transformApplyNode, 'image_base64')
          || await extractImage(geminiHandInpaintNode, 'image_base64')
          || await extractImage(geminiVitonNode, 'image_base64')
          || await extractImage(compositeAllJewelryNode, 'image_base64');
        fluxResult = geminiResult;
        
        // Then try necklace nodes
        if (!fluxResult) {
          fluxResult = await extractImage(compositeNode, 'image_base64') 
            || await extractImage(upscalerNode, 'image')
            || await extractImage(fluxFillNode, 'image');
        }
        if (!geminiResult) {
          geminiResult = await extractImage(compositeGeminiNode, 'image_base64')
            || await extractImage(upscalerGeminiNode, 'image');
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
      
      // Extract quality metrics from backend
      // Both pipelines use array-indexed: result.quality_metrics[0]
      const qualityMetricsNode = (result.quality_metrics as unknown[])?.[0] as Record<string, unknown> | undefined;
      const qualityMetricsGeminiNode = (result.quality_metrics_gemini as unknown[])?.[0] as Record<string, unknown> | undefined;
      
      // Use backend metrics if we didn't calculate them
      if (!calculatedMetrics && qualityMetricsNode && qualityMetricsNode.precision !== undefined) {
        calculatedMetrics = {
          precision: qualityMetricsNode.precision as number,
          recall: qualityMetricsNode.recall as number,
          iou: qualityMetricsNode.iou as number,
          growthRatio: qualityMetricsNode.growth_ratio as number,
        };
        console.log('[Generation] Using backend metrics:', calculatedMetrics);
      }
      
      if (!calculatedMetricsGemini) {
        // For all_jewelry, gemini metrics = main metrics (only one output)
        const metricsSource = hasAllJewelryNodes ? qualityMetricsNode : qualityMetricsGeminiNode;
        if (metricsSource && metricsSource.precision !== undefined) {
          calculatedMetricsGemini = {
            precision: metricsSource.precision as number,
            recall: metricsSource.recall as number,
            iou: metricsSource.iou as number,
            growthRatio: metricsSource.growth_ratio as number,
          };
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
          hasAllJewelryNodes,
          hasNecklaceNodes,
          resultKeys: Object.keys(result),
        });
        throw new Error('Generation completed but no images could be extracted');
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

  const baseImage = state.maskOverlay || state.originalImage;
  console.log('[StepRefine] baseImage exists:', !!baseImage, 'maskOverlay:', !!state.maskOverlay, 'originalImage:', !!state.originalImage);

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
          <Button size="default" className="px-6" onClick={handleGenerate}>
            <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
          </Button>
        </div>

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

              <TabsContent value="overlay" className="mt-4">
                <div className="flex justify-center">
                  <div className="relative inline-block group">
                    {baseImage ? (
                      <>
                        <MaskCanvas
                          key={canvasKey}
                          image={baseImage}
                          brushColor={brushMode === 'add' ? '#00FF00' : '#000000'}
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
                </div>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  <span className="text-green-500 font-semibold">Green</span> = Preserved • <span className="font-semibold">Black</span> = AI-generated
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
              <label className="text-sm font-medium">Brush Type</label>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={brushMode === 'add' ? 'default' : 'outline'}
                  onClick={() => setBrushMode('add')}
                  className={`justify-start h-11 ${brushMode === 'add' ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}`}
                >
                  <div className="h-4 w-4 rounded-full bg-green-500 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Add to Mask</p>
                  </div>
                </Button>
                <Button
                  variant={brushMode === 'remove' ? 'default' : 'outline'}
                  onClick={() => setBrushMode('remove')}
                  className={`justify-start h-11 ${brushMode === 'remove' ? 'bg-gray-800 hover:bg-gray-900 border-gray-800' : ''}`}
                >
                  <div className="h-4 w-4 rounded-full bg-black border-2 border-white/30 mr-3" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Remove from Mask</p>
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
