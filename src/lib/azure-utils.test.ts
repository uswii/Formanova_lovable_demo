import { afterEach, describe, expect, it, vi } from 'vitest';
import { azureUriToUrl } from './azure-utils';

describe('azureUriToUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an empty string for missing input', () => {
    expect(azureUriToUrl(undefined)).toBe('');
    expect(azureUriToUrl(null)).toBe('');
    expect(azureUriToUrl('')).toBe('');
  });

  it('passes through non-azure URLs unchanged', () => {
    expect(azureUriToUrl('https://cdn.example.com/model.glb')).toBe(
      'https://cdn.example.com/model.glb',
    );
    expect(azureUriToUrl('/api/artifacts/example')).toBe('/api/artifacts/example');
  });

  it('converts azure URIs with the configured blob base URL', () => {
    vi.stubEnv('VITE_AZURE_BLOB_BASE_URL', 'https://snapwear.blob.core.windows.net');

    expect(azureUriToUrl('azure://container/path/file.png')).toBe(
      'https://snapwear.blob.core.windows.net/container/path/file.png',
    );
  });

  it('trims trailing slashes from the base URL and leading slashes from the azure path', () => {
    vi.stubEnv('VITE_AZURE_BLOB_BASE_URL', 'https://snapwear.blob.core.windows.net///');

    expect(azureUriToUrl('azure:///container/path/file.png')).toBe(
      'https://snapwear.blob.core.windows.net/container/path/file.png',
    );
  });

  it('returns an empty string for azure URIs when the configured base URL is missing or invalid', () => {
    vi.stubEnv('VITE_AZURE_BLOB_BASE_URL', '');
    expect(azureUriToUrl('azure://container/path/file.png')).toBe('');

    vi.stubEnv('VITE_AZURE_BLOB_BASE_URL', 'not-a-url');
    expect(azureUriToUrl('azure://container/path/file.png')).toBe('');
  });
});
