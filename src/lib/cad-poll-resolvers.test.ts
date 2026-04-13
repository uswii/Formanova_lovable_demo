/**
 * Tests for cad-poll-resolvers.ts
 *
 * Covers all cases documented in docs/CAD_GENERATION_POLLING_MIGRATION_PLAN.md
 * sections 7 and 9.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCadTerminalNode,
  resolveCadProgressNode,
  parseCadResult,
} from './cad-poll-resolvers';

// ---------------------------------------------------------------------------
// resolveCadTerminalNode
// ---------------------------------------------------------------------------

describe('resolveCadTerminalNode', () => {

  it('returns success when active node is success_final', () => {
    expect(resolveCadTerminalNode({
      runtime: { active_nodes: ['success_final'] },
    })).toBe('success');
  });

  it('returns success when active node is success_original_glb', () => {
    expect(resolveCadTerminalNode({
      runtime: { active_nodes: ['success_original_glb'] },
    })).toBe('success');
  });

  it('returns success when last exit node is success_original_glb', () => {
    expect(resolveCadTerminalNode({
      runtime: { last_exit_node_id: 'success_original_glb' },
    })).toBe('success');
  });

  it('returns failure when active node is failed_final', () => {
    expect(resolveCadTerminalNode({
      runtime: { active_nodes: ['failed_final'] },
    })).toBe('failure');
  });

  it('returns failure when last exit node is failed_final', () => {
    expect(resolveCadTerminalNode({
      runtime: { last_exit_node_id: 'failed_final' },
    })).toBe('failure');
  });

  it('returns success when runtime state is completed', () => {
    expect(resolveCadTerminalNode({
      runtime: { state: 'completed', last_exit_node_id: 'build_retry' },
    })).toBe('success');
  });

  it('returns success when runtime state is succeeded', () => {
    expect(resolveCadTerminalNode({
      runtime: { state: 'succeeded' },
    })).toBe('success');
  });

  it('returns failure when runtime state is failed', () => {
    expect(resolveCadTerminalNode({
      runtime: { state: 'failed' },
    })).toBe('failure');
  });

  it('returns null for a non-terminal active node', () => {
    expect(resolveCadTerminalNode({
      runtime: { active_nodes: ['build_initial'] },
    })).toBeNull();
  });

  it('returns null when runtime is absent', () => {
    expect(resolveCadTerminalNode({})).toBeNull();
  });

  it('returns null for empty runtime', () => {
    expect(resolveCadTerminalNode({ runtime: {} })).toBeNull();
  });

  it('active node takes priority over non-terminal last exit', () => {
    expect(resolveCadTerminalNode({
      runtime: { active_nodes: ['success_final'], last_exit_node_id: 'build_initial' },
    })).toBe('success');
  });

  it('active node failed_final takes priority over success last exit', () => {
    expect(resolveCadTerminalNode({
      runtime: { active_nodes: ['failed_final'], last_exit_node_id: 'success_final' },
    })).toBe('failure');
  });

});

// ---------------------------------------------------------------------------
// resolveCadProgressNode
// ---------------------------------------------------------------------------

describe('resolveCadProgressNode', () => {

  it('returns node from active_nodes when present', () => {
    expect(resolveCadProgressNode({
      runtime: { active_nodes: ['build_initial'] },
    })).toEqual({ node: 'build_initial', retryCount: 0 });
  });

  it('returns node from last_exit_node_id when no active node', () => {
    expect(resolveCadProgressNode({
      runtime: { last_exit_node_id: 'validate_output' },
    })).toEqual({ node: 'validate_output', retryCount: 0 });
  });

  it('active node takes priority over last exit node', () => {
    expect(resolveCadProgressNode({
      runtime: { active_nodes: ['build_retry'], last_exit_node_id: 'build_initial' },
    })).toEqual({ node: 'build_retry', retryCount: 0 });
  });

  it('reads retryCount from node_visit_seq.generate_fix', () => {
    expect(resolveCadProgressNode({
      runtime: { active_nodes: ['generate_fix'] },
      node_visit_seq: { generate_fix: 2 },
    })).toEqual({ node: 'generate_fix', retryCount: 2 });
  });

  it('returns null when neither active node nor last exit is populated', () => {
    expect(resolveCadProgressNode({ runtime: {} })).toBeNull();
  });

  it('returns null when runtime is absent', () => {
    expect(resolveCadProgressNode({})).toBeNull();
  });

  it('returns retryCount 0 when node_visit_seq is absent', () => {
    expect(resolveCadProgressNode({
      runtime: { active_nodes: ['build_initial'] },
    })).toEqual({ node: 'build_initial', retryCount: 0 });
  });

});

// ---------------------------------------------------------------------------
// parseCadResult
// ---------------------------------------------------------------------------

describe('parseCadResult', () => {

  const artifact = { uri: 'gs://bucket/model.glb', type: 'glb', bytes: 1024, sha256: 'abc' };

  it('resolves glb_url from success_final.glb_artifact', () => {
    const result = parseCadResult({
      success_final: [{ glb_artifact: artifact }],
    });
    expect(result.glb_url).toBe('gs://bucket/model.glb');
    expect(result.artifact).toEqual(artifact);
  });

  it('falls back to success_final.original_glb_artifact when glb_artifact absent', () => {
    const result = parseCadResult({
      success_final: [{ original_glb_artifact: artifact }],
    });
    expect(result.glb_url).toBe('gs://bucket/model.glb');
  });

  it('resolves from success_original_glb path when success_final absent', () => {
    const result = parseCadResult({
      success_original_glb: [{ original_glb_artifact: artifact }],
    });
    expect(result.glb_url).toBe('gs://bucket/model.glb');
  });

  it('resolves edit output from build_retry.glb_artifact', () => {
    const result = parseCadResult({
      build_retry: [{ glb_artifact: artifact }],
    }, 'edit');
    expect(result.glb_url).toBe('gs://bucket/model.glb');
  });

  it('resolves edit output from build_initial.original_glb_artifact', () => {
    const result = parseCadResult({
      build_initial: [{ original_glb_artifact: artifact }],
    }, 'edit');
    expect(result.glb_url).toBe('gs://bucket/model.glb');
  });

  it('success_final takes priority over success_original_glb', () => {
    const otherArtifact = { ...artifact, uri: 'gs://other.glb' };
    const result = parseCadResult({
      success_final: [{ glb_artifact: artifact }],
      success_original_glb: [{ original_glb_artifact: otherArtifact }],
    });
    expect(result.glb_url).toBe('gs://bucket/model.glb');
  });

  it('throws "No valid CAD model produced" when failed_final is present', () => {
    expect(() => parseCadResult({ failed_final: [{}] })).toThrow(
      'No valid CAD model produced',
    );
  });

  it('throws with generation context when no artifact in success_final', () => {
    expect(() => parseCadResult({ success_final: [{}] }, 'generation')).toThrow(
      'No GLB model found in generation results',
    );
  });

  it('throws with edit context when no artifact in success_final', () => {
    expect(() => parseCadResult({ success_final: [{}] }, 'edit')).toThrow(
      'No GLB model found in edit results',
    );
  });

  it('throws with generation context by default when empty result', () => {
    expect(() => parseCadResult({})).toThrow('No GLB model found in generation results');
  });

  it('does not throw on failed_final when array is empty', () => {
    // Empty failed_final array means the node was returned but not populated
    const result = parseCadResult({
      failed_final: [],
      success_final: [{ glb_artifact: artifact }],
    });
    expect(result.glb_url).toBe('gs://bucket/model.glb');
  });

});
