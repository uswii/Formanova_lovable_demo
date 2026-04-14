/**
 * Frontend feature flags for gating features to specific users.
 * This is a UI-only gate - not a security boundary.
 */

function getAllowlist(envKey: string): string[] {
  const rawValue = import.meta.env[envKey];
  if (!rawValue || typeof rawValue !== 'string') return [];

  return rawValue
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowlistedEmail(email: string | undefined | null, envKey: string): boolean {
  if (!email) return false;
  return getAllowlist(envKey).includes(email.trim().toLowerCase());
}

export function isCADEnabled(_userEmail: string | undefined | null): boolean {
  return true;
}

/**
 * Main keeps CAD edit hidden while the API wiring is staged.
 * Remove this gate after production QA approves ring_edit_v1.
 */
export const CAD_EDIT_TOOLS_ENABLED = false;

/**
 * Toggle to show/hide the AI model quality selector
 * in the Text-to-CAD studio. When false, defaults to 'gemini' (Lite).
 * Set to true to re-enable model selection.
 */
export const CAD_MODEL_SELECTOR_ENABLED = false;

/**
 * Users allowed to see the weight estimation + STL export tools.
 */
export function isWeightStlEnabled(email: string | undefined | null): boolean {
  return isAllowlistedEmail(email, 'VITE_WEIGHT_STL_ALLOWLIST_EMAILS');
}

/**
 * Alternate two-column upload layout — enabled for all users.
 */
export function isAltUploadLayoutEnabled(_email: string | undefined | null): boolean {
  return true;
}

/**
 * Users allowed to see the "Upload CAD File" button on the initial prompt screen.
 */
export function isCadUploadEnabled(email: string | undefined | null): boolean {
  return isAllowlistedEmail(email, 'VITE_CAD_UPLOAD_ALLOWLIST_EMAILS');
}

/**
 * "What best describes you?" onboarding screen — enabled for all users.
 */
export function isOnboardingEnabled(_email: string | undefined | null): boolean {
  return true;
}

/**
 * Asset metadata (category label, inline model rename) — enabled for all users.
 */
export function isAssetMetadataEnabled(_email: string | undefined | null): boolean {
  return true;
}

/**
 * "View Guide" button on the My Products panel in the upload step.
 */
export function isViewGuideEnabled(_email: string | undefined | null): boolean {
  return true;
}

/**
 * "Show all" toggle in the jewelry vault picker — bypasses intended_use filter.
 */
export function isShowAllVaultEnabled(email: string | undefined | null): boolean {
  return isAllowlistedEmail(email, 'VITE_SHOW_ALL_VAULT_ALLOWLIST_EMAILS');
}

/**
 * Onboarding welcome screen — input quality guidelines + Terms of Service gate.
 */
export function isOnboardingWelcomeEnabled(_email: string | undefined | null): boolean {
  return false;
}

/**
 * Authenticated image fetching via blob URLs for /artifacts/ paths.
 */
export const AUTHENTICATED_IMAGES_ENABLED = true;

/**
 * "Not satisfied?" feedback widget on the result screen.
 */
export function isFeedbackEnabled(_email: string | undefined | null): boolean {
  return true;
}

/**
 * In-studio onboarding popup (multi-step) + model guide button on the model canvas.
 */
export function isStudioOnboardingEnabled(_email: string | undefined | null): boolean {
  return true;
}

/**
 * Pre-selection screen at /studio — choose Model Shot or Product Shot.
 */
export function isStudioTypeSelectionEnabled(email: string | undefined | null): boolean {
  return isAllowlistedEmail(email, 'VITE_STUDIO_TYPE_SELECTION_ALLOWLIST_EMAILS');
}

/**
 * Product shot upload guide modal — shown once before the user's first product shot.
 */
export function isProductShotGuideEnabled(email: string | undefined | null): boolean {
  return isAllowlistedEmail(email, 'VITE_PRODUCT_SHOT_GUIDE_ALLOWLIST_EMAILS');
}

/**
 * Bottom-left test menu (upload guide, product shot guide, role picker).
 */
export function isTestMenuEnabled(email: string | undefined | null): boolean {
  return isAllowlistedEmail(email, 'VITE_TEST_MENU_ALLOWLIST_EMAILS');
}
