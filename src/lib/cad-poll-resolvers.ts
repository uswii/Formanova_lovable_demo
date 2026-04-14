/**
 * cad-poll-resolvers.ts
 *
 * CAD-specific resolver functions for pollWorkflow.
 * Used by the generation and edit loops in TextToCAD.tsx.
 *
 * Kept in a separate file so poll-workflow.ts stays domain-agnostic.
 */

// -- Types --

export interface CadGlbArtifact {
  uri: string;
  type: string;
  bytes: number;
  sha256: string;
}

export interface CadGenerationResult {
  glb_url: string;
  artifact: CadGlbArtifact;
}

type CadNodeValue =
  | { glb_artifact?: CadGlbArtifact; original_glb_artifact?: CadGlbArtifact }
  | Array<{ glb_artifact?: CadGlbArtifact; original_glb_artifact?: CadGlbArtifact }>
  | undefined;

// -- Terminal node set (shared constant) --

const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);

// -- resolveCadTerminalNode --

/**
 * Returns 'success' when a terminal node has exited.
 * Returns 'success' for any terminal node, including failed_final, so callers
 * can fetch /result and decide whether a failed workflow has a usable fallback.
 * Returns null when no terminal node is detected (keep polling).
 */
export function resolveCadTerminalNode(statusData: unknown): 'success' | 'failure' | null {
  const d = statusData as {
    runtime?: { active_nodes?: string[]; last_exit_node_id?: string; state?: string };
  };
  const lastExitNode = d.runtime?.last_exit_node_id || "";
  const state = (d.runtime?.state || "").toLowerCase();

  if (state === "failed" || state === "budget_exhausted" || state === "failure" || state === "terminated" || state === "cancelled" || state === "timed_out" || state === "timeout") return 'failure';
  if (state === "completed" || state === "succeeded" || state === "success") return 'success';

  if (!TERMINAL_NODES.has(lastExitNode)) return null;

  return 'success';
}

// -- resolveCadProgressNode --

/**
 * Returns the display node and retry count for onProgress callbacks.
 * Returns null when neither active_nodes nor last_exit_node_id is populated
 * (preserves the existing "only update if non-empty" behavior).
 */
export function resolveCadProgressNode(
  statusData: unknown,
): { node: string; retryCount: number } | null {
  const d = statusData as {
    runtime?: { active_nodes?: string[]; current_node?: string; last_exit_node_id?: string };
    node_visit_seq?: { generate_fix?: number };
  };
  const activeNode = d.runtime?.active_nodes?.[0] || d.runtime?.current_node || "";
  const lastExitNode = d.runtime?.last_exit_node_id || "";
  const retryCount = d.node_visit_seq?.generate_fix || 0;
  const displayNode = activeNode || lastExitNode;
  if (!displayNode) return null;
  return { node: displayNode, retryCount };
}

// -- parseCadResult --

/**
 * Parses the /api/result response for CAD generation and edit workflows.
 * Supports both the current node_results response and the legacy top-level
 * array response. Build node priority mirrors the Ring Workflows contract:
 * generation prefers build_corrected, then build_retry, then build_initial;
 * edit prefers build_retry, then build_initial.
 *
 * Error messages are neutral (not generation-specific) so they can be shown
 * in the edit outer catch's toast.error(err.message) without misleading the user.
 *
 * @param d - raw JSON from /api/result
 * @param context - 'generation' or 'edit'; used in the "no GLB found" message
 */
export function parseCadResult(
  d: unknown,
  context: 'generation' | 'edit' = 'generation',
): CadGenerationResult {
  const result = (d ?? {}) as Record<string, unknown>;
  const nodeResults =
    result.node_results && typeof result.node_results === 'object'
      ? result.node_results as Record<string, unknown>
      : undefined;

  const readArtifact = (nodeName: string): CadGlbArtifact | undefined => {
    const nodeValue = (nodeResults?.[nodeName] ?? result[nodeName]) as CadNodeValue;
    const entry = Array.isArray(nodeValue) ? nodeValue[0] : nodeValue;
    return entry?.glb_artifact || entry?.original_glb_artifact;
  };

  const buildNodePriority =
    context === 'edit'
      ? ['build_retry', 'build_initial']
      : ['build_corrected', 'build_retry', 'build_initial'];

  const legacySuccessPriority = ['success_final', 'success_original_glb'];
  const artifact = [...buildNodePriority, ...legacySuccessPriority]
    .map(readArtifact)
    .find((candidate): candidate is CadGlbArtifact => Boolean(candidate?.uri));

  if (!artifact?.uri) {
    const endNode = typeof result.end_node === 'string' ? result.end_node.toLowerCase() : '';
    const state = typeof result.state === 'string' ? result.state.toLowerCase() : '';
    const runtimeState =
      result.runtime &&
      typeof result.runtime === 'object' &&
      typeof (result.runtime as { state?: unknown }).state === 'string'
        ? ((result.runtime as { state: string }).state).toLowerCase()
        : '';
    const hasFailed =
      endNode === 'failed_final' ||
      state === 'failed' ||
      state === 'failure' ||
      runtimeState === 'failed' ||
      runtimeState === 'failure' ||
      (
        Array.isArray(result.failed_final) &&
        result.failed_final.length > 0
      );

    if (hasFailed) {
      throw new Error('CAD workflow failed before producing a usable GLB model');
    }

    throw new Error(`No GLB model found in ${context} results`);
  }

  return { glb_url: artifact.uri, artifact };
}
