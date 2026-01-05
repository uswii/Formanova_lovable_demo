/**
 * Hook for managing user credits
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, UserCredits, UserProfile } from '@/lib/user-api';

interface UseUserCreditsReturn {
  credits: UserCredits | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  canGenerate: boolean;
  totalCredits: number;
  freeRemaining: number;
  paidAvailable: number;
  refresh: () => Promise<void>;
  useCredit: () => Promise<boolean>;
}

export function useUserCredits(): UseUserCreditsReturn {
  const { user } = useAuth();
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!user?.id) {
      setCredits(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to get existing profile, or create one
      let userProfile = await userApi.getUser(user.id);
      
      if (!userProfile) {
        // Create profile for new user
        try {
          userProfile = await userApi.createUser(
            user.email || '',
            user.user_metadata?.full_name
          );
        } catch (createError) {
          // User might already exist (race condition)
          userProfile = await userApi.getUser(user.id);
        }
      }

      if (userProfile) {
        setProfile(userProfile);
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

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const useCredit = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const result = await userApi.useCredit(user.id);
      if (result.success) {
        setCredits(result.remaining);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to use credit:', err);
      return false;
    }
  }, [user?.id]);

  return {
    credits,
    profile,
    loading,
    error,
    canGenerate: credits?.can_generate ?? false,
    totalCredits: credits?.total ?? 0,
    freeRemaining: credits?.free_remaining ?? 0,
    paidAvailable: credits?.paid_available ?? 0,
    refresh: fetchCredits,
    useCredit,
  };
}
