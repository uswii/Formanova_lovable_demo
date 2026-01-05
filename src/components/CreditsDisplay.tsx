/**
 * Credits Display Component
 * Shows user's remaining generation credits with purchase option
 */
import { ShoppingCart, Loader2 } from 'lucide-react';
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
            <div 
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded border cursor-help",
                canGenerate 
                  ? "bg-muted text-foreground border-border" 
                  : "bg-destructive/10 text-destructive border-destructive/30",
                className
              )}
            >
              {totalCredits} credits
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-popover border-border text-popover-foreground">
            <p className="text-sm">{freeRemaining} free + {paidAvailable} paid</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed variant - shows breakdown
  if (variant === 'detailed') {
    return (
      <div className={cn("space-y-3 p-4 rounded-lg border border-border bg-card", className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            Credits
          </h3>
          <span className={cn(
            "text-sm font-semibold",
            canGenerate ? "text-foreground" : "text-destructive"
          )}>
            {totalCredits} available
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded bg-muted">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Free</div>
            <div className="text-base font-semibold text-foreground">{freeRemaining}</div>
          </div>
          <div className="p-2 rounded bg-muted">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Paid</div>
            <div className="text-base font-semibold text-foreground">{paidAvailable}</div>
          </div>
        </div>

        {!canGenerate && (
          <p className="text-xs text-muted-foreground">
            No credits remaining. Purchase more to continue.
          </p>
        )}

        {onPurchase && (
          <Button 
            onClick={onPurchase} 
            size="sm"
            className="w-full"
            variant={canGenerate ? "outline" : "default"}
          >
            Buy Credits
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
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium",
              canGenerate 
                ? "bg-muted text-foreground border-border" 
                : "bg-destructive/10 text-destructive border-destructive/30"
            )}>
              {totalCredits} credit{totalCredits !== 1 ? 's' : ''}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-popover border-border text-popover-foreground">
            <div className="text-xs space-y-0.5">
              <div>Free: {freeRemaining}</div>
              <div>Paid: {paidAvailable}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {onPurchase && !canGenerate && (
        <Button size="sm" onClick={onPurchase}>
          Buy
        </Button>
      )}
    </div>
  );
}
