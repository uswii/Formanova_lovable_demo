import { describe, expect, it } from 'vitest';
import {
  buildSketchToCadStartBody,
  SKETCH_TO_CAD_RETURN_NODES,
  SKETCH_TO_CAD_WORKFLOW,
} from './sketch-to-cad-workflows';

describe('sketch-to-cad workflow', () => {
  it('uses the expected return nodes', () => {
    expect(SKETCH_TO_CAD_RETURN_NODES).toEqual([
      'generate_from_sketch',
      'build_initial',
      'build_retry',
      'validate_against_sketch',
      'build_corrected',
    ]);
  });

  it('builds a start body with required fields', () => {
    const body = buildSketchToCadStartBody('data:image/jpeg;base64,abc123');
    expect(body).toEqual({
      payload: {
        tier: expect.any(String),
        reference_image: 'data:image/jpeg;base64,abc123',
        max_attempts: 3,
        skip_validation: false,
      },
      return_nodes: [...SKETCH_TO_CAD_RETURN_NODES],
    });
  });

  it('includes prompt when provided', () => {
    const body = buildSketchToCadStartBody('data:image/jpeg;base64,abc123', '  rose gold  ');
    expect(body.payload).toMatchObject({ prompt: 'rose gold' });
  });

  it('omits prompt when empty or whitespace-only', () => {
    expect(buildSketchToCadStartBody('data:image/jpeg;base64,abc123', '  ').payload)
      .not.toHaveProperty('prompt');
    expect(buildSketchToCadStartBody('data:image/jpeg;base64,abc123').payload)
      .not.toHaveProperty('prompt');
  });

  it('does not include api key or tenant fields', () => {
    const body = buildSketchToCadStartBody('data:image/jpeg;base64,abc123');
    expect(body.payload).not.toHaveProperty('backend_api_key');
    expect(body.payload).not.toHaveProperty('state_on_behalf_of');
    expect(body.payload).not.toHaveProperty('state_backend_url');
  });

  it('workflow name is a string', () => {
    expect(typeof SKETCH_TO_CAD_WORKFLOW).toBe('string');
    expect(SKETCH_TO_CAD_WORKFLOW.length).toBeGreaterThan(0);
  });
});
