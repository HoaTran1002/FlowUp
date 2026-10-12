/**
 * Correlation-id transport contract.
 *
 * `API_SPECIFICATION.md` §1 fixes `request_id` inside the error envelope but
 * not the header that carries it. BE-01 §3.2 fixed the header; the names live
 * here because both the API (`packages/config`) and the dashboard client
 * (`apps/web`) must agree on them, and the frontend never hand-copies a
 * backend constant (docs/phase-1/README.md §6.2).
 *
 * The generation rule and the well-formedness check stay in
 * `packages/config`: they are server behavior, not a shared contract.
 */

/** The inbound headers accepted as a caller-supplied correlation id. */
export const REQUEST_ID_HEADERS = ['x-request-id', 'x-correlation-id'] as const;

/** The header the API always echoes the effective id back on. */
export const REQUEST_ID_RESPONSE_HEADER = 'x-request-id';

export const REQUEST_ID_PREFIX = 'req_';
