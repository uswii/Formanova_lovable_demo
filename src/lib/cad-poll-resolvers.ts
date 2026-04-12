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

// -- Terminal node set (shared constant) --

const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);

// -- resolveCadTerminalNode --

/**
 * Returns 'success' when a success terminal node is active or last-exited.
 * Returns 'failure' when failed_final is active or last-exited.
 * Returns null when no terminal node is detected (keep polling).
 */
export function resolveCadTerminalNode(statusData: unknown): 'success' | 'failure' | null {
  const d = statusData as {
    runtime?: { active_nodes?: string[]; last_exit_node_id?: string };
  };
  const activeNode = d.runtime?.active_nodes?.[0] || "";
  const lastExitNode = d.runtime?.last_exit_node_id || "";

  if (!TERMINAL_NODES.has(activeNode) && !TERMINAL_NODES.has(lastExitNode)) return null;

  if (activeNode === "failed_final" || lastExitNode === "failed_final") return 'failure';
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
    runtime?: { active_nodes?: string[]; last_exit_node_id?: string };
    node_visit_seq?: { generate_fix?: number };
  };
  const activeNode = d.runtime?.active_nodes?.[0] || "";
  const lastExitNode = d.runtime?.last_exit_node_id || "";
  const retryCount = d.node_visit_seq?.generate_fix || 0;
  const displayNode = activeNode || lastExitNode;
  if (!displayNode) return null;
  return { node: displayNode, retryCount };
}

// -- parseCadResult --

/**
 * Parses the /api/result response for CAD generation and edit workflows.
 * Throws on failed_final or missing artifact so pollWorkflow propagates the
 * error to the caller's outer catch.
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
  const result = d as Record<string, unknown>;

  const hasFailed =
    Array.isArray(result["failed_final"]) &&
    (result["failed_final"] as unknown[]).length > 0;
  if (hasFailed) throw new Error("No valid CAD model produced");

  const successFinalArr = result["success_final"] as
    | Array<{ glb_artifact?: CadGlbArtifact; original_glb_artifact?: CadGlbArtifact }>
    | undefined;
  const successOriginalArr = result["success_original_glb"] as
    | Array<{ original_glb_artifact?: CadGlbArtifact }>
    | undefined;

  const artifact =
    successFinalArr?.[0]?.glb_artifact ||
    successFinalArr?.[0]?.original_glb_artifact ||
    successOriginalArr?.[0]?.original_glb_artifact;

  if (!artifact?.uri) throw new Error(`No GLB model found in ${context} results`);
  return { glb_url: artifact.uri, artifact };
}
