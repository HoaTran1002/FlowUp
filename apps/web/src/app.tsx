import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';

import { RootErrorBoundary } from '@/components/state/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { onUnauthorized } from '@/lib/api';
import {
  OrganizationIdentityProvider,
  type OrganizationIdentity,
} from '@/lib/session/organization-identity';
import type { AppRouter } from '@/routes/router';

/**
 * FE-01 D6/D7 — the application root.
 *
 * One `QueryClientProvider`, one error boundary, one toast host. No cache
 * persister is registered (INV-08): see `lib/query/client.ts`.
 *
 * The `401` reaction lives here, not in the HTTP client, so the client depends
 * on neither the router nor the cache. On a session expiry the cached data is
 * cleared — it belongs to a session that no longer exists — and the user is
 * routed to the login placeholder (FE-01 §6). A `403` is never handled here:
 * it renders access-denied at the screen that received it.
 */
export interface AppProps {
  queryClient: QueryClient;
  router: AppRouter;
  identity: OrganizationIdentity;
}

export function App({ queryClient, router, identity }: AppProps): React.JSX.Element {
  useEffect(() => {
    onUnauthorized(() => {
      queryClient.clear();
      void router.navigate({ to: '/login', replace: true });
    });
    return () => {
      onUnauthorized(null);
    };
  }, [queryClient, router]);

  return (
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <OrganizationIdentityProvider identity={identity}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
          <Toaster />
        </OrganizationIdentityProvider>
      </QueryClientProvider>
    </RootErrorBoundary>
  );
}
