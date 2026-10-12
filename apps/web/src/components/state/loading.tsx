import { Skeleton } from '@/components/ui/skeleton';

/**
 * FE-01 D7 — the shared loading state.
 *
 * `role="status"` with `aria-live="polite"` is what makes loading *announced*
 * rather than merely visible (UI_UX_SPECIFICATION.md §5). Every later screen
 * uses this component instead of inventing its own spinner.
 */
export interface LoadingProps {
  label?: string;
  rows?: number;
}

export function Loading({ label = 'Loading…', rows = 3 }: LoadingProps): React.JSX.Element {
  return (
    <div role="status" aria-live="polite" data-testid="state-loading" className="space-y-3 p-6">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
    </div>
  );
}
