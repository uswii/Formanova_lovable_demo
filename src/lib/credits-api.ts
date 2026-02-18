// Credits API client - routes through edge function proxy

const API_GATEWAY_URL = 'https://formanova.ai/api';

import { getStoredToken } from '@/lib/auth-api';

export const TOOL_COSTS: Record<string, number> = {
  from_photo: 3,
  cad_generation: 5,
};

export interface CreditBalance {
  balance: number;
  reserved_balance: number;
  available: number;
}

export async function getUserCredits(): Promise<CreditBalance> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  // Step 1: Fetch authenticated user profile to get internal_user_id
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const profileResponse = await fetch(`${SUPABASE_URL}/functions/v1/auth-proxy/users/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!profileResponse.ok) {
    throw new Error('Failed to fetch user profile');
  }

  const profile = await profileResponse.json();
  const internalUserId = profile.id;
  if (!internalUserId) throw new Error('No internal user ID found in profile');

  // Step 2: Fetch balance using internal_user_id
  const response = await fetch(`${API_GATEWAY_URL}/credits/balance/${internalUserId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch credits');
  }

  return await response.json();
}

export async function startCheckout(tierName: string, userId: string): Promise<string> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_GATEWAY_URL}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      tier: tierName,
      user_id: userId,
    }),
  });

  if (!response.ok) {
    throw new Error('Checkout session creation failed');
  }

  const { url } = await response.json();
  if (!url) throw new Error('No checkout URL received');
  return url;
}
