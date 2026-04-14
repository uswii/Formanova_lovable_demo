import React from 'react';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Catches unhandled runtime errors that escape ChunkErrorBoundary
 * (which re-throws non-chunk errors). Prevents a full white-screen
 * by showing a recovery UI that lets the user go back or reload.
 *
 * Sits OUTSIDE ChunkErrorBoundary so chunk errors are handled there
 * first; only runtime crashes reach this boundary.
 */
export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown) {
    import('posthog-js')
      .then(({ default: posthog }) => {
        if (posthog.__loaded) posthog.captureException(error);
      })
      .catch(() => {});
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Something went wrong on this page. Your data is safe.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.history.back();
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </Button>
            <Button
              variant="default"
              className="gap-2"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
