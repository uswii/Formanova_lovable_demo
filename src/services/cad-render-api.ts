import { authenticatedFetch } from '@/lib/authenticated-fetch';

export interface CameraAngle {
  viewName: string;
  glbArtifactUri: string;  // azure:// URI from the GLB upload step
  colorPreviewB64: string; // base64 PNG, no data: prefix
  binaryMaskB64: string;   // base64 PNG, no data: prefix
}

export interface RuntimeStateResponse {
  runtime: {
    state: 'running' | 'completed' | 'failed' | 'budget_exhausted';
    workflow_id: string;
    total_visits: number;
    queued_tokens: number;
  };
  results: {
    render_image?: Array<{
      image_artifact?: { uri: string; type: string; bytes: number };
      view_name?: string;
    }>;
  };
  pending_human_tasks: unknown[];
}

const START_ENDPOINT = '/api/run/state/cad_render_v1';
const stateEndpoint = (id: string) => `/api/runtime/state/${id}`;

export async function submitCadRenderAngle(angle: CameraAngle): Promise<string> {
  const res = await authenticatedFetch(START_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        glb_artifact: { uri: angle.glbArtifactUri },
        images: [
          { data: angle.colorPreviewB64, mime_type: 'image/png' },
          { data: angle.binaryMaskB64,   mime_type: 'image/png' },
        ],
        view_name: angle.viewName,
      },
      return_nodes: ['render_image'],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`[${res.status}] Failed to submit "${angle.viewName}": ${(body as any)?.detail ?? res.statusText}`);
  }

  const data = await res.json();
  return data.workflow_id as string;
}

// Returns null on transient errors (404, 502, 503, 504) — caller retries on next tick.
// Throws on unrecoverable errors.
export async function fetchCadRenderState(workflowId: string): Promise<RuntimeStateResponse | null> {
  const TRANSIENT = new Set([404, 502, 503, 504]);
  const res = await authenticatedFetch(stateEndpoint(workflowId));
  if (!res.ok) {
    if (TRANSIENT.has(res.status)) return null;
    throw new Error(`Unrecoverable poll error ${res.status} for workflow ${workflowId}`);
  }
  return res.json();
}
