import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  Paintbrush, 
  Sparkles, 
  PlayCircle,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StepUploadMark } from '@/components/studio/StepUploadMark';
import { StepRefineMask } from '@/components/studio/StepRefineMask';
import { StepGenerate } from '@/components/studio/StepGenerate';
import { ServerOffline } from '@/components/studio/ServerOffline';
import { useA100Status } from '@/hooks/use-a100-status';

export type StudioStep = 'upload' | 'refine' | 'generate';

export interface StudioState {
  originalImage: string | null;
  markedImage: string | null;
  maskOverlay: string | null;
  maskBinary: string | null;
  originalMask: string | null; // Original SAM mask before edits
  editedMask: string | null;
  gender: 'female' | 'male';
  fluxResult: string | null;
  geminiResult: string | null;
  fidelityViz: string | null;
  metrics: {
    precision: number;
    recall: number;
    iou: number;
    growthRatio: number;
  } | null;
  status: 'good' | 'bad' | null;
  isGenerating: boolean;
  sessionId: string | null;
  scaledPoints: number[][] | null; // For fidelity analysis
}

export default function Studio() {
  const { user, loading } = useAuth();
  const { isOnline, isChecking, retry } = useA100Status();
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
    metrics: null,
    status: null,
    isGenerating: false,
    sessionId: null,
    scaledPoints: null,
  });

  if (loading || isOnline === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const updateState = (updates: Partial<StudioState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const stepConfig = [
    { id: 'upload' as const, label: 'Upload & Mark', icon: Upload, step: 1 },
    { id: 'refine' as const, label: 'Refine Mask', icon: Paintbrush, step: 2 },
    { id: 'generate' as const, label: 'Generate', icon: Sparkles, step: 3 },
  ];

  return (
    <div className="min-h-screen formanova-gradient relative overflow-hidden">
      {/* Theme-specific decorative elements */}
      <div className="theme-decorations pointer-events-none" />
      
      <div className="px-3 py-6 relative z-10">
        {/* Step Progress with integrated notice */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          {/* Compact Necklace Notice */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm">
            <span className="text-primary font-medium">💎 Necklaces Only</span>
            <span className="text-muted-foreground hidden sm:inline">•</span>
            <Button 
              variant="link" 
              size="sm" 
              className="h-auto p-0 text-primary hover:text-primary/80"
              asChild
            >
              <Link to="/tutorial">
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                Tutorial
              </Link>
            </Button>
          </div>
        </div>

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
                <step.icon className="h-4 w-4" />
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
          {!isOnline ? (
            <ServerOffline onRetry={retry} isChecking={isChecking} />
          ) : (
            <>
              {currentStep === 'upload' && (
                <StepUploadMark 
                  state={state} 
                  updateState={updateState}
                  onNext={() => setCurrentStep('refine')}
                />
              )}
              
              {currentStep === 'refine' && (
                <StepRefineMask 
                  state={state} 
                  updateState={updateState}
                  onNext={() => setCurrentStep('generate')}
                  onBack={() => setCurrentStep('upload')}
                />
              )}
              
              {currentStep === 'generate' && (
                <StepGenerate 
                  state={state} 
                  updateState={updateState}
                  onBack={() => setCurrentStep('refine')}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}