import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api';

/**
 * FE-01 D7 — the shared error state.
 *
 * It renders the normalized, safe message and — when the API supplied one —
 * the `request_id`, so a user can quote it to support. It never renders a
 * stack trace, a raw response body or an internal detail (INV-08, FE-01 §8).
 */
export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  action?: ReactNode;
}

const FALLBACK_MESSAGE = 'Something went wrong. Try again.';

export function ErrorState({ error, onRetry, action }: ErrorStateProps): React.JSX.Element {
  const normalized = isApiError(error) ? error : null;
  const message = normalized?.message ?? FALLBACK_MESSAGE;
  const requestId = normalized?.requestId ?? null;
  const canRetry = onRetry !== undefined && (normalized === null || normalized.isRetryable);

  return (
    <div
      role="alert"
      data-testid="state-error"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6"
    >
      <p className="text-sm font-medium">{message}</p>
      {requestId !== null && (
        <p className="text-xs text-muted-foreground">
          Reference for support: <span className="font-mono">{requestId}</span>
        </p>
      )}
      <div className="flex gap-2">
        {canRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
