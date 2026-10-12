import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Empty } from '@/components/state/empty';
import { ErrorState } from '@/components/state/error-state';
import { Loading } from '@/components/state/loading';
import { env } from '@/env';
import { API_PATH_PREFIX, apiClient, fetchCursorPage } from '@/lib/api';
import { createQueryClient, queryKeys } from '@/lib/query';
import { applications, errorEnvelope, pageOf, type ApplicationFixture } from './fixtures';
import { handlers } from './handlers';

/**
 * FE-01 §10 — integration (mocked API): one list view rendering a cursor page
 * and an error page, through the real Axios client and the real query client,
 * against the SAME handlers development uses.
 *
 * The list component below is test-only. Phase 1 ships no business screen; it
 * exists to prove the stack composes end to end before FE-03 builds one.
 */
const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function ApplicationsList(): React.JSX.Element {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors.at(-1) ?? null;

  const query = useQuery({
    queryKey: queryKeys.applications.list({ cursor }),
    queryFn: ({ signal }) =>
      fetchCursorPage<ApplicationFixture>(apiClient, '/applications', { limit: 2, cursor }, signal),
  });

  if (query.isPending) return <Loading label="Loading applications" />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.data.data.length === 0) return <Empty title="No applications" />;

  const next = query.data.next_cursor;
  return (
    <div>
      <ul>
        {query.data.data.map((app) => (
          <li key={app.id}>
            {app.name} · {app.status}
          </li>
        ))}
      </ul>
      <button
        disabled={next === null}
        onClick={() => {
          if (next !== null) setCursors((all) => [...all, next]);
        }}
      >
        Next
      </button>
    </div>
  );
}

function renderList(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ApplicationsList />
    </QueryClientProvider>,
  );
}

describe('mocked API: cursor page', () => {
  it('shows loading, then the first page, then follows next_cursor', async () => {
    renderList();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('Customer Alpha · ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Customer Beta · DISABLED')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Customer Gamma · ACTIVE')).toBeInTheDocument();
    // Last page: next_cursor is null, so there is nothing further to follow.
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('renders an empty page as an empty state, not an error', async () => {
    server.use(http.get(`${env.apiBaseUrl}${API_PATH_PREFIX}/applications`, () => HttpResponse.json(pageOf([]))));
    renderList();

    expect(await screen.findByTestId('state-empty')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('mocked API: error page', () => {
  it('renders the envelope message and the request_id', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}${API_PATH_PREFIX}/applications`, () =>
        HttpResponse.json(errorEnvelope('forbidden', 'Not allowed for your role', 'req_denied00001'), {
          status: 403,
        }),
      ),
    );
    renderList();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Not allowed for your role');
    expect(alert).toHaveTextContent('req_denied00001');
    // A 403 is a decision, not a transient fault: no retry loop, no retry button.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('retries a transient 503 and then succeeds', async () => {
    let calls = 0;
    server.use(
      http.get(`${env.apiBaseUrl}${API_PATH_PREFIX}/applications`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorEnvelope('internal_error', 'Try later'), { status: 503 })
          : HttpResponse.json(pageOf(applications.slice(0, 1)));
      }),
    );
    renderList();

    expect(await screen.findByText('Customer Alpha · ACTIVE', {}, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => {
      expect(calls).toBe(2);
    });
  });
});

describe('fixture honesty', () => {
  it('uses the documented envelope shape', () => {
    expect(Object.keys(pageOf([]))).toEqual(['data', 'next_cursor']);
    expect(errorEnvelope('x', 'y').error).toEqual(
      expect.objectContaining({ code: 'x', message: 'y', details: {} }),
    );
  });

  it('contains no credential-shaped value (INV-08)', async () => {
    const fixtures = await import('./fixtures');
    const serialized = JSON.stringify(fixtures);

    expect(serialized).not.toMatch(/flw_/i);
    expect(serialized).not.toMatch(/whsec_|secret|signature/i);
  });
});
