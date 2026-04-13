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
 * Returns 'success' for any terminal node, including failed_final, so callers
 * can fetch /result and decide whether a failed workflow has a usable fallback.
 * Returns null when no terminal node is detected (keep polling).
 */
export function resolveCadTerminalNode(statusData: unknown): 'success' | 'failure' | null {
  const d = statusData as {
    runtime?: { active_nodes?: string[]; last_exit_node_id?: string; state?: string };
  };
  const activeNode = d.runtime?.active_nodes?.[0] || "";
  const lastExitNode = d.runtime?.last_exit_node_id || "";
  const state = (d.runtime?.state || "").toLowerCase();

  if (state === "failed" || state === "budget_exhausted" || state === "failure") return 'failure';
  if (state === "completed" || state === "succeeded" || state === "success") return 'success';

  if (!TERMINAL_NODES.has(activeNode) && !TERMINAL_NODES.has(lastExitNode)) return null;

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
 * When failed_final is present, only build_initial is allowed as a fallback.
 * Otherwise, success sinks are preferred, with build nodes available for edit
 * workflows that do not emit success sinks.
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

  const successFinalArr = result["success_final"] as
    | Array<{ glb_artifact?: CadGlbArtifact; original_glb_artifact?: CadGlbArtifact }>
    | undefined;
  const successOriginalArr = result["success_original_glb"] as
    | Array<{ original_glb_artifact?: CadGlbArtifact }>
    | undefined;
  const buildRetryArr = result["build_retry"] as
    | Array<{ glb_artifact?: CadGlbArtifact; original_glb_artifact?: CadGlbArtifact }>
    | undefined;
  const buildInitialArr = result["build_initial"] as
    | Array<{ glb_artifact?: CadGlbArtifact; original_glb_artifact?: CadGlbArtifact }>
    | undefined;
  const buildInitialArtifact =
    buildInitialArr?.[0]?.glb_artifact ||
    buildInitialArr?.[0]?.original_glb_artifact;
  const successArtifact =
    successFinalArr?.[0]?.glb_artifact ||
    successFinalArr?.[0]?.original_glb_artifact ||
    successOriginalArr?.[0]?.original_glb_artifact;

  if (successArtifact?.uri) return { glb_url: successArtifact.uri, artifact: successArtifact };

  const hasFailed =
    Array.isArray(result["failed_final"]) &&
    (result["failed_final"] as unknown[]).length > 0;
  if (hasFailed) {
    if (buildInitialArtifact?.uri) return { glb_url: buildInitialArtifact.uri, artifact: buildInitialArtifact };
    throw new Error("No valid CAD model produced");
  }

  const artifact =
    buildRetryArr?.[0]?.glb_artifact ||
    buildRetryArr?.[0]?.original_glb_artifact ||
    buildInitialArtifact;

  if (!artifact?.uri) throw new Error(`No GLB model found in ${context} results`);
  return { glb_url: artifact.uri, artifact };
}
