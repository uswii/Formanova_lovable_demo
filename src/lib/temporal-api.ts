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

export interface WorkflowStartRequest {
  originalImageBase64: string;
  maskPoints: MaskPoint[];
  brushStrokes?: BrushStroke[];
  sessionId?: string;
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

export interface WorkflowResult {
  fluxResultBase64: string;
  geminiResultBase64: string | null;
  fluxMetrics: FidelityMetrics;
  geminiMetrics: FidelityMetrics | null;
  fluxFidelityVizBase64: string | null;
  geminiFidelityVizBase64: string | null;
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

export const WORKFLOW_STEPS = {
  CHECKING_A100_HEALTH: { progress: 0, label: 'Pre-flight check' },
  UPLOADING_IMAGE: { progress: 5, label: 'Uploading image' },
  RESIZING_IMAGE: { progress: 15, label: 'Resizing image' },
  CHECKING_ZOOM: { progress: 20, label: 'Analyzing image' },
  REMOVING_BACKGROUND: { progress: 30, label: 'Removing background' },
  GENERATING_MASK: { progress: 45, label: 'Generating mask' },
  REFINING_MASK: { progress: 55, label: 'Refining mask' },
  GENERATING_IMAGES: { progress: 70, label: 'Generating photoshoot' },
  COMPLETED: { progress: 100, label: 'Complete' },
} as const;

export type WorkflowStep = keyof typeof WORKFLOW_STEPS;

export function getStepLabel(step: string | null): string {
  if (!step) return 'Processing...';
  const stepInfo = WORKFLOW_STEPS[step as WorkflowStep];
  return stepInfo?.label || step;
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
