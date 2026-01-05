/**
 * User Dashboard Page
 * Shows user profile, credits, generation history, and payment history
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Sparkles, 
  History, 
  CreditCard, 
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCredits } from '@/hooks/use-user-credits';
import { userApi, Generation, Payment } from '@/lib/user-api';
import { CreditsDisplay } from '@/components/CreditsDisplay';
import { PurchaseCreditsModal } from '@/components/PurchaseCreditsModal';
import { Header } from '@/components/layout/Header';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    completed: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
    failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    pending: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
    processing: { variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  };

  const { variant, icon } = config[status] || config.pending;

  return (
    <Badge variant={variant} className="gap-1 capitalize">
      {icon}
      {status}
    </Badge>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, totalCredits, freeRemaining, paidAvailable, loading: creditsLoading } = useUserCredits();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function loadHistory() {
      if (!user?.id) return;
      
      try {
        setLoadingHistory(true);
        const [gens, pays] = await Promise.all([
          userApi.getGenerations(user.id, 20),
          userApi.getPayments(user.id, 20),
        ]);
        setGenerations(gens);
        setPayments(pays);
      } catch (error) {
        console.error('Failed to load history:', error);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadHistory();
  }, [user?.id]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Back button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/studio')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Studio
        </Button>

        {/* Profile header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            {user.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata?.full_name || 'User'}
                className="h-16 w-16 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">
                {user.user_metadata?.full_name || user.email?.split('@')[0]}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <CreditsDisplay 
            variant="detailed" 
            onPurchase={() => setPurchaseModalOpen(true)}
            className="md:max-w-xs"
          />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Credits</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                {creditsLoading ? '-' : totalCredits}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Free Remaining</CardDescription>
              <CardTitle className="text-3xl">
                {creditsLoading ? '-' : freeRemaining}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Paid Credits</CardDescription>
              <CardTitle className="text-3xl">
                {creditsLoading ? '-' : paidAvailable}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Generations</CardDescription>
              <CardTitle className="text-3xl">
                {loadingHistory ? '-' : generations.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* History tabs */}
        <Tabs defaultValue="generations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="generations" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Generations
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Generation History
                </CardTitle>
                <CardDescription>
                  Your recent AI-generated jewelry photoshoots
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : generations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No generations yet</p>
                    <Button 
                      variant="link" 
                      onClick={() => navigate('/studio')}
                      className="mt-2"
                    >
                      Start your first generation
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {generations.map((gen) => (
                      <div 
                        key={gen.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {gen.jewelry_type ? gen.jewelry_type.charAt(0).toUpperCase() + gen.jewelry_type.slice(1) : 'Generation'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(gen.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {gen.is_paid && (
                            <Badge variant="outline" className="text-xs">Paid</Badge>
                          )}
                          <StatusBadge status={gen.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment History
                </CardTitle>
                <CardDescription>
                  Your credit purchases and transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No payments yet</p>
                    <Button 
                      variant="link" 
                      onClick={() => setPurchaseModalOpen(true)}
                      className="mt-2"
                    >
                      Purchase credits
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div 
                        key={payment.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <div className="font-medium">
                            {payment.generations_purchased} Credit{payment.generations_purchased > 1 ? 's' : ''}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(payment.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-semibold">
                              {formatCurrency(payment.amount_cents, payment.currency)}
                            </div>
                          </div>
                          <StatusBadge status={payment.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <PurchaseCreditsModal 
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
      />
    </div>
  );
}
