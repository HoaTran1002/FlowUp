import { describe, expect, it } from 'bun:test';
import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { createLogger } from '@flowup/config';
import { ERROR_CODES, errorEnvelopeSchema } from '@flowup/contracts';

import { ErrorEnvelopeFilter } from './error-envelope.filter';

/**
 * The error envelope (BE-01 §6.1, API_SPECIFICATION.md §1).
 *
 * Phase 1 covers `400`, `401`, `403`, `404`, `409`, `413`, `422`, `429` and
 * `5xx` even though no business route emits them yet.
 */
interface Captured {
  status?: number;
  body?: unknown;
}

function run(exception: unknown): Captured {
  const captured: Captured = {};
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  const filter = new ErrorEnvelopeFilter(
    createLogger({ role: 'api', level: 'error', write: () => undefined }),
  );
  filter.catch(exception, host);
  return captured;
}

const EXPECTED: [number, string][] = [
  [HttpStatus.BAD_REQUEST, 'validation_failed'],
  [HttpStatus.UNAUTHORIZED, 'unauthenticated'],
  [HttpStatus.FORBIDDEN, 'forbidden'],
  [HttpStatus.NOT_FOUND, 'not_found'],
  [HttpStatus.CONFLICT, 'conflict'],
  [HttpStatus.PAYLOAD_TOO_LARGE, 'payload_too_large'],
  [HttpStatus.UNPROCESSABLE_ENTITY, 'unprocessable_entity'],
  [HttpStatus.TOO_MANY_REQUESTS, 'rate_limited'],
  [HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error'],
  [HttpStatus.SERVICE_UNAVAILABLE, 'internal_error'],
];

describe('error envelope', () => {
  for (const [status, code] of EXPECTED) {
    it(`maps ${String(status)} to ${code} in the documented envelope`, () => {
      const captured = run(new HttpException('ignored framework message', status));

      expect(captured.status).toBe(status);
      const envelope = errorEnvelopeSchema.parse(captured.body);
      expect(envelope.error.code).toBe(code);
      expect(ERROR_CODES as readonly string[]).toContain(envelope.error.code);
      expect(envelope.error.request_id.length).toBeGreaterThan(0);
      expect(envelope.error.details).toEqual({});
    });
  }

  it('maps an unknown thrown value to 500 without leaking it', () => {
    const captured = run(new Error('connection to postgresql://user:hunter2@db failed'));

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const serialized = JSON.stringify(captured.body);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('postgresql://');
    expect(errorEnvelopeSchema.parse(captured.body).error.code).toBe('internal_error');
  });

  it('never echoes the framework exception message', () => {
    const captured = run(
      new HttpException(
        { message: ['data.card must be numeric', '4242424242424242'] },
        HttpStatus.BAD_REQUEST,
      ),
    );

    const serialized = JSON.stringify(captured.body);
    expect(serialized).not.toContain('4242424242424242');
    expect(serialized).not.toContain('data.card');
  });

  it('derives the status from an http-errors style body-parser failure', () => {
    // This is how the configured body size limit surfaces: a plain error with
    // a numeric `status`, not an HttpException.
    const captured = run(
      Object.assign(new Error('request entity too large'), {
        status: 413,
        type: 'entity.too.large',
      }),
    );

    expect(captured.status).toBe(413);
    expect(errorEnvelopeSchema.parse(captured.body).error.code).toBe('payload_too_large');
  });

  it('emits no stack trace', () => {
    const error = new Error('boom');
    const captured = run(error);
    const serialized = JSON.stringify(captured.body);
    expect(serialized).not.toContain('at ');
    expect(serialized).not.toContain('.ts:');
  });
});
