// Credits API client - calls API gateway directly

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

/**
 * Single source of truth for credit balance.
 * Calls GET /credits/balance with JWT auth.
 * Returns null on 401 (caller should handle redirect).
 * Throws on network / 5xx errors.
 */
export async function fetchBalance(): Promise<CreditBalance> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_GATEWAY_URL}/credits/balance`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    const error = new Error('Unauthorized');
    (error as any).status = 401;
    throw error;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch credits');
  }

  return await response.json();
}

// Keep backward-compat alias
export const getUserCredits = fetchBalance;

export async function startCheckout(tierName: string): Promise<string> {
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
    }),
  });

  if (!response.ok) {
    throw new Error('Checkout session creation failed');
  }

  const { url } = await response.json();
  if (!url) throw new Error('No checkout URL received');
  return url;
}
