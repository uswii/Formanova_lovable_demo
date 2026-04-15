import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  title?: string;
  description?: string;
  resetKeys?: Array<string | number | boolean | null | undefined>;
}

interface State {
  hasError: boolean;
}

function resetKeysChanged(
  prev: Props['resetKeys'] = [],
  next: Props['resetKeys'] = [],
): boolean {
  if (prev.length !== next.length) return true;
  return prev.some((value, index) => value !== next[index]);
}

export class CADRuntimeErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    import('posthog-js')
      .then(({ default: posthog }) => {
        if (posthog.__loaded) {
          posthog.captureException(error, {
            componentStack: info.componentStack,
            boundary: 'CADRuntimeErrorBoundary',
          });
        }
      })
      .catch(() => {});
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false });
    }
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="w-full h-full min-h-[220px] flex items-center justify-center bg-background text-foreground">
        <div className="max-w-sm px-6 py-7 text-center border border-border bg-card">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <div className="font-display text-lg uppercase tracking-[0.14em] mb-2">
            {this.props.title ?? '3D View Unavailable'}
          </div>
          <p className="font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground mb-5">
            {this.props.description ??
              'The 3D viewer hit a rendering problem. Your generation and history are still available.'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={this.reset} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      </div>
    );
  }
}

export default CADRuntimeErrorBoundary;
