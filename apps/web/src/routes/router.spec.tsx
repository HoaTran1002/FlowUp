import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/render-app';
import { IMPLEMENTATION_TASK_BY_PATH } from './router.fixtures';

/**
 * FE-01 §4 / §5 — route coverage, shell, navigation order and accessibility.
 */
describe('route tree', () => {
  for (const [path, task] of Object.entries(IMPLEMENTATION_TASK_BY_PATH)) {
    it(`resolves ${path} to a placeholder naming ${task}`, async () => {
      await renderApp(path);

      const placeholder = await screen.findByTestId('route-placeholder');
      expect(placeholder).toHaveAttribute('data-task', task);
      expect(placeholder).toHaveTextContent('Not implemented');
    });
  }

  it('redirects / to /app/overview', async () => {
    const { router } = await renderApp('/');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app/overview');
    });
  });

  it('renders the 404 route for an unknown path', async () => {
    await renderApp('/app/does-not-exist');

    expect(await screen.findByTestId('not-found')).toBeInTheDocument();
  });

  it('renders the login placeholder outside the shell and marks it ADR-01 blocked', async () => {
    await renderApp('/login');

    expect(await screen.findByText(/Blocked by ADR-01/)).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
  });

  it('resolves /app/endpoints/new as the create route, not an endpoint id', async () => {
    await renderApp('/app/endpoints/new');

    expect(await screen.findByText('Create endpoint')).toBeInTheDocument();
  });

  it('never fakes data or a success path on a placeholder', async () => {
    await renderApp('/app/deliveries');

    await screen.findByTestId('route-placeholder');
    expect(screen.queryByText(/delivered/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('search parameters', () => {
  it('keeps typed filters from the URL', async () => {
    const { router } = await renderApp('/app/deliveries?status=FAILED&endpoint_id=end_1&limit=50&cursor=abc');

    expect(router.state.location.search).toMatchObject({
      status: 'FAILED',
      endpoint_id: 'end_1',
      limit: 50,
      cursor: 'abc',
    });
  });

  it('defaults the limit to 20 when absent', async () => {
    const { router } = await renderApp('/app/events');

    expect(router.state.location.search).toMatchObject({ limit: 20 });
  });

  it('degrades a malformed deep link to defaults instead of erroring', async () => {
    const { router } = await renderApp('/app/deliveries?status=NOT_A_STATUS&limit=9999');

    await screen.findByTestId('route-placeholder');
    const search = router.state.matches.at(-1)?.search;
    expect(search).toMatchObject({ limit: 20 });
    expect(search).not.toHaveProperty('status');
  });
});

describe('application shell', () => {
  it('lists primary navigation in the exact specified order', async () => {
    await renderApp('/app/overview');

    const nav = await screen.findByTestId('primary-navigation');
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim());

    expect(labels).toEqual([
      'Overview',
      'Applications',
      'Endpoints',
      'Events',
      'Deliveries',
      'API Keys (Admin only)',
    ]);
  });

  it('shows the organization identity from the session and offers no tenant selector', async () => {
    await renderApp('/app/overview');

    expect(await screen.findByTestId('organization-identity')).toHaveTextContent('Test Organization');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('states that identity is pending ADR-01 rather than inventing one', async () => {
    await renderApp('/app/overview', { name: null, source: 'pending-adr-01' });

    expect(await screen.findByTestId('organization-identity')).toHaveTextContent('pending (ADR-01)');
  });

  it('exposes the active route to assistive technology, not by color alone', async () => {
    await renderApp('/app/events');

    const active = await screen.findByTestId('nav-events');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-endpoints')).not.toHaveAttribute('aria-current');
  });

  it('keeps API Keys visible in phase 1: hiding is not an access control', async () => {
    await renderApp('/app/overview');

    expect(await screen.findByTestId('nav-api-keys')).toBeInTheDocument();
  });

  it('navigates between routes by keyboard', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/app/overview');

    const link = await screen.findByTestId('nav-applications');
    link.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app/applications');
    });
    expect(await screen.findByText('Applications', { selector: 'h3' })).toBeInTheDocument();
  });

  it('collapses navigation behind an accessible toggle', async () => {
    const user = userEvent.setup();
    await renderApp('/app/overview');

    const toggle = await screen.findByTestId('nav-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('Toggle navigation');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('search parameters: partial degradation', () => {
  it('keeps a valid filter when a sibling filter is malformed', async () => {
    const { router } = await renderApp('/app/deliveries?status=NOT_A_STATUS&endpoint_id=end_1');

    await screen.findByTestId('route-placeholder');
    const search = router.state.matches.at(-1)?.search;
    expect(search).toMatchObject({ endpoint_id: 'end_1' });
    expect(search).not.toHaveProperty('status');
  });
});
