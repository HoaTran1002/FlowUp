import type { ReactNode } from 'react';

/**
 * FE-01 D7 — the shared empty state.
 *
 * An empty result is a fact, not an error: it is never rendered as a failure
 * (apps/web/AGENTS.md §5.6).
 */
export interface EmptyProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function Empty({ title, description, action }: EmptyProps): React.JSX.Element {
  return (
    <div
      data-testid="state-empty"
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center"
    >
      <p className="text-sm font-medium">{title}</p>
      {description !== undefined && (
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}
