import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import formanovaLogo from '@/assets/formanova-logo.png';
import { 
  getStoredToken, 
  getStoredUser, 
  setStoredToken, 
  setStoredUser 
} from '@/lib/auth-api';

// Edge function proxy URL for API calls
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTH_PROXY_URL = `${SUPABASE_URL}/functions/v1/auth-proxy`;

// Direct backend URL for OAuth redirect
const AUTH_BACKEND_URL = 'http://20.173.91.22:8009';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formLoading, setFormLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Check if already logged in
  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (token && user) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setFormLoading(true);
    setDebugInfo('Fetching Google OAuth URL...');
    
    try {
      // Use proxy to get the Google OAuth redirect URL (avoids HTTPS→HTTP block)
      const response = await fetch(`${AUTH_PROXY_URL}/auth/google/authorize`);
      const data = await response.json();
      
      console.log('[Auth] OAuth response:', data);
      
      const redirectUrl = data.redirect_url || data.authorization_url;
      if (redirectUrl) {
        setDebugInfo(`Redirecting to Google...`);
        // Redirect to Google (HTTPS)
        window.location.href = redirectUrl;
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('No redirect URL received');
      }
    } catch (error) {
      console.error('[Auth] Google OAuth error:', error);
      setFormLoading(false);
      setDebugInfo(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        variant: 'destructive',
        title: 'Google Sign-In Failed',
        description: error instanceof Error ? error.message : 'Could not connect to authentication service',
      });
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please enter both email and password.',
      });
      return;
    }

    setFormLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${AUTH_PROXY_URL}/auth/jwt/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(error.detail || 'Invalid email or password');
      }

      const data = await response.json();
      
      if (data.access_token) {
        setStoredToken(data.access_token);
        
        // Fetch user info
        const userResponse = await fetch(`${AUTH_PROXY_URL}/users/me`, {
          headers: { 'Authorization': `Bearer ${data.access_token}` },
        });
        
        if (userResponse.ok) {
          const user = await userResponse.json();
          setStoredUser(user);
        }
        
        toast({
          title: 'Welcome!',
          description: 'You have successfully signed in.',
        });
        
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Login error:', error);
      const message = error instanceof Error ? error.message : 'Login failed';
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: message,
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please enter both email and password.',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
      });
      return;
    }

    setFormLoading(true);
    try {
      // Register
      const registerResponse = await fetch(`${AUTH_PROXY_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json().catch(() => ({ detail: 'Registration failed' }));
        throw new Error(error.detail || 'Failed to create account');
      }

      // Auto-login after registration
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const loginResponse = await fetch(`${AUTH_PROXY_URL}/auth/jwt/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!loginResponse.ok) {
        throw new Error('Account created but login failed. Please sign in manually.');
      }

      const data = await loginResponse.json();
      
      if (data.access_token) {
        setStoredToken(data.access_token);
        
        // Fetch user info
        const userResponse = await fetch(`${AUTH_PROXY_URL}/users/me`, {
          headers: { 'Authorization': `Bearer ${data.access_token}` },
        });
        
        if (userResponse.ok) {
          const user = await userResponse.json();
          setStoredUser(user);
        }
        
        toast({
          title: 'Account created',
          description: 'Welcome to Formanova!',
        });
        
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Signup error:', error);
      const message = error instanceof Error ? error.message : 'Registration failed';
      toast({
        variant: 'destructive',
        title: 'Sign up failed',
        description: message,
      });
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center py-12 px-8">
          {/* Formanova Logo */}
          <img 
            src={formanovaLogo} 
            alt="Formanova" 
            className="h-16 md:h-20 w-auto object-contain logo-adaptive mb-8"
          />
          
          <Tabs defaultValue="login" className="w-full max-w-xs">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input 
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={formLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input 
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={formLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={formLoading}>
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleEmailSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input 
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={formLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input 
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={formLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={formLoading}>
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative w-full max-w-xs my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <Button 
            onClick={handleGoogleSignIn} 
            className="w-full max-w-xs h-12 text-base" 
            variant="outline"
            disabled={formLoading}
          >
            <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Debug info - visible on page */}
          {debugInfo && (
            <p className="mt-4 text-xs text-muted-foreground break-all max-w-xs">
              {debugInfo}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
