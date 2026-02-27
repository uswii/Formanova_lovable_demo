import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBalance, TOOL_COSTS, type CreditBalance } from '@/lib/credits-api';
import { getStoredToken } from '@/lib/auth-api';

interface CreditsContextType {
  credits: number | null;
  loading: boolean;
  refreshCredits: () => Promise<void>;
  canAfford: (toolName: string) => boolean;
  getToolCost: (toolName: string) => number;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // We need navigate for 401 redirect but CreditsProvider may be outside Router,
  // so we use window.location as fallback
  const handleUnauthorized = useCallback(() => {
    setCredits(null);
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!user?.id) return;
    const token = getStoredToken();
    if (!token) {
      console.warn('[Credits] No auth token found, skipping balance fetch');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchBalance();
      setCredits(data.available);
    } catch (error: any) {
      if (error?.status === 401) {
        handleUnauthorized();
        return;
      }
      // Network error — keep last known value, silently retry next time
      console.warn('[Credits] Failed to fetch balance:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, handleUnauthorized]);

  useEffect(() => {
    if (user?.id) {
      refreshCredits();
    } else {
      setCredits(null);
    }
  }, [user?.id, refreshCredits]);

  const canAfford = useCallback((toolName: string) => {
    const cost = TOOL_COSTS[toolName] ?? 0;
    return credits !== null && credits >= cost;
  }, [credits]);

  const getToolCost = useCallback((toolName: string) => {
    return TOOL_COSTS[toolName] ?? 0;
  }, []);

  return (
    <CreditsContext.Provider value={{ credits, loading, refreshCredits, canAfford, getToolCost }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}
