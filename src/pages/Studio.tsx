import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Upload, 
  Paintbrush, 
  Sparkles, 
  AlertTriangle, 
  PlayCircle,
  Download,
  Info,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StepUploadMark } from '@/components/studio/StepUploadMark';
import { StepRefineMask } from '@/components/studio/StepRefineMask';
import { StepGenerate } from '@/components/studio/StepGenerate';

export type StudioStep = 'upload' | 'refine' | 'generate';

export interface StudioState {
  originalImage: string | null;
  markedImage: string | null;
  maskOverlay: string | null;
  maskBinary: string | null;
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
}

export default function Studio() {
  const { user, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState<StudioStep>('upload');
  const [state, setState] = useState<StudioState>({
    originalImage: null,
    markedImage: null,
    maskOverlay: null,
    maskBinary: null,
    editedMask: null,
    gender: 'female',
    fluxResult: null,
    geminiResult: null,
    fidelityViz: null,
    metrics: null,
    status: null,
    isGenerating: false,
    sessionId: null,
  });

  if (loading) {
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
    <div className="min-h-screen formanova-gradient">
      <div className="container px-4 py-8">
        {/* Notice Banner */}
        <Alert className="mb-6 border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>💎 Currently Optimized for Necklaces Only</span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tutorial">
                <PlayCircle className="h-4 w-4 mr-2" />
                Watch Tutorial
              </Link>
            </Button>
          </AlertDescription>
        </Alert>

        {/* Step Progress */}
        <div className="flex items-center justify-center mb-8">
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
        </div>
      </div>
    </div>
  );
}
