import { randomUUID } from 'node:crypto';

import { REQUEST_ID_HEADERS, REQUEST_ID_PREFIX } from '@flowup/contracts';

/**
 * Correlation identifiers.
 *
 * `API_SPECIFICATION.md` §1 shows `request_id: "req_..."` inside the error
 * envelope but does not fix the generation rule or the transport header.
 * BE-01 §3.2 requires both to be fixed now, because the value logged and the
 * value returned in the envelope must be identical. This module is that
 * single source.
 */

/**
 * The header names moved to `@flowup/contracts` in FE-01: the dashboard client
 * reads the same response header and must not hand-copy it. They are
 * re-exported here so existing importers and this module's own single-source
 * guarantee are unaffected.
 */
export {
  REQUEST_ID_HEADERS,
  REQUEST_ID_PREFIX,
  REQUEST_ID_RESPONSE_HEADER,
} from '@flowup/contracts';

/**
 * A caller-supplied id is accepted only when it is well-formed: a bounded,
 * opaque token. An arbitrary inbound string must never reach a log record or
 * a response header.
 */
const WELL_FORMED = /^[A-Za-z0-9_-]{8,128}$/;

export function isWellFormedRequestId(value: unknown): value is string {
  return typeof value === 'string' && WELL_FORMED.test(value);
}

export function generateRequestId(): string {
  return `${REQUEST_ID_PREFIX}${randomUUID().replaceAll('-', '')}`;
}

/**
 * Resolves the effective request id: the inbound header when it is
 * well-formed, otherwise a freshly generated one.
 */
export function resolveRequestId(headers: Record<string, string | string[] | undefined>): {
  requestId: string;
  inbound: boolean;
} {
  for (const header of REQUEST_ID_HEADERS) {
    const raw = headers[header];
    const candidate = Array.isArray(raw) ? raw[0] : raw;
    if (isWellFormedRequestId(candidate)) {
      return { requestId: candidate, inbound: true };
    }
  }
  return { requestId: generateRequestId(), inbound: false };
}
