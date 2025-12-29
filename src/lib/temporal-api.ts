// Temporal Workflow API Client
// Connects to Temporal orchestrator for jewelry generation pipeline

import { supabase } from '@/integrations/supabase/client';

// Use Supabase edge function proxy to reach Temporal API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const getProxyUrl = (endpoint: string) => 
  `${SUPABASE_URL}/functions/v1/temporal-proxy?endpoint=${encodeURIComponent(endpoint)}`;

// ========== Types ==========

export interface MaskPoint {
  x: number;        // 0-1 normalized
  y: number;        // 0-1 normalized
  label: 0 | 1;     // 0=background, 1=foreground
}

export interface BrushStroke {
  points: Array<{ x: number; y: number }>;
  mode: 'add' | 'remove';
  size?: number;    // 1-100, default 20
}

// ========== Preprocessing Workflow (Step 1) ==========
// Upload → Resize → Zoom Check → Background Removal → SAM3 Mask

export interface PreprocessingRequest {
  originalImageBase64: string;
  maskPoints: MaskPoint[];        // User's marked points for SAM3
}

export interface PreprocessingResult {
  resizedImageBase64: string;     // Resized to 2000x2667
  resizedUri: string;             // Azure URI of resized image
  maskBase64: string;             // Binary mask from SAM3
  maskOverlayBase64: string;      // Mask overlay preview
  backgroundRemoved: boolean;     // Whether bg was removed
  padding: { top: number; bottom: number; left: number; right: number };
  sessionId: string;              // For later generation
  scaledPoints: number[][];       // Points scaled to image dimensions
}

// ========== Generation Workflow (Step 2) ==========
// Apply Refinements → Generate Flux/Gemini

export interface GenerationRequest {
  sessionId: string;              // From preprocessing
  resizedImageBase64: string;     // From preprocessing
  maskBase64: string;             // From preprocessing (or refined)
  brushStrokes?: BrushStroke[];   // User refinements
  gender?: 'female' | 'male';
  scaledPoints?: number[][];      // Original points
}

export interface WorkflowStartResponse {
  workflowId: string;
  status: 'RUNNING';
}

export interface FidelityMetrics {
  precision: number;
  recall: number;
  iou: number;
  growthRatio: number;
}

export interface GenerationResult {
  fluxResultBase64: string;
  geminiResultBase64: string | null;
  fluxMetrics: FidelityMetrics;
  geminiMetrics: FidelityMetrics | null;
  fluxFidelityVizBase64: string | null;
  geminiFidelityVizBase64: string | null;
  refinedMaskBase64?: string;     // If brush strokes were applied
}

// Legacy combined workflow (kept for compatibility)
export interface WorkflowStartRequest {
  originalImageBase64: string;
  maskPoints: MaskPoint[];
  brushStrokes?: BrushStroke[];
  gender?: 'female' | 'male';
  sessionId?: string;
}

export interface WorkflowResult {
  fluxResultBase64: string;
  geminiResultBase64: string | null;
  fluxMetrics: FidelityMetrics;
  geminiMetrics: FidelityMetrics | null;
  fluxFidelityVizBase64: string | null;
  geminiFidelityVizBase64: string | null;
  maskBase64?: string;
  maskOverlayBase64?: string;
  backgroundRemoved?: boolean;
}

export interface WorkflowError {
  code: 'A100_UNAVAILABLE' | 'ML_SERVICE_UNAVAILABLE' | 'WORKFLOW_FAILED';
  message: string;
  failedStep: string;
}

export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface WorkflowStatusResponse {
  workflowId: string;
  status: WorkflowStatus;
  progress: number | null;
  currentStep: string | null;
  result: WorkflowResult | null;
  error: WorkflowError | null;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  temporal: string;
  services: {
    a100: 'online' | 'offline';
    imageManipulator: 'online' | 'offline';
    birefnet: 'online' | 'offline';
    sam3: 'online' | 'offline';
  };
}

// ========== Workflow Steps ==========
// These match the Temporal workflow activities in the backend

export const WORKFLOW_STEPS = {
  // Pre-flight
  CHECKING_HEALTH: { progress: 0, label: 'Checking services...' },
  
  // Upload & preprocessing  
  UPLOADING_IMAGE: { progress: 5, label: 'Uploading to Azure...' },
  RESIZING_IMAGE: { progress: 12, label: 'Resizing image (2000×2667)...' },
  
  // Analysis
  CHECKING_ZOOM: { progress: 18, label: 'Analyzing zoom level...' },
  
  // Background removal (BiRefNet)
  SUBMITTING_BIREFNET: { progress: 22, label: 'Submitting background removal...' },
  POLLING_BIREFNET: { progress: 28, label: 'Removing background...' },
  
  // Mask generation (SAM3)
  SUBMITTING_SAM3: { progress: 38, label: 'Submitting mask generation...' },
  POLLING_SAM3: { progress: 48, label: 'Generating mask...' },
  
  // Refinement
  REFINING_MASK: { progress: 55, label: 'Applying refinements...' },
  
  // Final generation (A100)
  GENERATING_FLUX: { progress: 65, label: 'Generating photoshoot (Flux)...' },
  GENERATING_GEMINI: { progress: 85, label: 'Generating photoshoot (Gemini)...' },
  
  // Post-processing
  CALCULATING_METRICS: { progress: 95, label: 'Calculating fidelity metrics...' },
  
  // Done
  COMPLETED: { progress: 100, label: 'Complete!' },
} as const;

export type WorkflowStep = keyof typeof WORKFLOW_STEPS;

export function getStepLabel(step: string | null): string {
  if (!step) return 'Starting workflow...';
  const stepInfo = WORKFLOW_STEPS[step as WorkflowStep];
  return stepInfo?.label || step.replace(/_/g, ' ').toLowerCase();
}

export function getStepProgress(step: string | null): number {
  if (!step) return 0;
  const stepInfo = WORKFLOW_STEPS[step as WorkflowStep];
  return stepInfo?.progress ?? 0;
}

// ========== API Client ==========

class TemporalApi {
  private getAuthHeaders(): Record<string, string> {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    };
  }

  async checkHealth(): Promise<HealthResponse | null> {
    try {
      const response = await fetch(getProxyUrl('/health'), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        return await response.json();
      }
      console.error('Temporal health check failed:', response.status);
      return null;
    } catch (error) {
      console.error('Temporal health check error:', error);
      return null;
    }
  }

  // ========== Preprocessing Workflow (Step 1) ==========
  // Upload → Resize → Zoom Check → Background Removal → SAM3 Mask
  async startPreprocessing(request: PreprocessingRequest): Promise<WorkflowStartResponse> {
    const response = await fetch(getProxyUrl('/workflow/preprocess'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start preprocessing: ${error}`);
    }

    return await response.json();
  }

  // ========== Generation Workflow (Step 2) ==========
  // Apply Refinements → Generate Flux/Gemini
  async startGeneration(request: GenerationRequest): Promise<WorkflowStartResponse> {
    const response = await fetch(getProxyUrl('/workflow/generate'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start generation: ${error}`);
    }

    return await response.json();
  }

  // Legacy: Combined workflow (kept for compatibility)
  async startWorkflow(request: WorkflowStartRequest): Promise<WorkflowStartResponse> {
    const response = await fetch(getProxyUrl('/workflow/start'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start workflow: ${error}`);
    }

    return await response.json();
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse> {
    const response = await fetch(getProxyUrl(`/workflow/${workflowId}`), {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      const error = await response.text();
      throw new Error(`Failed to get workflow status: ${error}`);
    }

    return await response.json();
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    const response = await fetch(getProxyUrl(`/workflow/${workflowId}/cancel`), {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to cancel workflow: ${error}`);
    }
  }
}

export const temporalApi = new TemporalApi();

// ========== Polling Helper ==========

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (status: WorkflowStatusResponse) => void;
}

export async function pollWorkflowUntilComplete(
  workflowId: string,
  options: PollOptions = {}
): Promise<WorkflowStatusResponse> {
  const {
    intervalMs = 2000,
    timeoutMs = 300000, // 5 minutes
    onProgress,
  } = options;

  const startTime = Date.now();

  while (true) {
    const status = await temporalApi.getWorkflowStatus(workflowId);

    onProgress?.(status);

    if (status.status === 'COMPLETED') {
      return status;
    }

    if (status.status === 'FAILED') {
      throw new Error(status.error?.message || 'Workflow failed');
    }

    if (status.status === 'CANCELLED') {
      throw new Error('Workflow was cancelled');
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Workflow timed out');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
