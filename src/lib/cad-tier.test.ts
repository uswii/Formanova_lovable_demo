import { describe, expect, it } from 'vitest';
import { CAD_GENERATION_TIER, resolveCadGenerationTier } from './cad-tier';

describe('CAD generation tier mapping', () => {
  it('uses the backend-supported standard tier for legacy model selections', () => {
    expect(resolveCadGenerationTier('gemini')).toBe('standard');
    expect(resolveCadGenerationTier('claude-sonnet')).toBe('standard');
    expect(resolveCadGenerationTier('claude-opus')).toBe('standard');
    expect(resolveCadGenerationTier(null)).toBe('standard');
  });

  it('exports the canonical tier value used by CAD start and estimate calls', () => {
    expect(CAD_GENERATION_TIER).toBe('standard');
  });
});
