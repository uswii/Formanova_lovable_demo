import { resolveCadGenerationTier } from '@/lib/cad-tier';

export const CAD_GENERATION_WORKFLOW = 'ring_generate_v1';
export const CAD_EDIT_WORKFLOW = 'ring_edit_v1';

export const CAD_GENERATION_RETURN_NODES = [
  'build_initial',
  'build_retry',
  'build_corrected',
  'success_original_glb',
  'failed_final',
] as const;

export const CAD_EDIT_RETURN_NODES = [
  'build_initial',
  'build_retry',
  'failed_final',
] as const;

export function buildCadGenerationStartBody(prompt: string, model?: string | null) {
  return {
    payload: {
      tier: resolveCadGenerationTier(model),
      prompt: prompt.trim(),
      max_attempts: 3,
    },
    return_nodes: [...CAD_GENERATION_RETURN_NODES],
  };
}

export function buildCadEditStartBody(
  description: string,
  sourceWorkflowId: string,
  model?: string | null,
) {
  return {
    payload: {
      tier: resolveCadGenerationTier(model),
      max_attempts: 3,
      description: description.trim(),
      ring_id: sourceWorkflowId,
      source_workflow_id: sourceWorkflowId,
    },
    return_nodes: [...CAD_EDIT_RETURN_NODES],
  };
}
