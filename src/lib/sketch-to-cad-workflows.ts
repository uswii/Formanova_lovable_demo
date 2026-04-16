/**
 * Sketch-to-CAD workflow constants and payload builder.
 * Workflow: sketch_generate_v1 — Sketch/photo to 3D ring
 */

import { resolveCadGenerationTier } from '@/lib/cad-tier';

export const SKETCH_TO_CAD_WORKFLOW = 'sketch_generate_v1';

export const SKETCH_TO_CAD_RETURN_NODES = [
  'generate_from_sketch',
  'build_initial',
  'build_retry',
  'validate_against_sketch',
  'build_corrected',
] as const;

export interface SketchToCadStartBody {
  payload: {
    tier: string;
    reference_image: string; // data URI: "data:image/...;base64,..."
    prompt?: string;
    max_attempts: number;
    skip_validation: boolean;
  };
  return_nodes: readonly string[];
}

export function buildSketchToCadStartBody(
  referenceImageDataUri: string,
  prompt?: string,
  model?: string | null,
): SketchToCadStartBody {
  return {
    payload: {
      tier: resolveCadGenerationTier(model),
      reference_image: referenceImageDataUri,
      ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
      max_attempts: 3,
      skip_validation: false,
    },
    return_nodes: [...SKETCH_TO_CAD_RETURN_NODES],
  };
}
