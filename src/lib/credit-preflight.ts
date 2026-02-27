// Credit Preflight Validation
// Mandatory estimation + balance check before any generation workflow

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const API_GATEWAY_URL = 'https://formanova.ai/api';

export interface PreflightResult {
  approved: boolean;
  estimatedCredits: number;
  currentBalance: number;
}

/**
 * Mandatory credit preflight check.
 * 1. Estimates the cost via POST /api/credits/estimate
 * 2. Fetches current balance via GET /api/credits/balance
 * 3. Compares and returns approval status
 *
 * AuthExpiredError is thrown automatically by authenticatedFetch on 401.
 */
export async function performCreditPreflight(
  workflowName: string,
  numVariations: number = 1
): Promise<PreflightResult> {
  // 1️⃣ Estimate required credits
  const estimateRes = await authenticatedFetch(`${API_GATEWAY_URL}/credits/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow_name: workflowName,
      num_variations: numVariations,
    }),
  });

  if (!estimateRes.ok) {
    throw new Error(`Credit estimation failed (${estimateRes.status})`);
  }

  const { estimated_credits } = await estimateRes.json();

  // 2️⃣ Fetch current balance
  const balanceRes = await authenticatedFetch(`${API_GATEWAY_URL}/credits/balance`);

  if (!balanceRes.ok) {
    throw new Error(`Balance fetch failed (${balanceRes.status})`);
  }

  const { balance } = await balanceRes.json();

  // 3️⃣ Compare
  return {
    approved: balance >= estimated_credits,
    estimatedCredits: estimated_credits,
    currentBalance: balance,
  };
}
