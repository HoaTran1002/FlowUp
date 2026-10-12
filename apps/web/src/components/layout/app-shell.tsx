import { Link, Outlet } from '@tanstack/react-router';
import { MenuIcon, UserIcon } from 'lucide-react';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganizationIdentity } from '@/lib/session/organization-identity';
import { PRIMARY_NAVIGATION, SETTINGS_NAVIGATION } from './navigation';

/**
 * FE-01 D4 — the authenticated application shell.
 *
 * Header: product name, organization identity and a user-menu placeholder.
 * There is no tenant switcher: organization identity comes from the session
 * (`UI_UX_SPECIFICATION.md` §2).
 *
 * Active route indication is `aria-current="page"` plus a border and a weight
 * change, so it is never conveyed by color alone (UI_UX_SPECIFICATION.md §5).
 */
function OrganizationLabel(): React.JSX.Element {
  const identity = useOrganizationIdentity();

  if (identity.name === null) {
    return (
      <Badge variant="outline" data-testid="organization-identity">
        Organization pending (ADR-01)
      </Badge>
    );
  }

  return (
    <span data-testid="organization-identity" className="text-sm text-muted-foreground">
      Organization: <span className="font-medium text-foreground">{identity.name}</span>
    </span>
  );
}

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }): React.JSX.Element {
  return (
    <>
      {PRIMARY_NAVIGATION.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          data-testid={item.testId}
          onClick={onNavigate}
          className="rounded-md border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
          activeProps={{ 'aria-current': 'page' }}
        >
          {item.label}
          {item.adminOnly && <span className="sr-only"> (Admin only)</span>}
        </Link>
      ))}
    </>
  );
}

export function AppShell(): React.JSX.Element {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background" data-testid="app-shell">
      <header className="border-b border-border" data-testid="app-header">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/app/overview" className="text-base font-semibold" data-testid="brand">
            FlowUp
          </Link>

          <OrganizationLabel />

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="primary-navigation"
              aria-label="Toggle navigation"
              data-testid="nav-toggle"
              onClick={() => {
                setMobileNavOpen((open) => !open);
              }}
            >
              <MenuIcon aria-hidden="true" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="user-menu">
                  <UserIcon aria-hidden="true" />
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Signed-in user (FE-02)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={SETTINGS_NAVIGATION.to} data-testid={SETTINGS_NAVIGATION.testId}>
                    {SETTINGS_NAVIGATION.label}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav
          id="primary-navigation"
          aria-label="Primary"
          data-testid="primary-navigation"
          className={`mx-auto max-w-7xl px-4 pb-2 md:block ${mobileNavOpen ? 'block' : 'hidden'}`}
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1">
            <NavigationLinks
              onNavigate={() => {
                setMobileNavOpen(false);
              }}
            />
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl p-4" data-testid="app-main">
        <Outlet />
      </main>
    </div>
  );
}
