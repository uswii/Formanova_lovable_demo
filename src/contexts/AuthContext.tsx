import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  authApi, 
  getStoredToken, 
  getStoredUser, 
  removeStoredToken,
  removeStoredUser,
  type AuthUser 
} from '@/lib/auth-api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage synchronously (instant load)
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(false); // Start as false - no blocking

  useEffect(() => {
    // Background validation - don't block UI
    const validateSession = async () => {
      const token = getStoredToken();
      
      if (token) {
        // Validate token in background
        const currentUser = await authApi.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        } else {
          // Token invalid, clear storage
          removeStoredToken();
          removeStoredUser();
          setUser(null);
        }
      } else {
        // No token, ensure clean state
        removeStoredUser();
        setUser(null);
      }
    };

    validateSession();
  }, []);

  const signInWithGoogle = () => {
    authApi.initiateGoogleLogin();
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
