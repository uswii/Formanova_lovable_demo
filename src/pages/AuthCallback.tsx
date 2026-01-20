import { useEffect, useState } from 'react';

// Redirect destination after successful auth
const AUTH_SUCCESS_REDIRECT = '/dashboard';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi, setStoredToken, setStoredUser } from '@/lib/auth-api';
import { useToast } from '@/hooks/use-toast';

// Use edge function proxy to avoid mixed content (HTTPS -> HTTP)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTH_PROXY_URL = `${SUPABASE_URL}/functions/v1/auth-proxy`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      const message = errorDescription || errorParam;
      setError(`Authentication failed: ${message}`);
      toast({
        variant: 'destructive',
        title: 'Authentication failed',
        description: message,
      });
      setTimeout(() => navigate('/auth'), 3000);
      return;
    }

    if (code) {
      exchangeCodeForToken(code, state || undefined);
    } else {
      setError('No authorization code received');
      setTimeout(() => navigate('/auth'), 3000);
    }
  }, [searchParams]);

  const exchangeCodeForToken = async (code: string, state?: string) => {
    try {
      console.log('[AuthCallback] Starting token exchange with code:', code.substring(0, 10) + '...');
      
      const params = new URLSearchParams({ code });
      if (state) params.append('state', state);
      
      const callbackUrl = `${AUTH_PROXY_URL}/auth/google/callback?${params.toString()}`;
      console.log('[AuthCallback] Calling:', callbackUrl);

      const response = await fetch(callbackUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('[AuthCallback] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AuthCallback] Error response:', errorText);
        throw new Error(errorText || 'Sign in failed');
      }

      const data = await response.json();
      console.log('[AuthCallback] Response data keys:', Object.keys(data));
      
      if (data.access_token) {
        console.log('[AuthCallback] Got access_token, storing...');
        // Store token immediately
        setStoredToken(data.access_token);
        
        // Store user if included in response, otherwise fetch in background
        if (data.user) {
          console.log('[AuthCallback] Got user, storing...');
          setStoredUser(data.user);
        } else {
          console.log('[AuthCallback] No user in response, fetching in background...');
          // Fetch user in background - don't wait for it
          authApi.getCurrentUser().catch(console.error);
        }
        
        console.log('[AuthCallback] Redirecting to:', AUTH_SUCCESS_REDIRECT);
        // Redirect to dashboard after successful auth
        navigate(AUTH_SUCCESS_REDIRECT, { replace: true });
      } else {
        console.error('[AuthCallback] No access_token in response:', data);
        throw new Error('No access token in response');
      }
    } catch (err) {
      console.error('[AuthCallback] Exchange error:', err);
      setError('Something went wrong');
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: 'Please try again.',
      });
      setTimeout(() => navigate('/auth'), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <p className="text-muted-foreground text-sm">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}