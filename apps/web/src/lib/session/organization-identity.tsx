import { createContext, useContext, type ReactNode } from 'react';

/**
 * FE-01 D4 — the organization identity shown in the shell header.
 *
 * `UI_UX_SPECIFICATION.md` §2 requires the organization to be visible in the
 * header and forbids a tenant selector: identity comes from the session.
 *
 * The session contract is ADR-01 and is unresolved, and
 * `API_SPECIFICATION.md` defines no route that returns the current
 * organization. FE-01 therefore does NOT fetch it — inventing a route would
 * fabricate a contract (AGENT_ADAPTER.md §6.2). Instead the value is injected:
 * the mock layer supplies it in development, and the shell states plainly that
 * it is pending until FE-02 reads it from the approved session response.
 */
export interface OrganizationIdentity {
  readonly name: string | null;
  readonly source: 'mock' | 'pending-adr-01';
}

export const PENDING_IDENTITY: OrganizationIdentity = {
  name: null,
  source: 'pending-adr-01',
};

const OrganizationIdentityContext = createContext<OrganizationIdentity>(PENDING_IDENTITY);

export function OrganizationIdentityProvider({
  identity,
  children,
}: {
  identity: OrganizationIdentity;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <OrganizationIdentityContext.Provider value={identity}>
      {children}
    </OrganizationIdentityContext.Provider>
  );
}

export function useOrganizationIdentity(): OrganizationIdentity {
  return useContext(OrganizationIdentityContext);
}
