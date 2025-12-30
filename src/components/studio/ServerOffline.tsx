import { WifiOff, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  onRetry: () => void;
  isChecking: boolean;
}

export function ServerOffline({ onRetry, isChecking }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="relative mb-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      
      <h2 className="text-xl font-display font-semibold mb-2">
        Server Offline
      </h2>
      <p className="text-muted-foreground text-sm mb-4">
        The generation server is currently unavailable.
      </p>
      
      <button
        onClick={onRetry}
        disabled={isChecking}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isChecking ? 'Checking...' : 'Check again'}
      </button>
    </div>
  );
}
