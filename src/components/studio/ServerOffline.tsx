import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  onRetry: () => void;
  isChecking: boolean;
}

export function ServerOffline({ onRetry, isChecking }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <WifiOff className="h-10 w-10 text-destructive" />
        </div>
      </div>
      
      <h2 className="text-2xl font-display font-semibold mb-2">
        Server Offline
      </h2>
      <p className="text-muted-foreground max-w-md mb-6">
        The AI generation server is currently unavailable. Please try again in a moment.
      </p>
      
      <button
        onClick={onRetry}
        disabled={isChecking}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isChecking ? 'Checking...' : 'Retry Connection'}
      </button>
    </div>
  );
}
