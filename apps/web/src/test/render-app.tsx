import { createMemoryHistory } from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';

import { App } from '@/app';
import { createQueryClient } from '@/lib/query';
import type { OrganizationIdentity } from '@/lib/session/organization-identity';
import { createAppRouter } from '@/routes/router';

/** Renders the real application root against an in-memory URL. */
export async function renderApp(
  initialPath: string,
  identity: OrganizationIdentity = { name: 'Test Organization', source: 'mock' },
): Promise<RenderResult & { router: ReturnType<typeof createAppRouter> }> {
  const history = createMemoryHistory({ initialEntries: [initialPath] });
  const router = createAppRouter(history);
  await router.load();

  const result = render(
    <App queryClient={createQueryClient()} router={router} identity={identity} />,
  );
  return Object.assign(result, { router });
}
