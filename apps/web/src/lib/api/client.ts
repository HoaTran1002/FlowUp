import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { REQUEST_ID_RESPONSE_HEADER } from '@flowup/contracts';

import { env } from '@/env';
import { attachCsrfToken } from './csrf';
import { ApiError, normalizeApiError } from './errors';

/**
 * FE-01 D5 — the one HTTP client the dashboard owns.
 *
 * Raw `fetch` and ad hoc Axios instances must not appear in components
 * (apps/web/AGENTS.md §2.4). Every rejection reaching a caller is an
 * `ApiError`.
 *
 * Authentication is the human session cookie, so `withCredentials` is on. A
 * machine publishing key (`flw_...`) must never be attached to a dashboard
 * request (INV-08, apps/web/AGENTS.md §3.2); the request interceptor below
 * enforces that structurally rather than by convention.
 */

/** The business API lives under `/v1` (`API_SPECIFICATION.md`, "Base: /v1"). */
export const API_PATH_PREFIX = '/v1';

/** Machine publishing keys are prefixed `flw_` (`API_SPECIFICATION.md` §4). */
const PRODUCER_KEY_PATTERN = /flw_/i;

export class ProducerKeyLeakError extends Error {
  constructor(header: string) {
    super(
      `Refusing to send a request: header "${header}" looks like a producer publishing key. ` +
        'Machine keys belong to server-side producers only (INV-08).',
    );
    this.name = 'ProducerKeyLeakError';
  }
}

/**
 * Fails the request rather than letting a producer key leave the browser.
 *
 * This is a guard, not a feature: no dashboard code path should ever set such
 * a header. It exists so that a future mistake fails loudly and visibly in a
 * test instead of silently shipping a credential to the API.
 */
export function assertNoProducerKey(headers: Record<string, unknown>): void {
  for (const [header, value] of Object.entries(headers)) {
    if (typeof value === 'string' && PRODUCER_KEY_PATTERN.test(value)) {
      throw new ProducerKeyLeakError(header);
    }
  }
}

type UnauthorizedHandler = (error: ApiError) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registers the single "session expired" reaction (FE-01 §6).
 *
 * `401` clears cached data and routes to the login placeholder. The client
 * owns the detection; the application root owns the reaction, so this module
 * depends on neither the router nor the query cache.
 */
export function onUnauthorized(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function createApiClient(overrides: AxiosRequestConfig = {}): AxiosInstance {
  const instance = axios.create({
    baseURL: `${env.apiBaseUrl}${API_PATH_PREFIX}`,
    withCredentials: true,
    headers: { Accept: 'application/json' },
    ...overrides,
  });

  instance.interceptors.request.use((config) => {
    assertNoProducerKey(config.headers as unknown as Record<string, unknown>);
    return attachCsrfToken(config);
  });

  instance.interceptors.response.use(
    (response) => response,
    (cause: unknown) => {
      // The producer-key guard is a programming error, not an API failure.
      // Normalizing it into a generic message would hide exactly what it
      // exists to make loud.
      if (cause instanceof ProducerKeyLeakError) {
        return Promise.reject(cause);
      }
      const error = normalizeApiError(cause, REQUEST_ID_RESPONSE_HEADER);
      if (error.kind === 'unauthenticated') {
        unauthorizedHandler?.(error);
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

export const apiClient: AxiosInstance = createApiClient();
