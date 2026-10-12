import { describe, expect, it } from 'bun:test';

import { createLogger, Logger } from './logger';
import { resolveRequestId } from './request-id';
import { isSensitiveKey, sanitizeFields } from './redaction';

/**
 * The redaction contract (BE-01 §3.2).
 *
 * The decisive case the specification names: a log record built from a request
 * carrying `Authorization: Bearer flw_test...` must contain no part of that
 * value.
 */
const BEARER_TOKEN = 'flw_test_51HxQ2pLkJ9mNbVcXzA8sD3fG7hJ4kL6pQ9rS2tU5vW8xY1zB';
const AUTHORIZATION_HEADER = `Bearer ${BEARER_TOKEN}`;

const INBOUND_REQUEST = {
  method: 'POST',
  path: '/v1/events',
  headers: {
    authorization: AUTHORIZATION_HEADER,
    cookie: 'flowup_session=abc123; other=def456',
    'idempotency-key': 'idem_9f8e7d6c5b4a',
    'flowup-signature': 't=1700000000,v1=deadbeefcafebabe',
    'x-request-id': 'req_0123456789abcdef',
    'content-type': 'application/json',
  },
  body: { type: 'order.created', data: { card: '4242424242424242' } },
};

function recordFrom(request: typeof INBOUND_REQUEST): string {
  const lines: string[] = [];
  const logger = createLogger({
    role: 'api',
    level: 'debug',
    write: (line) => lines.push(line),
  });

  const { requestId } = resolveRequestId(request.headers);

  logger.runWithContext(
    { request_id: requestId, http_method: request.method, http_route: request.path },
    () => {
      // The whole request is handed to the logger on purpose: the allowlist,
      // not the caller's discipline, is what has to stop the leak.
      logger.info('request received', {
        ...request,
        ...request.headers,
        authorization: request.headers.authorization,
        body: request.body,
      });
    },
  );

  expect(lines).toHaveLength(1);
  return lines[0] ?? '';
}

describe('log redaction', () => {
  it('contains no part of an Authorization: Bearer flw_test... value', () => {
    const line = recordFrom(INBOUND_REQUEST);

    expect(line).not.toContain(BEARER_TOKEN);
    expect(line).not.toContain(AUTHORIZATION_HEADER);
    expect(line).not.toContain('Bearer');
    expect(line).not.toContain('flw_test');
    // Not even the prefix of the key material.
    expect(line).not.toContain(BEARER_TOKEN.slice(0, 12));
    expect(line).not.toContain('authorization');
  });

  it('serializes no cookie, signature, idempotency key or body', () => {
    const line = recordFrom(INBOUND_REQUEST);

    expect(line).not.toContain('flowup_session');
    expect(line).not.toContain('idem_9f8e7d6c5b4a');
    expect(line).not.toContain('deadbeefcafebabe');
    expect(line).not.toContain('4242424242424242');
    expect(line).not.toContain('order.created');
    expect(line).not.toContain('cookie');
    expect(line).not.toContain('signature');
  });

  it('keeps the allowlisted correlation fields', () => {
    const record = JSON.parse(recordFrom(INBOUND_REQUEST)) as {
      request_id: string;
      http_method: string;
      http_route: string;
      process: string;
      level: string;
      msg: string;
    };

    expect(record.request_id).toBe('req_0123456789abcdef');
    expect(record.http_method).toBe('POST');
    expect(record.http_route).toBe('/v1/events');
    expect(record.process).toBe('api');
    expect(record.level).toBe('info');
    expect(record.msg).toBe('request received');
  });

  it('drops any field that is not on the allowlist', () => {
    expect(sanitizeFields({ request_id: 'req_1', surprise: 'value' })).toEqual({
      request_id: 'req_1',
    });
  });

  it('drops non-primitive values even on an allowlisted field', () => {
    expect(sanitizeFields({ request_id: { nested: 'object' } })).toEqual({});
  });

  it('recognises credential-shaped field names', () => {
    for (const key of [
      'authorization',
      'Cookie',
      'set-cookie',
      'flowup-signature',
      'Idempotency-Key',
      'signing_secret',
      'api_key',
      'session_token',
      'request_body',
      'password',
    ]) {
      expect(isSensitiveKey(key)).toBe(true);
    }

    for (const key of ['request_id', 'delivery_id', 'http_status', 'generation']) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });

  it('logs a thrown value as a category, never as a message', () => {
    const lines: string[] = [];
    const logger = createLogger({
      role: 'worker',
      level: 'debug',
      write: (line) => lines.push(line),
    });

    logger.errorCaught('delivery failed', new TypeError(`secret in message ${BEARER_TOKEN}`));

    const line = lines[0] ?? '';
    expect(line).toContain('"error_category":"TypeError"');
    expect(line).not.toContain(BEARER_TOKEN);
    expect(line).not.toContain('secret in message');
  });

  it('respects the configured level', () => {
    const lines: string[] = [];
    const logger = createLogger({ role: 'api', level: 'warn', write: (line) => lines.push(line) });

    logger.debug('ignored');
    logger.info('ignored');
    logger.warn('kept');
    logger.error('kept');

    expect(lines).toHaveLength(2);
  });

  it('isolates request-scoped context between concurrent requests', async () => {
    const lines: string[] = [];
    const logger = createLogger({ role: 'api', level: 'debug', write: (line) => lines.push(line) });

    const handle = (id: string): Promise<void> =>
      logger.runWithContext({ request_id: id }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(Logger.context().request_id).toBe(id);
        logger.info('handled');
      });

    await Promise.all([handle('req_aaaa1111'), handle('req_bbbb2222')]);

    const ids = lines.map((line) => (JSON.parse(line) as { request_id: string }).request_id);
    expect(ids.toSorted()).toEqual(['req_aaaa1111', 'req_bbbb2222']);
  });
});
