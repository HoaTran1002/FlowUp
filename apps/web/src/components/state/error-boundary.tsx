import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api';

/**
 * FE-01 D7 — the root error boundary.
 *
 * A render error must not take the dashboard down, and the fallback must not
 * become an information-disclosure surface: no stack trace, no raw response,
 * no credential (INV-08, FE-01 §8). The `request_id` is shown when the failure
 * came from an API call, because that is the only thing support can act on.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: unknown;
}

export class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Phase 1 has no frontend error-reporting sink. When one is introduced it
    // must redact before transmitting (INV-08), which is a decision of its own
    // and not something FE-01 may assume. `console` is deliberately not used:
    // the repository forbids it in application code (AGENTS.md §6.2).
  }

  private readonly reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;

    if (error === null) {
      return this.props.children;
    }

    const requestId = isApiError(error) ? error.requestId : null;

    return (
      <div
        role="alert"
        data-testid="root-error-boundary"
        className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 p-6"
      >
        <h1 className="text-lg font-semibold">FlowUp could not render this page</h1>
        <p className="text-sm text-muted-foreground">
          The error has not been sent anywhere. Reload to continue; if it keeps happening, contact
          support.
        </p>
        {requestId !== null && (
          <p className="text-xs text-muted-foreground">
            Reference for support: <span className="font-mono">{requestId}</span>
          </p>
        )}
        <Button onClick={this.reload}>Reload</Button>
      </div>
    );
  }
}
