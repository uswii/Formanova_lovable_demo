import { describe, expect, it } from 'vitest';
import {
  buildCadEditStartBody,
  buildCadGenerationStartBody,
  CAD_EDIT_RETURN_NODES,
  CAD_GENERATION_RETURN_NODES,
} from './cad-workflows';

describe('CAD workflow request bodies', () => {
  it('builds the ring generation start body with tier pricing context', () => {
    expect(buildCadGenerationStartBody('  rose ring  ', 'gemini')).toEqual({
      payload: {
        tier: 'standard',
        prompt: 'rose ring',
        max_attempts: 3,
      },
      return_nodes: [...CAD_GENERATION_RETURN_NODES],
    });
  });

  it('builds the ring edit start body without tenant API key or OBO fields', () => {
    const body = buildCadEditStartBody(' add flowers ', 'json-source-123', 'gemini');

    expect(body).toEqual({
      payload: {
        tier: 'standard',
        max_attempts: 3,
        description: 'add flowers',
        ring_id: 'json-source-123',
        source_workflow_id: 'json-source-123',
      },
      return_nodes: [...CAD_EDIT_RETURN_NODES],
    });
    expect(body.payload).not.toHaveProperty('backend_api_key');
    expect(body.payload).not.toHaveProperty('state_on_behalf_of');
    expect(body.payload).not.toHaveProperty('state_backend_url');
  });
});
