/**
 * ============================================================
 * USE USER CREDITS HOOK
 * ============================================================
 * 
 * PURPOSE:
 * React hook that manages the current user's generation credits.
 * Provides a simple interface to check credit balance and consume credits.
 * 
 * USAGE:
 * ```tsx
 * const { credits, canGenerate, useCredit, refresh } = useUserCredits();
 * 
 * // Check before allowing generation
 * if (!canGenerate) {
 *   showPaymentModal();
 *   return;
 * }
 * 
 * // Consume a credit when starting generation
 * const success = await useCredit();
 * if (success) {
 *   startGeneration();
 * }
 * ```
 * 
 * CREDIT SYSTEM:
 * - New users get 2 FREE generations
 * - After free credits are used, users must purchase credits
 * - Credits are consumed when a generation workflow starts
 * - Free credits are used before paid credits
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, UserCredits, UserProfile } from '@/lib/user-api';

/**
 * Return type for the useUserCredits hook.
 * Provides both the raw data and computed convenience values.
 */
interface UseUserCreditsReturn {
  // Raw data
  credits: UserCredits | null;     // Full credits object
  profile: UserProfile | null;     // User profile with all fields
  loading: boolean;                // True while fetching data
  error: string | null;            // Error message if fetch failed
  
  // Computed convenience values
  canGenerate: boolean;            // True if user has credits available
  totalCredits: number;            // Total available credits
  freeRemaining: number;           // Free credits remaining (out of 2)
  paidAvailable: number;           // Purchased credits remaining
  
  // Actions
  refresh: () => Promise<void>;    // Manually refresh credit data
  useCredit: () => Promise<boolean>; // Consume one credit
}

export function useUserCredits(): UseUserCreditsReturn {
  // Get current authenticated user from Supabase Auth context
  const { user } = useAuth();
  
  // State for credits data
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch or create user profile and credits from the Temporal backend.
   * 
   * FLOW:
   * 1. Check if user profile exists in Temporal DB
   * 2. If not, create new profile (gives 2 free credits)
   * 3. Calculate credits from profile data
   */
  const fetchCredits = useCallback(async () => {
    // No user logged in - clear state
    if (!user?.id) {
      setCredits(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to get existing profile from Temporal backend
      let userProfile = await userApi.getUser(user.id);
      
      // If profile doesn't exist, create it (new user flow)
      if (!userProfile) {
        try {
          // Create profile with email and display name from Supabase Auth
          userProfile = await userApi.createUser(
            user.email || '',
            user.user_metadata?.full_name
          );
        } catch (createError) {
          // Handle race condition - profile might have been created by another request
          userProfile = await userApi.getUser(user.id);
        }
      }

      // Update state with fetched/created profile
      if (userProfile) {
        setProfile(userProfile);
        
        // Calculate credits from profile fields
        // free_remaining = limit (2) - used (0-2)
        setCredits({
          free_remaining: Math.max(0, userProfile.free_generations_limit - userProfile.free_generations_used),
          paid_available: userProfile.paid_generations_available,
          total: userProfile.total_available,
          can_generate: userProfile.total_available > 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
      setError(err instanceof Error ? err.message : 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, user?.user_metadata?.full_name]);

  // Fetch credits when user changes (login/logout)
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  /**
   * Consume one generation credit.
   * 
   * IMPORTANT: Call this BEFORE starting the generation workflow!
   * This ensures the credit is deducted even if the workflow fails to start.
   * 
   * CREDIT PRIORITY:
   * 1. Free credits are consumed first
   * 2. Then paid credits are consumed
   * 
   * @returns true if credit was successfully consumed, false otherwise
   */
  const useCredit = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // Call backend to consume one credit
      const result = await userApi.useCredit(user.id);
      
      if (result.success) {
        // Update local state with new credit balance
        setCredits(result.remaining);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to use credit:', err);
      return false;
    }
  }, [user?.id]);

  // Return both raw data and computed convenience values
  return {
    // Raw data
    credits,
    profile,
    loading,
    error,
    
    // Computed values with safe defaults
    canGenerate: credits?.can_generate ?? false,
    totalCredits: credits?.total ?? 0,
    freeRemaining: credits?.free_remaining ?? 0,
    paidAvailable: credits?.paid_available ?? 0,
    
    // Actions
    refresh: fetchCredits,
    useCredit,
  };
}
