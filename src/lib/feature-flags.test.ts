import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isVaultUploadLayoutEnabled,
  isCadUploadEnabled,
  isFeedbackEnabled,
  isOnboardingEnabled,
  isProductShotGuideEnabled,
  isShowAllVaultEnabled,
  isStudioOnboardingEnabled,
  isStudioTypeSelectionEnabled,
  isTestMenuEnabled,
  isWeightStlEnabled,
} from './feature-flags';

describe('feature flag allowlists', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses env allowlists for gated feature access', () => {
    vi.stubEnv('VITE_WEIGHT_STL_ALLOWLIST_EMAILS', 'maker@example.com');
    vi.stubEnv('VITE_CAD_UPLOAD_ALLOWLIST_EMAILS', 'cad@example.com');
    vi.stubEnv('VITE_SHOW_ALL_VAULT_ALLOWLIST_EMAILS', 'vault@example.com');
    vi.stubEnv('VITE_STUDIO_TYPE_SELECTION_ALLOWLIST_EMAILS', 'studio@example.com');
    vi.stubEnv('VITE_PRODUCT_SHOT_GUIDE_ALLOWLIST_EMAILS', 'guide@example.com');
    vi.stubEnv('VITE_TEST_MENU_ALLOWLIST_EMAILS', 'test@example.com');

    expect(isWeightStlEnabled('maker@example.com')).toBe(true);
    expect(isCadUploadEnabled('cad@example.com')).toBe(true);
    expect(isShowAllVaultEnabled('vault@example.com')).toBe(true);
    expect(isStudioTypeSelectionEnabled('studio@example.com')).toBe(true);
    expect(isProductShotGuideEnabled('guide@example.com')).toBe(true);
    expect(isTestMenuEnabled('test@example.com')).toBe(true);
  });

  it('normalizes comma-separated env allowlists and user email casing', () => {
    vi.stubEnv(
      'VITE_CAD_UPLOAD_ALLOWLIST_EMAILS',
      ' first@example.com, SECOND@example.com , , third@example.com ',
    );

    expect(isCadUploadEnabled('second@example.com')).toBe(true);
    expect(isCadUploadEnabled(' THIRD@example.com ')).toBe(true);
    expect(isCadUploadEnabled('missing@example.com')).toBe(false);
  });

  it('disables allowlisted gates when env values or emails are missing', () => {
    expect(isWeightStlEnabled('maker@example.com')).toBe(false);
    expect(isCadUploadEnabled(null)).toBe(false);
    expect(isShowAllVaultEnabled(undefined)).toBe(false);
  });

  it('keeps permanent non-allowlist feature flags unchanged', () => {
    expect(isVaultUploadLayoutEnabled(null)).toBe(true);
    expect(isOnboardingEnabled(null)).toBe(true);
    expect(isFeedbackEnabled(null)).toBe(true);
    expect(isStudioOnboardingEnabled(null)).toBe(true);
  });
});
