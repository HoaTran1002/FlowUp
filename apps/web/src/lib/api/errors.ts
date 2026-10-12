import { AxiosError } from 'axios';
import { errorEnvelopeSchema } from '@flowup/contracts';

/**
 * FE-01 D5 — one normalized error shape for the whole dashboard.
 *
 * Every failure a screen can see arrives here first: a documented envelope
 * (`API_SPECIFICATION.md` §1), a response without one, a network failure or a
 * timeout. Screens branch on `kind`, never on a raw status code scattered
 * through components.
 *
 * `request_id` is preserved so a user can quote it to support (FE-01 §6).
 * Internals are never surfaced: no stack trace, no downstream body, no
 * credential (INV-08).
 */

export const API_ERROR_KINDS = [
  'validation',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'payload_too_large',
  'unprocessable',
  'rate_limited',
  'server',
  'network',
  'timeout',
  'unknown',
] as const;

export type ApiErrorKind = (typeof API_ERROR_KINDS)[number];

/** Safe, actionable default copy. Used when the envelope carries no message. */
const DEFAULT_MESSAGE: Record<ApiErrorKind, string> = {
  validation: 'The request was rejected. Check the highlighted fields and try again.',
  unauthenticated: 'Your session has expired. Sign in again to continue.',
  forbidden: 'You do not have permission to perform this action.',
  not_found: 'This resource does not exist, or it is not part of your organization.',
  conflict: 'This resource changed since it was loaded. Refresh and try again.',
  payload_too_large: 'The request is larger than the allowed limit.',
  unprocessable: 'The request could not be processed. Review the values and try again.',
  rate_limited: 'Too many requests. Wait a moment and try again.',
  server: 'FlowUp could not complete the request. Try again in a moment.',
  network: 'FlowUp could not be reached. Check your connection and try again.',
  timeout: 'The request took too long to complete. Try again.',
  unknown: 'Something went wrong. Try again.',
};

const KIND_BY_STATUS: Record<number, ApiErrorKind> = {
  400: 'validation',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  422: 'unprocessable',
  429: 'rate_limited',
};

/** A transport-level failure may be retried safely; a rejected request may not. */
const RETRYABLE_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'network',
  'timeout',
  'server',
]);

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  status: number | null;
  code: string | null;
  requestId: string | null;
  details: Record<string, unknown>;
  retryAfterSeconds: number | null;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, or `null` when the request never produced a response. */
  readonly status: number | null;
  /** The stable catalog code from the envelope, when the API supplied one. */
  readonly code: string | null;
  readonly requestId: string | null;
  readonly details: Record<string, unknown>;
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.details = init.details;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }

  get isRetryable(): boolean {
    return RETRYABLE_KINDS.has(this.kind);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function kindForStatus(status: number): ApiErrorKind {
  return KIND_BY_STATUS[status] ?? (status >= 500 ? 'server' : 'unknown');
}

function headerValue(headers: unknown, name: string): string | null {
  if (typeof headers !== 'object' || headers === null) {
    return null;
  }
  const record = headers as Record<string, unknown>;
  const raw = record[name] ?? record[name.toLowerCase()];
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

function parseRetryAfter(headers: unknown): number | null {
  const raw = headerValue(headers, 'retry-after');
  if (raw === null) {
    return null;
  }
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Normalizes anything a request can reject with into an `ApiError`.
 *
 * `requestIdHeader` is the transport fallback: the API echoes the correlation
 * id on every response, including responses that carry no envelope at all
 * (BE-01 §3.2).
 */
export function normalizeApiError(cause: unknown, requestIdHeader: string): ApiError {
  if (isApiError(cause)) {
    return cause;
  }

  if (cause instanceof AxiosError) {
    const response = cause.response;

    if (response === undefined) {
      const kind: ApiErrorKind =
        cause.code === 'ECONNABORTED' || cause.code === 'ETIMEDOUT' ? 'timeout' : 'network';
      return new ApiError({
        kind,
        message: DEFAULT_MESSAGE[kind],
        status: null,
        code: null,
        requestId: null,
        details: {},
        retryAfterSeconds: null,
      });
    }

    const kind = kindForStatus(response.status);
    const envelope = errorEnvelopeSchema.safeParse(response.data);
    const transportRequestId = headerValue(response.headers, requestIdHeader);

    return new ApiError({
      kind,
      message: envelope.success ? envelope.data.error.message : DEFAULT_MESSAGE[kind],
      status: response.status,
      code: envelope.success ? envelope.data.error.code : null,
      requestId: envelope.success ? envelope.data.error.request_id : transportRequestId,
      details: envelope.success ? envelope.data.error.details : {},
      retryAfterSeconds: parseRetryAfter(response.headers),
    });
  }

  return new ApiError({
    kind: 'unknown',
    message: DEFAULT_MESSAGE.unknown,
    status: null,
    code: null,
    requestId: null,
    details: {},
    retryAfterSeconds: null,
  });
}
