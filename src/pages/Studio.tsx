import React, { useState } from 'react';
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
  padding?: { top: number; bottom: number; left: number; right: number };
}

export interface StudioState {
  originalImage: string | null;
  markedImage: string | null;
  maskOverlay: string | null;
  maskBinary: string | null;
  originalMask: string | null;
  editedMask: string | null;
  gender: 'female' | 'male';
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
}

export default function Studio() {
  const [currentStep, setCurrentStep] = useState<StudioStep>('upload');
  const [state, setState] = useState<StudioState>({
    originalImage: null,
    markedImage: null,
    maskOverlay: null,
    maskBinary: null,
    originalMask: null,
    editedMask: null,
    gender: 'female',
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
  });

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
            />
          )}
          
          {currentStep === 'generate' && (
            <StepRefineAndGenerate 
              state={state} 
              updateState={updateState}
              onBack={() => setCurrentStep('upload')}
            />
          )}
        </div>
      </div>
    </div>
  );
}