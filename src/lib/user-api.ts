/**
 * ============================================================
 * USER API - Frontend Client for User/Credits/Payments
 * ============================================================
 * 
 * PURPOSE:
 * This file provides the frontend interface to the Temporal backend database.
 * It handles all user-related operations like profiles, credits, payments, and generations.
 * 
 * ARCHITECTURE FLOW:
 * ┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
 * │  React Frontend │ ──► │  Supabase Edge Func  │ ──► │  Temporal API       │ ──► │  PostgreSQL DB   │
 * │  (this file)    │     │  (temporal-proxy)    │     │  (api_gateway.py)   │     │  (external)      │
 * └─────────────────┘     └──────────────────────┘     └─────────────────────┘     └──────────────────┘
 * 
 * WHY THIS ARCHITECTURE:
 * - The database is hosted externally (not in Lovable Cloud/Supabase)
 * - We use Supabase Edge Functions as a secure proxy to reach the Temporal backend
 * - This keeps API keys and database credentials on the server side
 * 
 * ENDPOINTS USED:
 * - /db/users - User CRUD operations
 * - /db/users/:id/credits - Get/use generation credits
 * - /db/payments - Payment management
 * - /db/generations - Generation history tracking
 */

// Supabase URL for Edge Function calls
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Constructs the full URL to reach the Temporal backend via the proxy.
 * 
 * Example: getDbUrl('/users/123') 
 * Returns: https://xxx.supabase.co/functions/v1/temporal-proxy?endpoint=/db/users/123
 * 
 * The temporal-proxy Edge Function receives this and forwards to:
 * http://temporal-api-server:8001/db/users/123
 */
const getDbUrl = (endpoint: string) => 
  `${SUPABASE_URL}/functions/v1/temporal-proxy?endpoint=${encodeURIComponent(`/db${endpoint}`)}`;

/**
 * Returns authorization headers for Edge Function calls.
 * Uses the Supabase anon key for authentication with the Edge Function.
 * Note: The actual user authentication happens via the auth context.
 */
function getAuthHeaders(): Record<string, string> {
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anonKey}`,
    'apikey': anonKey,
  };
}

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Represents a user's available generation credits.
 * Credits are consumed each time a jewelry generation is performed.
 */
export interface UserCredits {
  free_remaining: number;      // Free generations left (out of initial 2)
  paid_available: number;      // Purchased generations remaining
  total: number;               // Total: free_remaining + paid_available
  can_generate: boolean;       // true if total > 0 AND user is active
}

/**
 * Complete user profile from the database.
 * Stored in the 'users' table of the Temporal backend PostgreSQL.
 */
export interface UserProfile {
  id: string;                       // UUID, matches Supabase auth.users.id
  email: string;                    // User's email address
  full_name: string | null;         // Display name (optional)
  avatar_url: string | null;        // Profile picture URL (optional)
  status: string;                   // 'active', 'inactive', 'suspended', 'deleted'
  free_generations_used: number;    // How many free generations consumed (max 2)
  free_generations_limit: number;   // Default is 2 free generations
  paid_generations_available: number; // Purchased credits remaining
  total_available: number;          // Computed: (limit - used) + paid
  roles: string[];                  // User roles: ['user'], ['admin'], etc.
}

/**
 * User statistics for dashboard display.
 */
export interface UserStats {
  generations: {
    completed_count: number;   // Successfully generated images
    failed_count: number;      // Failed generation attempts
    pending_count: number;     // Currently processing
    total_count: number;       // All-time generations attempted
  };
  credits: UserCredits;        // Current credit balance
}

/**
 * Payment record for credit purchases.
 * Stored in the 'payments' table.
 */
export interface Payment {
  id: string;                        // Payment UUID
  user_id: string;                   // Reference to user
  amount_cents: number;              // Price in cents (e.g., 1900 = $19.00)
  currency: string;                  // Currency code (default: 'usd')
  generations_purchased: number;     // Credits purchased with this payment
  status: string;                    // 'pending', 'completed', 'failed', 'refunded'
  stripe_session_id: string | null;  // Stripe checkout session ID
  created_at: string;                // ISO timestamp
  completed_at: string | null;       // When payment was confirmed
}

/**
 * Generation record - tracks each jewelry try-on attempt.
 * Stored in the 'generations' table.
 */
export interface Generation {
  id: string;                    // Generation UUID
  user_id: string;               // Owner of this generation
  workflow_id: string | null;    // Temporal workflow ID (links to processing)
  status: string;                // 'pending', 'processing', 'completed', 'failed'
  jewelry_type: string | null;   // 'necklace', 'bracelet', 'ring', etc.
  is_paid: boolean;              // Whether a paid credit was used
  error_message: string | null;  // Error details if failed
  created_at: string;            // When generation was started
  completed_at: string | null;   // When generation finished
}

// ============================================================
// USER API - Profile & Credits Management
// ============================================================

export const userApi = {
  /**
   * Create a new user profile in the Temporal backend database.
   * Called when a user signs up via Supabase Auth.
   * 
   * FLOW:
   * 1. User signs up in Supabase Auth
   * 2. Frontend calls this to create matching profile in Temporal DB
   * 3. User gets 2 free generation credits by default
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
   * Fetch user profile by ID.
   * Returns null if user doesn't exist (triggers profile creation).
   */
  async getUser(userId: string): Promise<UserProfile | null> {
    try {
      const response = await fetch(getDbUrl(`/users/${userId}`), {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      // User not found - needs to be created
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
   * Get user's current credit balance.
   * Used to check if user can generate before starting workflow.
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
   * Consume one generation credit.
   * Called when user starts a new jewelry generation.
   * 
   * CREDIT PRIORITY:
   * 1. Free credits are used first
   * 2. Then paid credits are consumed
   * 
   * Returns updated credit balance after consumption.
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
   * Get comprehensive user statistics for dashboard.
   * Includes generation counts and credit information.
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
   * Get user's generation history for dashboard display.
   * Returns most recent generations first.
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
   * Get user's payment history.
   * Used for displaying purchase history in settings.
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

// ============================================================
// PAYMENT API - Credit Purchases
// ============================================================

export const paymentApi = {
  /**
   * Create a pending payment record before Stripe checkout.
   * 
   * FLOW:
   * 1. User clicks "Buy Credits"
   * 2. Call createPayment() - creates pending record in DB
   * 3. Redirect to Stripe Checkout
   * 4. After success, call completePayment() to add credits
   */
  async createPayment(
    userId: string,
    amountCents: number = 1900,        // Default: $19.00
    generationsPurchased: number = 1   // Default: 1 generation credit
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
   * Mark payment as complete after successful Stripe checkout.
   * This triggers adding credits to the user's account.
   * 
   * Called by the Stripe webhook or success callback.
   */
  async completePayment(
    paymentId: string,
    stripeSessionId?: string,        // Stripe checkout session ID
    stripePaymentIntentId?: string   // Stripe payment intent ID
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
   * Get payment details by ID.
   * Used to verify payment status.
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

// ============================================================
// GENERATION API - Workflow Tracking
// ============================================================

export const generationApi = {
  /**
   * Create a new generation record when starting a workflow.
   * This tracks the generation attempt in the database.
   * 
   * The generation is linked to a Temporal workflow after it starts.
   */
  async createGeneration(
    userId: string,
    jewelryType?: string,              // 'necklace', 'bracelet', etc.
    metadata?: Record<string, any>     // Additional workflow parameters
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
   * Link a generation record to its Temporal workflow.
   * Called after the workflow is successfully started.
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
   * Update generation status as workflow progresses.
   * Called by the workflow to report completion or failure.
   */
  async updateStatus(
    generationId: string,
    status: string,           // 'processing', 'completed', 'failed'
    errorMessage?: string     // Error details if failed
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
