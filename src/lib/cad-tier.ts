export const CAD_GENERATION_TIER = 'standard';

/**
 * Backend CAD generation now prices and starts workflows by tier.
 * The current frontend model selector is legacy UI state, so keep the
 * gateway contract stable until product reintroduces real tier selection.
 */
export function resolveCadGenerationTier(_model?: string | null): string {
  return CAD_GENERATION_TIER;
}
