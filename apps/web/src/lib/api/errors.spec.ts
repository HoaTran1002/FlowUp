import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';

import { ApiError, normalizeApiError, type ApiErrorKind } from './errors';

const HEADER = 'x-request-id';

function responseError(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = {
    status,
    statusText: '',
    data,
    headers,
    config,
  };
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response);
}

const envelope = (code: string, message: string) => ({
  error: { code, message, request_id: 'req_envelope0001', details: { field: 'name' } },
});

const STATUS_TO_KIND: [number, ApiErrorKind][] = [
  [400, 'validation'],
  [401, 'unauthenticated'],
  [403, 'forbidden'],
  [404, 'not_found'],
  [409, 'conflict'],
  [413, 'payload_too_large'],
  [422, 'unprocessable'],
  [429, 'rate_limited'],
  [500, 'server'],
  [502, 'server'],
  [503, 'server'],
];

describe('normalizeApiError', () => {
  for (const [status, kind] of STATUS_TO_KIND) {
    it(`maps ${String(status)} to ${kind} and preserves the envelope`, () => {
      const error = normalizeApiError(
        responseError(status, envelope('some_code', 'Safe text')),
        HEADER,
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error.kind).toBe(kind);
      expect(error.status).toBe(status);
      expect(error.code).toBe('some_code');
      expect(error.message).toBe('Safe text');
      expect(error.requestId).toBe('req_envelope0001');
      expect(error.details).toEqual({ field: 'name' });
    });
  }

  it('falls back to the response header for request_id when there is no envelope', () => {
    const error = normalizeApiError(
      responseError(502, '<html>bad gateway</html>', { 'x-request-id': 'req_header0001' }),
      HEADER,
    );

    expect(error.kind).toBe('server');
    expect(error.requestId).toBe('req_header0001');
    expect(error.code).toBeNull();
  });

  it('never surfaces a non-envelope response body', () => {
    const error = normalizeApiError(
      responseError(500, 'Error: connect ECONNREFUSED 10.0.0.5:5432\n    at stack'),
      HEADER,
    );

    expect(error.message).not.toContain('ECONNREFUSED');
    expect(error.message).not.toContain('10.0.0.5');
  });

  it('reads Retry-After on a 429', () => {
    const error = normalizeApiError(
      responseError(429, envelope('rate_limited', 'Slow down'), { 'retry-after': '7' }),
      HEADER,
    );

    expect(error.kind).toBe('rate_limited');
    expect(error.retryAfterSeconds).toBe(7);
  });

  it('ignores an unparseable Retry-After', () => {
    const error = normalizeApiError(
      responseError(429, envelope('rate_limited', 'Slow down'), { 'retry-after': 'soon' }),
      HEADER,
    );

    expect(error.retryAfterSeconds).toBeNull();
  });

  it('classifies a request that never got a response as network', () => {
    const config = { headers: new AxiosHeaders() };
    const error = normalizeApiError(new AxiosError('Network Error', 'ERR_NETWORK', config), HEADER);

    expect(error.kind).toBe('network');
    expect(error.status).toBeNull();
    expect(error.requestId).toBeNull();
    expect(error.isRetryable).toBe(true);
  });

  it('classifies an aborted-by-timeout request as timeout', () => {
    const config = { headers: new AxiosHeaders() };
    const error = normalizeApiError(new AxiosError('timeout', 'ECONNABORTED', config), HEADER);

    expect(error.kind).toBe('timeout');
    expect(error.isRetryable).toBe(true);
  });

  it('treats a 4xx as not retryable', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 422, 429]) {
      expect(normalizeApiError(responseError(status, {}), HEADER).isRetryable).toBe(false);
    }
  });

  it('treats a 5xx as retryable', () => {
    expect(normalizeApiError(responseError(503, {}), HEADER).isRetryable).toBe(true);
  });

  it('returns an existing ApiError unchanged', () => {
    const first = normalizeApiError(responseError(404, envelope('not_found', 'Nope')), HEADER);
    expect(normalizeApiError(first, HEADER)).toBe(first);
  });

  it('maps an unknown thrown value to unknown without leaking it', () => {
    const error = normalizeApiError(new Error('secret internal detail'), HEADER);

    expect(error.kind).toBe('unknown');
    expect(error.message).not.toContain('secret internal detail');
  });
});
