/**
 * Credits Display Component
 * Shows user's remaining generation credits with purchase option
 */
import { Sparkles, Coins, ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUserCredits } from '@/hooks/use-user-credits';
import { cn } from '@/lib/utils';

interface CreditsDisplayProps {
  onPurchase?: () => void;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

export function CreditsDisplay({ 
  onPurchase, 
  variant = 'default',
  className 
}: CreditsDisplayProps) {
  const { 
    credits, 
    loading, 
    error, 
    totalCredits, 
    freeRemaining, 
    paidAvailable,
    canGenerate 
  } = useUserCredits();

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-sm text-destructive">Credits unavailable</span>
      </div>
    );
  }

  // Compact variant - just shows the number
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={canGenerate ? "secondary" : "destructive"}
              className={cn("gap-1 cursor-help", className)}
            >
              <Sparkles className="h-3 w-3" />
              {totalCredits}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{freeRemaining} free + {paidAvailable} paid credits</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed variant - shows breakdown
  if (variant === 'detailed') {
    return (
      <div className={cn("space-y-3 p-4 rounded-lg border bg-card", className)}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            Generation Credits
          </h3>
          <Badge variant={canGenerate ? "default" : "destructive"}>
            {totalCredits} available
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">Free Credits</div>
            <div className="text-lg font-semibold">{freeRemaining}</div>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <div className="text-muted-foreground">Paid Credits</div>
            <div className="text-lg font-semibold">{paidAvailable}</div>
          </div>
        </div>

        {!canGenerate && (
          <p className="text-sm text-muted-foreground">
            You've used all your free credits. Purchase more to continue generating.
          </p>
        )}

        {onPurchase && (
          <Button 
            onClick={onPurchase} 
            className="w-full gap-2"
            variant={canGenerate ? "outline" : "default"}
          >
            <ShoppingCart className="h-4 w-4" />
            Buy Credits ($19/generation)
          </Button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
              <Sparkles className={cn(
                "h-4 w-4",
                canGenerate ? "text-primary" : "text-destructive"
              )} />
              <span className="text-sm font-medium">
                {totalCredits} credit{totalCredits !== 1 ? 's' : ''}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-xs space-y-1">
              <div>Free: {freeRemaining} remaining</div>
              <div>Paid: {paidAvailable} available</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {onPurchase && !canGenerate && (
        <Button size="sm" onClick={onPurchase} className="gap-1">
          <ShoppingCart className="h-3 w-3" />
          Buy
        </Button>
      )}
    </div>
  );
}
