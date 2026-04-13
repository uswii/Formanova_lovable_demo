/**
 * Frontend feature flags for gating features to specific users.
 * This is a UI-only gate — not a security boundary.
 */

export function isCADEnabled(_userEmail: string | undefined | null): boolean {
  return true;
}

/**
 * Toggle to show/hide the AI model quality selector
 * in the Text-to-CAD studio. When false, defaults to 'gemini' (Lite).
 * Set to true to re-enable model selection.
 */
export const CAD_MODEL_SELECTOR_ENABLED = false;

/**
 * Users allowed to see the weight estimation + STL export tools.
 */
const WEIGHT_STL_EMAILS = ['uswa@raresense.so'];

export function isWeightStlEnabled(email: string | undefined | null): boolean {
  if (!email) return false;
  return WEIGHT_STL_EMAILS.includes(email.toLowerCase());
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
const CAD_UPLOAD_EMAILS = ['uswa@raresense.so', 'abdullah@raresense.so'];

export function isCadUploadEnabled(email: string | undefined | null): boolean {
  if (!email) return false;
  return CAD_UPLOAD_EMAILS.includes(email.toLowerCase());
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
  if (!email) return false;
  return email.toLowerCase() === 'uswa@raresense.so';
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
const STUDIO_ONBOARDING_EMAILS = ['uswa@raresense.so'];

export function isStudioOnboardingEnabled(email: string | undefined | null): boolean {
  return true;
}

/**
 * Pre-selection screen at /studio — choose Model Shot or Product Shot.
 */
const STUDIO_TYPE_SELECTION_EMAILS = ['uswa@raresense.so'];

export function isStudioTypeSelectionEnabled(email: string | undefined | null): boolean {
  if (!email) return false;
  return STUDIO_TYPE_SELECTION_EMAILS.includes(email.toLowerCase());
}

/**
 * Product shot upload guide modal — shown once before the user's first product shot.
 */
const PRODUCT_SHOT_GUIDE_EMAILS = ['uswa@raresense.so'];

export function isProductShotGuideEnabled(email: string | undefined | null): boolean {
  if (!email) return false;
  return PRODUCT_SHOT_GUIDE_EMAILS.includes(email.toLowerCase());
}

/**
 * Bottom-left test menu (upload guide, product shot guide, role picker).
 */
export function isTestMenuEnabled(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === 'uswa@raresense.so';
}
