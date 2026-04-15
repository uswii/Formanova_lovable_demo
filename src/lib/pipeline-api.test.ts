import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedFetch: mockAuthFetch,
  AuthExpiredError: class AuthExpiredError extends Error {
    constructor() {
      super('AUTH_EXPIRED');
      this.name = 'AuthExpiredError';
    }
  },
}));

function okJson(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

function notOk(status = 500, body = 'failed') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  } as unknown as Response);
}

async function importApi() {
  return import('./pipeline-api');
}

beforeEach(() => {
  vi.resetModules();
  mockAuthFetch.mockReset();
  vi.stubEnv('VITE_PIPELINE_API_URL', 'https://pipeline.example');
  vi.stubEnv('VITE_PIPELINE_ADMIN_SECRET', 'admin-secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('pipeline-api authenticated transport', () => {
  it('tenantApi uses authenticatedFetch without manually setting Authorization', async () => {
    mockAuthFetch.mockReturnValueOnce(okJson({ new_balance: 125 }));
    const { tenantApi } = await importApi();

    await tenantApi.topUpUser('external-1', 25);

    expect(mockAuthFetch).toHaveBeenCalledWith(
      'https://pipeline.example/credits/topup',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_id: 'external-1', amount: 25 }),
      }),
    );
    const [, options] = mockAuthFetch.mock.calls[0];
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('adminApi keeps X-Admin-Secret while using authenticatedFetch', async () => {
    mockAuthFetch.mockReturnValueOnce(okJson({ users: [], total: 0, page: 1, page_size: 50 }));
    const { adminApi } = await importApi();

    await adminApi.getUsers(1, 50, 'hassan');

    const [url, options] = mockAuthFetch.mock.calls[0];
    expect(url).toBe('https://pipeline.example/admin/users?page=1&page_size=50&search=hassan');
    expect(options).toEqual(expect.objectContaining({
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': 'admin-secret',
      },
    }));
  });

  it('throws a Pipeline API error on non-ok responses', async () => {
    mockAuthFetch.mockReturnValueOnce(notOk(403, 'Forbidden'));
    const { tenantApi } = await importApi();

    await expect(tenantApi.getFinancials()).rejects.toThrow('Pipeline API 403: Forbidden');
  });
});
