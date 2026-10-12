import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';

import { AppShell } from '@/components/layout/app-shell';
import { NotFound } from '@/components/state/not-found';
import { PlaceholderPage } from '@/components/state/placeholder';
import {
  apiKeysSearchSchema,
  applicationsSearchSchema,
  deliveriesSearchSchema,
  endpointsSearchSchema,
  eventsSearchSchema,
  searchValidator,
  usageSearchSchema,
} from './search-params';

/**
 * FE-01 D3 — the exact route tree of UI_UX_SPECIFICATION.md §2. No route here
 * is invented, and every leaf is a placeholder that names the task which will
 * implement it and shows no data.
 *
 * `/app/*` sits under one layout route that renders the shell. That layout is
 * structural only: phase 1 implements NO client-side auth guard, because a
 * guard would imply authorization the client cannot provide — the server is
 * the sole gate (apps/web/AGENTS.md §3.3). FE-02 attaches the session check
 * once ADR-01 is resolved.
 */

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirect contract
    throw redirect({ to: '/app/overview', replace: true });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => (
    <main className="mx-auto max-w-xl p-4">
      <PlaceholderPage
        title="Sign in"
        task="FE-02"
        blockedBy="ADR-01"
        summary="Sign-in, invitation and session bootstrap. The auth contract is an open decision and no auth endpoint is assumed."
      />
    </main>
  ),
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppShell,
});

function leaf(
  path: string,
  props: { title: string; task: string; summary: string; blockedBy?: string },
  validateSearch?: (search: Record<string, unknown>) => Record<string, unknown>,
) {
  return createRoute({
    getParentRoute: () => appRoute,
    path,
    ...(validateSearch === undefined ? {} : { validateSearch }),
    component: () => <PlaceholderPage {...props} />,
  });
}

const overviewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/overview',
  validateSearch: searchValidator(usageSearchSchema),
  component: () => (
    <PlaceholderPage
      title="Overview"
      task="FE-09"
      summary="Accepted events, delivered, final failures and pending deliveries for a date range."
    />
  ),
});

const applicationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/applications',
  validateSearch: searchValidator(applicationsSearchSchema),
  component: () => (
    <PlaceholderPage
      title="Applications"
      task="FE-03"
      summary="Create, edit and disable applications; show the application ID and a sample publish payload."
    />
  ),
});

const applicationDetailRoute = leaf('/applications/$applicationId', {
  title: 'Application detail',
  task: 'FE-03',
  summary: 'One application, its status and integration instructions.',
});

const endpointsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/endpoints',
  validateSearch: searchValidator(endpointsSearchSchema),
  component: () => (
    <PlaceholderPage
      title="Endpoints"
      task="FE-04"
      summary="Application, hostname, status and subscribed event types."
    />
  ),
});

// `/endpoints/new` is declared before `/endpoints/$endpointId` so the literal
// segment is never captured as an identifier.
const endpointNewRoute = leaf('/endpoints/new', {
  title: 'Create endpoint',
  task: 'FE-04',
  summary: 'HTTPS URL, display name, application and subscribed event types.',
});

const endpointDetailRoute = leaf('/endpoints/$endpointId', {
  title: 'Endpoint detail',
  task: 'FE-04',
  summary: 'Endpoint settings, subscriptions, enable/disable and secret rotation.',
});

const eventsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/events',
  validateSearch: searchValidator(eventsSearchSchema),
  component: () => (
    <PlaceholderPage
      title="Events"
      task="FE-06"
      summary="Accepted events with time, type and application filters."
    />
  ),
});

const eventDetailRoute = leaf('/events/$eventId', {
  title: 'Event detail',
  task: 'FE-06',
  summary: 'One accepted event and its delivery summary.',
});

const deliveriesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/deliveries',
  validateSearch: searchValidator(deliveriesSearchSchema),
  component: () => (
    <PlaceholderPage
      title="Deliveries"
      task="FE-07"
      summary="Status, endpoint, attempt count and next retry for each independent delivery."
    />
  ),
});

const deliveryDetailRoute = leaf('/deliveries/$deliveryId', {
  title: 'Delivery detail',
  task: 'FE-07',
  summary: 'One delivery, its per-attempt timeline and the replay control (FE-08).',
});

const apiKeysRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/api-keys',
  validateSearch: searchValidator(apiKeysSearchSchema),
  component: () => (
    <PlaceholderPage
      title="API keys"
      task="FE-05"
      blockedBy="ADR-01"
      summary="Admin only. Key metadata, one-time key creation and revocation. The role check is attached by FE-02; the server is the sole gate."
    />
  ),
});

const settingsRoute = leaf('/settings', {
  title: 'Settings',
  task: 'FE-02',
  summary: 'Profile and organization, read-only in the pilot.',
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  appRoute.addChildren([
    overviewRoute,
    applicationsRoute,
    applicationDetailRoute,
    endpointsRoute,
    endpointNewRoute,
    endpointDetailRoute,
    eventsRoute,
    eventDetailRoute,
    deliveriesRoute,
    deliveryDetailRoute,
    apiKeysRoute,
    settingsRoute,
  ]),
]);

function buildRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    ...(history === undefined ? {} : { history }),
    defaultPreload: false,
    defaultNotFoundComponent: NotFound,
  });
}

export type AppRouter = ReturnType<typeof buildRouter>;

export function createAppRouter(history?: RouterHistory): AppRouter {
  return buildRouter(history);
}

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}

/** The leaf paths the router resolves, for the route-coverage test (FE-01 §4). */
export const IMPLEMENTED_ROUTE_PATHS = [
  '/login',
  '/app/overview',
  '/app/applications',
  '/app/applications/$applicationId',
  '/app/endpoints',
  '/app/endpoints/new',
  '/app/endpoints/$endpointId',
  '/app/events',
  '/app/events/$eventId',
  '/app/deliveries',
  '/app/deliveries/$deliveryId',
  '/app/api-keys',
  '/app/settings',
] as const;
