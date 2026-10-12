import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/api';

/**
 * FE-01 D6 — one query client, created once per application root.
 *
 * Retry policy: only a transport-level failure is retried. A `4xx` is a
 * decision the server already made and retrying it is noise
 * (apps/web/AGENTS.md §6.2).
 *
 * Mutations are never retried automatically: publishing and replay require an
 * approved idempotency policy (FR-REP-*, ADR-01/ADR-04 pending), and a silent
 * replay of a non-idempotent write is a correctness bug, not a convenience.
 *
 * SECRET HYGIENE (INV-08): no persister is configured here, and none may be
 * added. A persisted cache would write whatever a response contained —
 * including a one-time API key or signing secret — into browser storage.
 */
const MAX_TRANSPORT_RETRIES = 2;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (failureCount >= MAX_TRANSPORT_RETRIES) {
            return false;
          }
          return isApiError(error) ? error.isRetryable : false;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
