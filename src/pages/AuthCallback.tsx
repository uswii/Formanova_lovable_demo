import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi, setStoredToken, setStoredUser } from '@/lib/auth-api';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Authentication failed: ${errorParam}`);
      toast({
        variant: 'destructive',
        title: 'Authentication failed',
        description: errorParam,
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
      const tokenResponse = await authApi.exchangeCodeForToken(code, state);
      
      if (tokenResponse.access_token) {
        setStoredToken(tokenResponse.access_token);
        
        // Fetch and store user info
        const user = await authApi.getCurrentUser();
        if (user) {
          setStoredUser(user);
        }
        
        toast({
          title: 'Welcome!',
          description: 'You have successfully signed in.',
        });
        
        navigate('/');
      } else {
        throw new Error('No access token received');
      }
    } catch (err) {
      console.error('Auth callback error:', err);
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Authentication failed',
        description: message,
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
            <p className="text-muted-foreground">Completing authentication...</p>
          </>
        )}
      </div>
    </div>
  );
}
