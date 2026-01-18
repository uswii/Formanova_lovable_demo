import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi, setStoredToken, setStoredUser } from '@/lib/auth-api';
import { useToast } from '@/hooks/use-toast';

const AUTH_SERVICE_URL = 'http://20.173.91.22:8009';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Completing authentication...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('[AuthCallback] URL params:', { code: code?.slice(0, 20) + '...', state, errorParam });

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
      setStatus('Exchanging code for token...');
      console.log('[AuthCallback] Calling backend callback...');
      
      // Build the callback URL
      const params = new URLSearchParams({ code });
      if (state) params.append('state', state);
      
      const callbackUrl = `${AUTH_SERVICE_URL}/auth/google/callback?${params.toString()}`;
      console.log('[AuthCallback] Backend URL:', callbackUrl);

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
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[AuthCallback] Response data:', { hasToken: !!data.access_token });
      
      if (data.access_token) {
        setStatus('Fetching user info...');
        setStoredToken(data.access_token);
        
        // Fetch and store user info
        const user = await authApi.getCurrentUser();
        if (user) {
          setStoredUser(user);
        }
        
        toast({
          title: 'Welcome!',
          description: 'You have successfully signed in.',
        });
        
        navigate('/', { replace: true });
      } else {
        throw new Error('No access token in response');
      }
    } catch (err) {
      console.error('[AuthCallback] Error:', err);
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Authentication failed',
        description: message.includes('CORS') || message.includes('Failed to fetch') 
          ? 'Connection blocked. Please check CORS settings on the auth server.'
          : message,
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