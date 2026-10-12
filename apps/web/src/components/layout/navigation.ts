/**
 * FE-01 D4 — the primary navigation, in the exact order fixed by
 * `UI_UX_SPECIFICATION.md` §2:
 *
 *   Overview | Applications | Endpoints | Events | Deliveries | API Keys (Admin)
 *
 * Settings is reachable from the shell but is not a primary item.
 *
 * `adminOnly` is STRUCTURAL metadata only. Phase 1 renders every item: a
 * hidden control is not an access control, and the server is the sole
 * authorization gate (AGENTS.md §7, apps/web/AGENTS.md §3.3). FE-02 attaches
 * the real role check to this flag.
 */
export interface NavigationItem {
  readonly label: string;
  readonly to: string;
  readonly adminOnly: boolean;
  readonly testId: string;
}

export const PRIMARY_NAVIGATION: readonly NavigationItem[] = [
  { label: 'Overview', to: '/app/overview', adminOnly: false, testId: 'nav-overview' },
  { label: 'Applications', to: '/app/applications', adminOnly: false, testId: 'nav-applications' },
  { label: 'Endpoints', to: '/app/endpoints', adminOnly: false, testId: 'nav-endpoints' },
  { label: 'Events', to: '/app/events', adminOnly: false, testId: 'nav-events' },
  { label: 'Deliveries', to: '/app/deliveries', adminOnly: false, testId: 'nav-deliveries' },
  { label: 'API Keys', to: '/app/api-keys', adminOnly: true, testId: 'nav-api-keys' },
] as const;

export const SETTINGS_NAVIGATION: NavigationItem = {
  label: 'Settings',
  to: '/app/settings',
  adminOnly: false,
  testId: 'nav-settings',
};
