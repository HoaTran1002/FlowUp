import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { Logger, errorCategory, generateRequestId } from '@flowup/config';
import type { ErrorEnvelope } from '@flowup/contracts';
import type { Response } from 'express';

/**
 * The global exception filter (BE-01 §6.1).
 *
 * Emits the error envelope from `API_SPECIFICATION.md` §1 —
 * `{ error: { code, message, request_id, details } }` — for every failure, and
 * nothing else. No payload, no credential, no stack trace, no downstream
 * response body ever reaches the client (INV-08).
 *
 * The `message` is a FIXED, safe string chosen by status code. The underlying
 * exception message is deliberately discarded: a validation or driver message
 * can quote request content, a URL or a connection string. `details` is empty
 * in phase 1; a later task may add safe structured context, never raw input.
 *
 * Phase 1 covers every status shape the API will emit even though no business
 * route produces them yet.
 */
const SAFE_RESPONSES: Record<number, { code: string; message: string }> = {
  [HttpStatus.BAD_REQUEST]: { code: 'validation_failed', message: 'The request is malformed.' },
  [HttpStatus.UNAUTHORIZED]: {
    code: 'unauthenticated',
    message: 'Authentication is required.',
  },
  [HttpStatus.FORBIDDEN]: {
    code: 'forbidden',
    message: 'The authenticated principal may not perform this operation.',
  },
  [HttpStatus.NOT_FOUND]: { code: 'not_found', message: 'The resource does not exist.' },
  [HttpStatus.CONFLICT]: {
    code: 'conflict',
    message: 'The request conflicts with the current state of the resource.',
  },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: 'payload_too_large',
    message: 'The request body exceeds the configured limit.',
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    code: 'unprocessable_entity',
    message: 'The request is well-formed but semantically invalid.',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'rate_limited',
    message: 'The rate limit for this principal has been exceeded.',
  },
};

const INTERNAL = { code: 'internal_error', message: 'The request could not be completed.' };

/**
 * Resolves the HTTP status of an arbitrary thrown value.
 *
 * Body-parser (and every other `http-errors` producer, such as the configured
 * body size limit) throws a plain error carrying a numeric `status`. Reading
 * it here is what makes `413` fall out of CONFIGURATION instead of a hand-written
 * size check in a handler (BE-01 §6.1).
 */
function resolveStatus(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();

  if (typeof exception === 'object' && exception !== null) {
    const candidate = exception as { status?: unknown; statusCode?: unknown };
    for (const value of [candidate.status, candidate.statusCode]) {
      if (typeof value === 'number' && value >= 400 && value <= 599) return value;
    }
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const status = resolveStatus(exception);

    const safe = status >= 500 ? INTERNAL : (SAFE_RESPONSES[status] ?? INTERNAL);

    // The envelope's request_id is the one the request's log records carry.
    const requestId = Logger.context().request_id;
    const effectiveRequestId = typeof requestId === 'string' ? requestId : generateRequestId();

    const level = status >= 500 ? 'error' : 'warn';
    this.logger[level]('request failed', {
      http_status: status,
      error_category: errorCategory(exception),
      request_id: effectiveRequestId,
    });

    const envelope: ErrorEnvelope = {
      error: {
        code: safe.code,
        message: safe.message,
        request_id: effectiveRequestId,
        details: {},
      },
    };

    response.status(status).json(envelope);
  }
}
