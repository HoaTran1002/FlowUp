import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';
import { createQueryClient } from './client';

function apiError(kind: ApiError['kind'], status: number | null): ApiError {
  return new ApiError({
    kind,
    message: 'm',
    status,
    code: null,
    requestId: null,
    details: {},
    retryAfterSeconds: null,
  });
}

function Probe({ fn }: { fn: () => Promise<string> }): React.JSX.Element {
  const query = useQuery({ queryKey: ['probe'], queryFn: fn, retryDelay: 1 });
  if (query.isPending) return <p>loading</p>;
  if (query.isError) return <p>error:{query.error.message}</p>;
  return <p>success:{query.data}</p>;
}

function renderWith(client: QueryClient, fn: () => Promise<string>): void {
  render(
    <QueryClientProvider client={client}>
      <Probe fn={fn} />
    </QueryClientProvider>,
  );
}

describe('query client defaults', () => {
  it('renders loading, then success', async () => {
    renderWith(createQueryClient(), () => Promise.resolve('ok'));

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('success:ok')).toBeInTheDocument();
  });

  it('does not retry a 422', async () => {
    const fn = vi.fn(() => Promise.reject(apiError('unprocessable', 422)));
    renderWith(createQueryClient(), fn);

    expect(await screen.findByText('error:m')).toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry any 4xx kind', async () => {
    for (const [kind, status] of [
      ['validation', 400],
      ['unauthenticated', 401],
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['rate_limited', 429],
    ] as const) {
      const fn = vi.fn(() => Promise.reject(apiError(kind, status)));
      const client = createQueryClient();
      renderWith(client, fn);
      await waitFor(() => {
        expect(client.getQueryState(['probe'])?.status).toBe('error');
      });
      expect(fn).toHaveBeenCalledTimes(1);
      client.clear();
      document.body.innerHTML = '';
    }
  });

  it('retries a transient 5xx a bounded number of times', async () => {
    const fn = vi.fn(() => Promise.reject(apiError('server', 503)));
    renderWith(createQueryClient(), fn);

    await screen.findByText('error:m');
    expect(fn).toHaveBeenCalledTimes(3); // first attempt + 2 retries
  });

  it('never retries a mutation', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it('registers no cache persister (INV-08)', () => {
    const client = createQueryClient();
    // A persister would be attached through persistQueryClient / a persist
    // provider; neither is a dependency, and no storage is touched.
    expect(Object.keys(client)).not.toContain('persister');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
