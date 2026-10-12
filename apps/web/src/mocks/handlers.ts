import { http, HttpResponse } from 'msw';
import { REQUEST_ID_RESPONSE_HEADER } from '@flowup/contracts';

import { env } from '@/env';
import { API_PATH_PREFIX } from '@/lib/api';
import { applications, deliveries, errorEnvelope, events, pageOf } from './fixtures';

/**
 * FE-01 D8 — request handlers shared by development and tests.
 *
 * Every handler answers with the documented envelopes: cursor pagination
 * `{ data, next_cursor }` and the error envelope. Handlers cover read routes
 * only; no handler returns a fabricated success for a mutation.
 */
const base = `${env.apiBaseUrl}${API_PATH_PREFIX}`;
const MOCK_REQUEST_ID = 'req_mock0000000000000000000000000001';

function withRequestId(headers: Record<string, string> = {}): Record<string, string> {
  return { ...headers, [REQUEST_ID_RESPONSE_HEADER]: MOCK_REQUEST_ID };
}

export const handlers = [
  http.get(`${base}/applications`, ({ request }) => {
    const cursor = new URL(request.url).searchParams.get('cursor');
    if (cursor === null) {
      return HttpResponse.json(pageOf(applications.slice(0, 2), 'cursor_page_2'), {
        headers: withRequestId(),
      });
    }
    return HttpResponse.json(pageOf(applications.slice(2), null), { headers: withRequestId() });
  }),

  http.get(`${base}/events`, () => HttpResponse.json(pageOf(events), { headers: withRequestId() })),

  http.get(`${base}/deliveries`, () =>
    HttpResponse.json(pageOf(deliveries), { headers: withRequestId() }),
  ),

  // Deterministic failure routes used to exercise error handling in
  // development without needing a backend that can fail on demand.
  http.get(`${base}/__mock__/unauthenticated`, () =>
    HttpResponse.json(errorEnvelope('unauthenticated', 'Session expired'), { status: 401 }),
  ),
  http.get(`${base}/__mock__/forbidden`, () =>
    HttpResponse.json(errorEnvelope('forbidden', 'Not allowed'), { status: 403 }),
  ),
  http.get(`${base}/__mock__/rate-limited`, () =>
    HttpResponse.json(errorEnvelope('rate_limited', 'Too many requests'), {
      status: 429,
      headers: { 'retry-after': '7' },
    }),
  ),
];
