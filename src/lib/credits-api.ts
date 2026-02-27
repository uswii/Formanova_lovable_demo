// Credits API client - calls API gateway directly

const API_GATEWAY_URL = 'https://formanova.ai/api';

import { authenticatedFetch } from '@/lib/authenticated-fetch';
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
 * Throws AuthExpiredError on 401 (handled by authenticatedFetch).
 * Throws on network / 5xx errors.
 */
export async function fetchBalance(): Promise<CreditBalance> {
  const response = await authenticatedFetch(`${API_GATEWAY_URL}/credits/balance`);

  if (!response.ok) {
    throw new Error('Failed to fetch credits');
  }

  return await response.json();
}

// Keep backward-compat alias
export const getUserCredits = fetchBalance;

export async function startCheckout(tierName: string): Promise<string> {
  const response = await authenticatedFetch(`${API_GATEWAY_URL}/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: tierName }),
  });

  if (!response.ok) {
    throw new Error('Checkout session creation failed');
  }

  const { url } = await response.json();
  if (!url) throw new Error('No checkout URL received');
  return url;
}
