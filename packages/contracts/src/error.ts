import { z } from 'zod';

/**
 * The common error envelope (API_SPECIFICATION.md §1).
 *
 * Every management and producer route returns this shape on failure. It never
 * carries a payload, a credential, a downstream response body or an internal
 * stack trace (INV-08).
 */

/**
 * The stable error-code catalog (docs/phase-1/README.md §6.3).
 *
 * Phase 1 (BE-01) defines only the transport-level codes the global exception
 * filter needs in order to emit the envelope at all. Business codes —
 * `idempotency_conflict` and friends — are added by the task that introduces
 * the behavior. Codes are added deliberately, never ad hoc.
 */
export const ERROR_CODES = [
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'payload_too_large',
  'unprocessable_entity',
  'rate_limited',
  'internal_error',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export const errorEnvelopeSchema = z.object({
  error: z.object({
    /** A safe, stable machine-readable code from the catalog above. */
    code: z.string().min(1),
    /** A safe human-readable summary. Never echoes request content. */
    message: z.string().min(1),
    /** The same correlation id that the request's log records carry. */
    request_id: z.string().min(1),
    /** Safe structured context only. Empty when there is nothing safe to add. */
    details: z.record(z.string(), z.unknown()),
  }),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
