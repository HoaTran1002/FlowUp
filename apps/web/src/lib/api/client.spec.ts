import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { API_PATH_PREFIX, apiClient, assertNoProducerKey, onUnauthorized } from './client';
import { isApiError } from './errors';
import { env } from '@/env';

/**
 * FE-01 §6 / INV-08: the dashboard client has no code path that can send a
 * producer publishing key, and a `401` is a session-expiry signal.
 */
const base = `${env.apiBaseUrl}${API_PATH_PREFIX}`;
const seen: Headers[] = [];

const server = setupServer(
  http.get(`${base}/ping`, ({ request }) => {
    seen.push(request.headers);
    return HttpResponse.json({ ok: true });
  }),
  http.get(`${base}/expired`, () =>
    HttpResponse.json(
      {
        error: {
          code: 'unauthenticated',
          message: 'Session expired',
          request_id: 'req_x00000001',
          details: {},
        },
      },
      { status: 401 },
    ),
  ),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  seen.length = 0;
  onUnauthorized(null);
});
afterAll(() => {
  server.close();
});

describe('no producer key in the browser', () => {
  it('sends no header whose value carries a flw_ key on an ordinary request', async () => {
    await apiClient.get('/ping');

    expect(seen).toHaveLength(1);
    for (const [name, value] of seen[0]?.entries() ?? []) {
      expect(value, `header ${name}`).not.toMatch(/flw_/i);
    }
  });

  it('uses the session cookie rather than a bearer credential', async () => {
    await apiClient.get('/ping');

    expect(seen[0]?.get('authorization')).toBeNull();
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it('refuses to send a request that carries a producer key', async () => {
    const fakeKey = ['flw', 'live', 'placeholder'].join('_');

    await expect(
      apiClient.get('/ping', { headers: { Authorization: `Bearer ${fakeKey}` } }),
    ).rejects.toThrow(/producer publishing key/);
    expect(seen).toHaveLength(0);
  });

  it('assertNoProducerKey accepts ordinary headers', () => {
    expect(() => {
      assertNoProducerKey({ Accept: 'application/json', 'X-Request-Id': 'req_abc12345' });
    }).not.toThrow();
  });
});

describe('response handling', () => {
  it('rejects with a normalized ApiError carrying request_id', async () => {
    const error = await apiClient.get('/expired').catch((cause: unknown) => cause);

    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      kind: 'unauthenticated',
      status: 401,
      requestId: 'req_x00000001',
    });
  });

  it('notifies the registered handler on 401 and not on success', async () => {
    const handler = vi.fn();
    onUnauthorized(handler);

    await apiClient.get('/ping');
    expect(handler).not.toHaveBeenCalled();

    await apiClient.get('/expired').catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
