import { authenticatedFetch } from '@/lib/authenticated-fetch';

export type UserType =
  | 'jewelry_brand'
  | 'freelancer'
  | 'researcher_student'
  | 'content_creator';

const KEY_PREFIX = 'formanova_onboarding_';

export function isOnboardingComplete(userId: string): boolean {
  return localStorage.getItem(KEY_PREFIX + userId) === 'true';
}

export function markOnboardingComplete(userId: string): void {
  localStorage.setItem(KEY_PREFIX + userId, 'true');
}

/**
 * PATCH /api/user/profile — saves user_type against the authenticated user.
 * Required backend endpoint:
 *   PATCH /api/user/profile
 *   Auth: Bearer <token>
 *   Body: { "user_type": "jewelry_brand" | "freelancer" | "researcher_student" | "content_creator" }
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
