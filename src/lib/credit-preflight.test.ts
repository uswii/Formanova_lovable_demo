import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedFetch: mockAuthFetch,
}));

import { performCreditPreflight } from './credit-preflight';

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe('performCreditPreflight', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
  });

  it('sends CAD tier pricing context instead of legacy llm context', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(okJson({ projected_max_hold: 85 }))
      .mockResolvedValueOnce(okJson({ available: 100 }));

    const result = await performCreditPreflight('ring_generate_v1', 1, { model: 'gemini' });

    expect(result).toEqual({ approved: true, estimatedCredits: 85, currentBalance: 100 });
    expect(mockAuthFetch).toHaveBeenNthCalledWith(1, '/api/credits/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_name: 'ring_generate_v1',
        num_variations: 1,
        pricing_context: { tier: 'standard' },
      }),
    });

    const estimateBody = JSON.parse(mockAuthFetch.mock.calls[0][1].body);
    expect(estimateBody.pricing_context).not.toHaveProperty('llm');
  });

  it('estimates ring edit credits with the ring_edit_v1 workflow name', async () => {
    mockAuthFetch
      .mockResolvedValueOnce(okJson({ projected_max_hold: 85 }))
      .mockResolvedValueOnce(okJson({ available: 100 }));

    const result = await performCreditPreflight('ring_edit_v1', 1, { model: 'gemini' });

    expect(result).toEqual({ approved: true, estimatedCredits: 85, currentBalance: 100 });
    expect(mockAuthFetch).toHaveBeenNthCalledWith(1, '/api/credits/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_name: 'ring_edit_v1',
        num_variations: 1,
        pricing_context: { tier: 'standard' },
      }),
    });
  });
});
