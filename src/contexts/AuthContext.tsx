import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  authApi, 
  getStoredToken, 
  getStoredUser, 
  setStoredToken, 
  setStoredUser,
  removeStoredToken,
  removeStoredUser,
  type AuthUser 
} from '@/lib/auth-api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored session on mount
    const initAuth = async () => {
      const token = getStoredToken();
      const storedUser = getStoredUser();
      
      if (token) {
        // Validate token by fetching current user
        const currentUser = await authApi.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        } else {
          // Token invalid, clear storage
          removeStoredToken();
          removeStoredUser();
        }
      } else if (storedUser) {
        // Clean up orphaned user data
        removeStoredUser();
      }
      
      setLoading(false);
    };

    initAuth();
  }, []);

  const signInWithGoogle = () => {
    authApi.initiateGoogleLogin();
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const tokenResponse = await authApi.login(email, password);
      setStoredToken(tokenResponse.access_token);
      
      const currentUser = await authApi.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setStoredUser(currentUser);
      }
      
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await authApi.register(email, password);
      // Auto-login after registration
      return await signInWithEmail(email, password);
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await authApi.logout();
    setUser(null);
  };

  const getAuthHeader = () => {
    return authApi.getAuthHeader();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signInWithGoogle, 
      signInWithEmail,
      signUpWithEmail,
      signOut,
      getAuthHeader 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
