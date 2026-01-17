/**
 * DAG Workflow API Client
 * 
 * Connects to the workflow orchestrator at http://20.173.91.22:8000/process
 * Supports 3 workflow types:
 * 1. necklace_point_masking - SAM3 mask generation for necklaces
 * 2. flux_gen_pipeline - Image generation with existing mask (necklaces)
 * 3. all_jewelry_pipeline - Complete pipeline for rings, bracelets, earrings, watches
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const getProxyUrl = (endpoint: string) =>
  `${SUPABASE_URL}/functions/v1/workflow-proxy?endpoint=${encodeURIComponent(endpoint)}`;

// ========== Types ==========

export type JewelryType = 'necklace' | 'ring' | 'bracelet' | 'earrings' | 'watch';
export type SkinTone = 'light' | 'medium' | 'dark';

export interface WorkflowStartResponse {
  workflow_id: string;
  status_url?: string;
  result_url?: string;
}

export interface WorkflowProgress {
  state: 'running' | 'completed' | 'failed';
  total_nodes: number;
  completed_nodes: number;
  visited: string[];
}

export interface WorkflowStatusResponse {
  progress: WorkflowProgress;
  results: Record<string, unknown[]>;
}

export interface WorkflowResultResponse {
  [key: string]: unknown[];
}

// ========== Workflow 1: necklace_point_masking ==========

export interface MaskingRequest {
  imageBlob: Blob;
  points: number[][];      // [[x, y], ...] in image coordinates
  pointLabels: number[];   // [1, 1, 0, ...] - 1=foreground, 0=background
}

export interface MaskingResult {
  mask_base64: string;
  mask_overlay_base64: string;
  processed_image_base64: string;
  scaled_points: number[][];
  session_id: string;
  image_width: number;
  image_height: number;
}

// ========== Workflow 2: flux_gen_pipeline ==========

export interface FluxGenRequest {
  imageBlob: Blob;
  maskBase64: string;      // Must be data:image/png;base64,... format
  prompt: string;
}

export interface FluxGenResult {
  result_base64: string;
  result_gemini_base64?: string;
  fidelity_viz_base64?: string;
  fidelity_viz_gemini_base64?: string;
  metrics?: {
    precision: number;
    recall: number;
    iou: number;
    growth_ratio: number;
  };
  metrics_gemini?: {
    precision: number;
    recall: number;
    iou: number;
    growth_ratio: number;
  };
  session_id: string;
}

// ========== Workflow 3: all_jewelry_pipeline ==========

export interface AllJewelryRequest {
  imageBlob: Blob;
  points: number[][];      // [[x, y], ...] in image coordinates
  pointLabels: number[];   // [1, 1, 0, ...] - 1=foreground, 0=background
  jewelryType: 'ring' | 'bracelet' | 'earrings' | 'watch';
  skinTone: SkinTone;
  maskBase64?: string;     // Optional: pre-edited mask (data:image/png;base64,...)
}

export interface AllJewelryResult {
  result_base64: string;
  fidelity_viz_base64?: string;
  metrics?: {
    precision: number;
    recall: number;
    iou: number;
    growth_ratio: number;
  };
  session_id: string;
}

// ========== DAG Step Labels ==========

export const MASKING_DAG_STEPS = {
  'image_manipulator': { progress: 20, label: 'Resizing image...' },
  'zoom_check': { progress: 35, label: 'Analyzing zoom level...' },
  'bg_remove': { progress: 55, label: 'Removing background...' },
  'sam3': { progress: 85, label: 'Generating mask...' },
} as const;

export const FLUX_GEN_DAG_STEPS = {
  'resize_image': { progress: 5, label: 'Resizing image...' },
  'resize_mask': { progress: 8, label: 'Resizing mask...' },
  'white_bg_segmenter': { progress: 15, label: 'Segmenting background...' },
  'flux_fill': { progress: 40, label: 'Generating with Flux...' },
  'upscaler': { progress: 55, label: 'Upscaling...' },
  'composite': { progress: 58, label: 'Compositing Flux...' },
  'output_mask': { progress: 60, label: 'Detecting output mask...' },
  'mask_invert_flux': { progress: 62, label: 'Processing mask...' },
  'quality_metrics': { progress: 64, label: 'Calculating Flux metrics...' },
  'resize_for_gemini': { progress: 68, label: 'Preparing for Gemini...' },
  'gemini_router': { progress: 70, label: 'Routing to Gemini...' },
  'gemini_refine': { progress: 80, label: 'Refining with Gemini...' },
  'upscaler_gemini': { progress: 88, label: 'Upscaling Gemini...' },
  'composite_gemini': { progress: 92, label: 'Final composite...' },
  'output_mask_gemini': { progress: 94, label: 'Detecting Gemini mask...' },
  'mask_invert_gemini': { progress: 96, label: 'Processing Gemini mask...' },
  'quality_metrics_gemini': { progress: 98, label: 'Calculating metrics...' },
} as const;

export const ALL_JEWELRY_DAG_STEPS = {
  'resize_all_jewelry': { progress: 5, label: 'Resizing image...' },
  'gemini_sketch': { progress: 12, label: 'Generating sketch...' },
  'sam3_all_jewelry': { progress: 20, label: 'Segmenting jewelry...' },
  'segment_green_bg': { progress: 28, label: 'Preparing background...' },
  'composite_all_jewelry': { progress: 35, label: 'Creating composite...' },
  'gemini_viton': { progress: 50, label: 'AI generation (VITON)...' },
  'gemini_quality_check': { progress: 55, label: 'Quality check...' },
  'output_mask_all_jewelry': { progress: 58, label: 'Detecting output mask...' },
  'mask_invert': { progress: 60, label: 'Processing mask...' },
  'transform_detect': { progress: 65, label: 'Detecting transforms...' },
  'transform_mask': { progress: 70, label: 'Transforming mask...' },
  'gemini_hand_inpaint': { progress: 78, label: 'Inpainting background...' },
  'transform_apply': { progress: 85, label: 'Applying transforms...' },
  'output_mask_final': { progress: 90, label: 'Final mask detection...' },
  'mask_invert_final': { progress: 93, label: 'Processing final mask...' },
  'quality_metrics': { progress: 98, label: 'Calculating metrics...' },
} as const;

export function getStepProgress(visited: string[], workflow: 'masking' | 'flux_gen' | 'all_jewelry'): { progress: number; label: string } {
  if (!visited || visited.length === 0) {
    return { progress: 0, label: 'Starting workflow...' };
  }

  const lastStep = visited[visited.length - 1];
  let steps: Record<string, { progress: number; label: string }>;

  switch (workflow) {
    case 'masking':
      steps = MASKING_DAG_STEPS;
      break;
    case 'flux_gen':
      steps = FLUX_GEN_DAG_STEPS;
      break;
    case 'all_jewelry':
      steps = ALL_JEWELRY_DAG_STEPS;
      break;
  }

  const stepInfo = steps[lastStep as keyof typeof steps];
  if (stepInfo) {
    return stepInfo;
  }

  return { progress: 50, label: lastStep.replace(/_/g, ' ') };
}

// ========== API Client ==========

class WorkflowApi {
  private getAuthHeaders(): Record<string, string> {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    return {
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    };
  }

  /**
   * Check health of the workflow server
   */
  async checkHealth(): Promise<{ status: string } | null> {
    try {
      const response = await fetch(getProxyUrl('/health'), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('[WorkflowApi] Health check failed:', error);
      return null;
    }
  }

  /**
   * Start necklace_point_masking workflow
   * Returns mask for necklace based on clicked points
   */
  async startMasking(request: MaskingRequest): Promise<WorkflowStartResponse> {
    const formData = new FormData();
    formData.append('file', request.imageBlob, 'image.jpg');
    formData.append('workflow_name', 'necklace_point_masking');
    formData.append('overrides', JSON.stringify({
      points: request.points,
      point_labels: request.pointLabels,
    }));

    console.log('[WorkflowApi] Starting necklace_point_masking', {
      points: request.points.length,
      pointLabels: request.pointLabels,
    });

    const response = await fetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Masking workflow failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Start flux_gen_pipeline workflow
   * Generates photoshoot for necklace with existing mask
   */
  async startFluxGen(request: FluxGenRequest): Promise<WorkflowStartResponse> {
    const formData = new FormData();
    formData.append('file', request.imageBlob, 'image.jpg');
    formData.append('workflow_name', 'flux_gen_pipeline');

    // Ensure mask is in data:image/png;base64,... format
    let maskDataUri = request.maskBase64;
    if (!maskDataUri.startsWith('data:')) {
      maskDataUri = `data:image/png;base64,${maskDataUri}`;
    }

    formData.append('overrides', JSON.stringify({
      mask: maskDataUri,
      prompt: request.prompt,
    }));

    console.log('[WorkflowApi] Starting flux_gen_pipeline', {
      prompt: request.prompt.substring(0, 50),
      maskLength: maskDataUri.length,
    });

    const response = await fetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Flux gen workflow failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Start all_jewelry_pipeline workflow
   * Complete pipeline for rings, bracelets, earrings, watches
   */
  async startAllJewelry(request: AllJewelryRequest): Promise<WorkflowStartResponse> {
    const formData = new FormData();
    formData.append('file', request.imageBlob, 'image.jpg');
    formData.append('workflow_name', 'all_jewelry_pipeline');
    
    // Build overrides - include mask if provided (user edited it)
    const overrides: Record<string, unknown> = {
      points: request.points,
      point_labels: request.pointLabels,
      jewelry_type: request.jewelryType,
      skin_tone: request.skinTone,
    };
    
    // If mask is provided, include it so DAG can skip mask generation
    if (request.maskBase64) {
      overrides.mask = request.maskBase64.startsWith('data:') 
        ? request.maskBase64 
        : `data:image/png;base64,${request.maskBase64}`;
    }
    
    formData.append('overrides', JSON.stringify(overrides));

    console.log('[WorkflowApi] Starting all_jewelry_pipeline', {
      jewelryType: request.jewelryType,
      skinTone: request.skinTone,
      points: request.points.length,
    });

    const response = await fetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`All jewelry workflow failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get status of a running workflow
   */
  async getStatus(workflowId: string): Promise<WorkflowStatusResponse> {
    const response = await fetch(getProxyUrl(`/status/${workflowId}`), {
      method: 'GET',
      headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get workflow status: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get result of a completed workflow
   */
  async getResult(workflowId: string): Promise<WorkflowResultResponse> {
    const response = await fetch(getProxyUrl(`/result/${workflowId}`), {
      method: 'GET',
      headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get workflow result: ${error}`);
    }

    return await response.json();
  }

  /**
   * Poll workflow until complete
   */
  async pollUntilComplete(
    workflowId: string,
    workflow: 'masking' | 'flux_gen' | 'all_jewelry',
    onProgress?: (progress: number, label: string) => void,
    pollInterval: number = 2000,
    maxWaitMs: number = 600000 // 10 minutes
  ): Promise<WorkflowResultResponse> {
    const startTime = Date.now();
    let lastStatus: WorkflowStatusResponse | null = null;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getStatus(workflowId);
      lastStatus = status;

      if (status.progress.visited.length > 0 && onProgress) {
        const { progress, label } = getStepProgress(status.progress.visited, workflow);
        onProgress(progress, label);
      }

      if (status.progress.state === 'completed') {
        if (onProgress) onProgress(100, 'Complete!');
        
        // Get final result
        const finalResult = await this.getResult(workflowId);
        
        // IMPORTANT: Merge status.results with finalResult
        // The status response often contains intermediate node outputs
        // that aren't in the /result endpoint (which may only return terminal nodes)
        const mergedResult = { ...finalResult };
        
        if (status.results) {
          for (const [key, value] of Object.entries(status.results)) {
            if (!mergedResult[key]) {
              console.log(`[WorkflowApi] Adding missing key from status: ${key}`);
              mergedResult[key] = value;
            }
          }
        }
        
        console.log('[WorkflowApi] Final result keys:', Object.keys(finalResult));
        console.log('[WorkflowApi] Status result keys:', status.results ? Object.keys(status.results) : 'none');
        console.log('[WorkflowApi] Merged result keys:', Object.keys(mergedResult));
        
        return mergedResult;
      }

      if (status.progress.state === 'failed') {
        throw new Error('Workflow failed');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Workflow timed out');
  }
}

export const workflowApi = new WorkflowApi();

// ========== Helper: Convert image source to Blob ==========

export async function imageSourceToBlob(src: string): Promise<Blob> {
  // Data URL
  if (src.startsWith('data:')) {
    const [header, base64] = src.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mimeType });
  }

  // URL (http, blob, or relative path)
  const response = await fetch(src);
  return await response.blob();
}

// ========== Helper: Base64 to Blob ==========

export function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mimeType });
}
