import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { App } from './app';
import { createQueryClient } from './lib/query';
import { PENDING_IDENTITY, type OrganizationIdentity } from './lib/session/organization-identity';
import { enableMocks } from './mocks/network';
import { createAppRouter } from './routes/router';

/**
 * FE-01 D1 — browser entry point.
 *
 * Mocks start BEFORE the first render so no request races the worker. In a
 * production build `enableMocks` returns `false` immediately and its dynamic
 * imports are eliminated at build time (see `mocks/network.ts`).
 */
async function bootstrap(): Promise<void> {
  const mockOrganizationName = await enableMocks();

  // The organization comes from the session (UI_UX_SPECIFICATION.md §2). The
  // session contract is ADR-01, so outside mock mode the shell says "pending"
  // rather than inventing a source for the value.
  const identity: OrganizationIdentity =
    mockOrganizationName === null
      ? PENDING_IDENTITY
      : { name: mockOrganizationName, source: 'mock' };

  const container = document.getElementById('root');
  if (container === null) {
    throw new Error('Missing #root element in index.html');
  }

  createRoot(container).render(
    <StrictMode>
      <App queryClient={createQueryClient()} router={createAppRouter()} identity={identity} />
    </StrictMode>,
  );
}

void bootstrap();
