/**
 * Purchase Credits Modal
 * Shows pricing and handles purchase flow
 */
import { useState } from 'react';
import { Sparkles, CreditCard, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { paymentApi } from '@/lib/user-api';
import { useUserCredits } from '@/hooks/use-user-credits';

interface PurchaseCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PricingTier {
  id: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  popular?: boolean;
  savings?: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'single',
    credits: 1,
    price: 19,
    pricePerCredit: 19,
  },
  {
    id: 'pack-5',
    credits: 5,
    price: 79,
    pricePerCredit: 15.8,
    popular: true,
    savings: 'Save 17%',
  },
  {
    id: 'pack-10',
    credits: 10,
    price: 149,
    pricePerCredit: 14.9,
    savings: 'Save 22%',
  },
];

export function PurchaseCreditsModal({ open, onOpenChange }: PurchaseCreditsModalProps) {
  const { user } = useAuth();
  const { refresh } = useUserCredits();
  const [selectedTier, setSelectedTier] = useState<string>('pack-5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    if (!user?.id) return;

    const tier = PRICING_TIERS.find(t => t.id === selectedTier);
    if (!tier) return;

    setLoading(true);
    setError(null);

    try {
      // Create payment record
      const payment = await paymentApi.createPayment(
        user.id,
        tier.price * 100, // Convert to cents
        tier.credits
      );

      // TODO: Redirect to Stripe checkout
      // For now, simulate a successful payment (placeholder)
      console.log('Payment created:', payment.id);
      
      // In production, you would redirect to Stripe here:
      // window.location.href = stripeCheckoutUrl;
      
      // Placeholder: Complete payment immediately (remove in production)
      await paymentApi.completePayment(payment.id);
      
      // Refresh credits
      await refresh();
      
      onOpenChange(false);
    } catch (err) {
      console.error('Purchase failed:', err);
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Purchase Generation Credits
          </DialogTitle>
          <DialogDescription>
            Get more AI-powered jewelry photoshoot generations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Pricing tiers */}
          <div className="space-y-2">
            {PRICING_TIERS.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedTier === tier.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {tier.credits} Generation{tier.credits > 1 ? 's' : ''}
                      </span>
                      {tier.popular && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${tier.pricePerCredit.toFixed(2)} per generation
                      {tier.savings && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          {tier.savings}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">${tier.price}</div>
                    {selectedTier === tier.id && (
                      <Check className="h-5 w-5 text-primary ml-auto" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Features */}
          <div className="text-sm text-muted-foreground space-y-1 py-2">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>AI-powered virtual try-on</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Professional photoshoot quality</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>High-resolution output</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Credits never expire</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Purchase button */}
          <Button 
            onClick={handlePurchase} 
            disabled={loading || !user}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Purchase for ${PRICING_TIERS.find(t => t.id === selectedTier)?.price}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment powered by Stripe. Cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
