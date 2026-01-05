/**
 * User API - Frontend client for user/credits/payments endpoints
 * Connects to the Temporal backend database API
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Use the temporal-proxy to route to the backend /db endpoints
const getDbUrl = (endpoint: string) => 
  `${SUPABASE_URL}/functions/v1/temporal-proxy?endpoint=${encodeURIComponent(`/db${endpoint}`)}`;

function getAuthHeaders(): Record<string, string> {
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anonKey}`,
    'apikey': anonKey,
  };
}

// ========== Types ==========

export interface UserCredits {
  free_remaining: number;
  paid_available: number;
  total: number;
  can_generate: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  status: string;
  free_generations_used: number;
  free_generations_limit: number;
  paid_generations_available: number;
  total_available: number;
  roles: string[];
}

export interface UserStats {
  generations: {
    completed_count: number;
    failed_count: number;
    pending_count: number;
    total_count: number;
  };
  credits: UserCredits;
}

export interface Payment {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  generations_purchased: number;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Generation {
  id: string;
  user_id: string;
  workflow_id: string | null;
  status: string;
  jewelry_type: string | null;
  is_paid: boolean;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ========== User API ==========

export const userApi = {
  /**
   * Create or get user profile
   */
  async createUser(email: string, fullName?: string): Promise<UserProfile> {
    const response = await fetch(getDbUrl('/users'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, full_name: fullName }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create user: ${error}`);
    }

    return response.json();
  },

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<UserProfile | null> {
    try {
      const response = await fetch(getDbUrl(`/users/${userId}`), {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get user: ${await response.text()}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  /**
   * Get user's generation credits
   */
  async getCredits(userId: string): Promise<UserCredits> {
    const response = await fetch(getDbUrl(`/users/${userId}/credits`), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get credits: ${await response.text()}`);
    }

    return response.json();
  },

  /**
   * Use one generation credit
   */
  async useCredit(userId: string): Promise<{ success: boolean; remaining: UserCredits }> {
    const response = await fetch(getDbUrl(`/users/${userId}/use-credit`), {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to use credit: ${error}`);
    }

    return response.json();
  },

  /**
   * Get user statistics
   */
  async getStats(userId: string): Promise<UserStats> {
    const response = await fetch(getDbUrl(`/users/${userId}/stats`), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get stats: ${await response.text()}`);
    }

    return response.json();
  },

  /**
   * Get user's generation history
   */
  async getGenerations(userId: string, limit: number = 50): Promise<Generation[]> {
    const response = await fetch(getDbUrl(`/users/${userId}/generations?limit=${limit}`), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get generations: ${await response.text()}`);
    }

    return response.json();
  },

  /**
   * Get user's payment history
   */
  async getPayments(userId: string, limit: number = 50): Promise<Payment[]> {
    const response = await fetch(getDbUrl(`/users/${userId}/payments?limit=${limit}`), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get payments: ${await response.text()}`);
    }

    return response.json();
  },
};

// ========== Payment API ==========

export const paymentApi = {
  /**
   * Create a payment record (before Stripe checkout)
   */
  async createPayment(
    userId: string,
    amountCents: number = 1900,
    generationsPurchased: number = 1
  ): Promise<Payment> {
    const response = await fetch(getDbUrl('/payments'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: userId,
        amount_cents: amountCents,
        generations_purchased: generationsPurchased,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create payment: ${await response.text()}`);
    }

    return response.json();
  },

  /**
   * Complete a payment (after Stripe success)
   */
  async completePayment(
    paymentId: string,
    stripeSessionId?: string,
    stripePaymentIntentId?: string
  ): Promise<Payment> {
    const response = await fetch(getDbUrl(`/payments/${paymentId}/complete`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        stripe_session_id: stripeSessionId,
        stripe_payment_intent_id: stripePaymentIntentId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to complete payment: ${await response.text()}`);
    }

    return response.json();
  },

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<Payment> {
    const response = await fetch(getDbUrl(`/payments/${paymentId}`), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get payment: ${await response.text()}`);
    }

    return response.json();
  },
};

// ========== Generation API ==========

export const generationApi = {
  /**
   * Create a generation record
   */
  async createGeneration(
    userId: string,
    jewelryType?: string,
    metadata?: Record<string, any>
  ): Promise<Generation> {
    const response = await fetch(getDbUrl('/generations'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: userId,
        jewelry_type: jewelryType,
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create generation: ${await response.text()}`);
    }

    return response.json();
  },

  /**
   * Link generation to workflow
   */
  async linkToWorkflow(generationId: string, workflowId: string): Promise<void> {
    const response = await fetch(
      getDbUrl(`/generations/${generationId}/link-workflow?workflow_id=${workflowId}`),
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to link generation: ${await response.text()}`);
    }
  },

  /**
   * Update generation status
   */
  async updateStatus(
    generationId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const params = new URLSearchParams({ status });
    if (errorMessage) params.append('error_message', errorMessage);

    const response = await fetch(getDbUrl(`/generations/${generationId}/status?${params}`), {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to update status: ${await response.text()}`);
    }
  },
};
