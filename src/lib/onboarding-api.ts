import { authenticatedFetch } from '@/lib/authenticated-fetch';

export type UserType =
  | 'jewelry_brand'
  | 'freelancer'
  | 'researcher_student'
  | 'content_creator'
  | 'other';

export type UserProfile = {
  id: string;
  email: string;
  external_user_id: string;
  user_type: UserType | null;
};

const KEY_PREFIX = 'formanova_onboarding_';
const TOS_KEY_PREFIX = 'formanova_tos_';

export function isOnboardingComplete(userId: string): boolean {
  return localStorage.getItem(KEY_PREFIX + userId) === 'true';
}

export function markOnboardingComplete(userId: string): void {
  localStorage.setItem(KEY_PREFIX + userId, 'true');
}

export function isTosAgreed(userId: string): boolean {
  return localStorage.getItem(TOS_KEY_PREFIX + userId) === 'true';
}

export function markTosAgreed(userId: string): void {
  localStorage.setItem(TOS_KEY_PREFIX + userId, 'true');
}

/**
 * GET /api/user/profile — returns the current user's profile.
 * user_type is null if onboarding has not been completed.
 */
export async function getUserProfile(): Promise<UserProfile> {
  const res = await authenticatedFetch('/api/user/profile');
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  return res.json();
}

/**
 * PATCH /api/user/profile — saves user_type against the authenticated user.
 * Required backend endpoint:
 *   PATCH /api/user/profile
 *   Auth: Bearer <token>
 *   Body: { "user_type": "jewelry_brand" | "freelancer" | "researcher_student" | "content_creator" | "other" }
 *   Response 200: { "success": true }
 */
export async function saveUserType(userType: UserType): Promise<void> {
  const res = await authenticatedFetch('/api/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_type: userType }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save user type: ${res.status}`);
  }
}

/**
 * GET /api/user/agreements — returns all agreements the user has signed.
 * Returns true if tos_v1 is already signed.
 *
 *   Response 200: { "agreements": [{ "agreement_type": "tos_v1", "signed_at": "..." }] }
 */
export async function checkTosAgreement(): Promise<boolean> {
  const res = await authenticatedFetch('/api/user/agreements');
  if (!res.ok) throw new Error(`Failed to fetch agreements: ${res.status}`);
  const data = await res.json();
  return (data.agreements as { agreement_type: string; version: string }[]).some(
    (a) => a.agreement_type === 'tos' && a.version === '1.0',
  );
}

/**
 * POST /api/user/agreements — records that the user has signed tos v1.0.
 *
 *   Body: { "agreement_type": "tos", "version": "1.0" }
 *   Response 201: { "agreement_type": "tos", "version": "1.0", "signed_at": "..." }
 *   Response 200: same (idempotent — safe to call multiple times)
 */
export async function signTosAgreement(): Promise<void> {
  const res = await authenticatedFetch('/api/user/agreements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agreement_type: 'tos', version: '1.0' }),
  });
  if (!res.ok) throw new Error(`Failed to sign agreement: ${res.status}`);
}
