import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Upload, 
  Sparkles, 
} from 'lucide-react';
import { StepUploadMark } from '@/components/studio/StepUploadMark';
import { StepRefineAndGenerate } from '@/components/studio/StepRefineAndGenerate';

export type StudioStep = 'upload' | 'generate';

export interface ProcessingState {
  resizedUri?: string;
  bgRemovedUri?: string;
  maskUri?: string;  // Azure URI of the generated mask
  overlayUri?: string;  // Azure URI of the overlay
  padding?: { top: number; bottom: number; left: number; right: number };
  // A100 API fields
  originalMaskBase64?: string;
  scaledPoints?: number[][];
  sessionId?: string;
  imageWidth?: number;
  imageHeight?: number;
}

// Masking outputs from agentic_masking step - used to skip re-masking in generation
export interface MaskingOutputs {
  resizedImage?: string;      // resized_image_base64 - the resized/padded image
  jewelrySegment?: string;    // jewelry_segment_base64 - extracted jewelry segment
  jewelryGreen?: string;      // jewelry_green_base64 - green overlay
  resizeMetadata?: Record<string, unknown>;  // Pass resize_metadata as-is from backend
}

export type SkinTone = 'light' | 'fair' | 'medium' | 'olive' | 'brown' | 'dark';

export interface StudioState {
  originalImage: string | null;
  markedImage: string | null;
  maskOverlay: string | null;
  maskBinary: string | null;
  originalMask: string | null;
  editedMask: string | null;
  gender: 'female' | 'male';
  skinTone: SkinTone;
  fluxResult: string | null;
  geminiResult: string | null;
  fidelityViz: string | null;
  fidelityVizGemini: string | null;
  metrics: {
    precision: number;
    recall: number;
    iou: number;
    growthRatio: number;
  } | null;
  metricsGemini: {
    precision: number;
    recall: number;
    iou: number;
    growthRatio: number;
  } | null;
  status: 'good' | 'bad' | null;
  isGenerating: boolean;
  sessionId: string | null;
  scaledPoints: number[][] | null;
  processingState: ProcessingState;
  redDots: { x: number; y: number }[];
  hasTwoModes: boolean;  // true for necklace (has Standard + Enhanced), false for others
  workflowResults: Record<string, unknown> | null;  // Raw DAG output for debug view
  workflowType: 'flux_gen' | 'all_jewelry' | 'masking' | 'all_jewelry_masking' | null;  // Which pipeline was used
  maskingOutputs: MaskingOutputs | null;  // Cached masking outputs to skip re-masking
}

export default function JewelryStudio() {
  const { type } = useParams<{ type: string }>();
  const [currentStep, setCurrentStep] = useState<StudioStep>('upload');
  const [state, setState] = useState<StudioState>({
    originalImage: null,
    markedImage: null,
    maskOverlay: null,
    maskBinary: null,
    originalMask: null,
    editedMask: null,
    gender: 'female',
    skinTone: 'medium',
    fluxResult: null,
    geminiResult: null,
    fidelityViz: null,
    fidelityVizGemini: null,
    metrics: null,
    metricsGemini: null,
    status: null,
    isGenerating: false,
    sessionId: null,
    scaledPoints: null,
    processingState: {},
    redDots: [],
    hasTwoModes: false,
    workflowResults: null,
    workflowType: null,
    maskingOutputs: null,
  });

  const jewelryType = type || 'necklace';

  const updateState = (updates: Partial<StudioState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const stepConfig = [
    { id: 'upload' as const, label: 'Upload & Mark', icon: Upload, step: 1 },
    { id: 'generate' as const, label: 'Refine & Generate', icon: null, step: 2 },
  ];


  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="px-6 md:px-12 py-8 relative z-10">
        {/* Step Progress */}
        <div className="flex items-center justify-center mb-6">
          {stepConfig.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => {
                  // Only allow going back, not forward (unless step is complete)
                  if (stepConfig.findIndex(s => s.id === step.id) <= stepConfig.findIndex(s => s.id === currentStep)) {
                    setCurrentStep(step.id);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  currentStep === step.id
                    ? 'bg-primary text-primary-foreground'
                    : stepConfig.findIndex(s => s.id === step.id) < stepConfig.findIndex(s => s.id === currentStep)
                    ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <div className="h-6 w-6 rounded-full bg-current/20 flex items-center justify-center text-sm font-bold">
                  {step.step}
                </div>
                {step.icon && <step.icon className="h-4 w-4" />}
                <span className="hidden sm:inline font-medium">{step.label}</span>
              </button>
              {index < stepConfig.length - 1 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  stepConfig.findIndex(s => s.id === currentStep) > index
                    ? 'bg-primary'
                    : 'bg-muted'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="grid lg:grid-cols-1 gap-6">
          {currentStep === 'upload' && (
            <StepUploadMark 
              state={state} 
              updateState={updateState}
              onNext={() => setCurrentStep('generate')}
              jewelryType={jewelryType}
            />
          )}
          
          {currentStep === 'generate' && (
            <StepRefineAndGenerate 
              state={state} 
              updateState={updateState}
              onBack={() => setCurrentStep('upload')}
              jewelryType={jewelryType}
            />
          )}
        </div>
      </div>
    </div>
  );
}