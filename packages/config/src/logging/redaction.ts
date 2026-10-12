import { LOG_FIELDS, type LogField, type LogFields, type LogFieldValue } from './fields';

/**
 * The redaction layer (BE-01 §3.2).
 *
 * Two independent defences:
 *
 *  1. ALLOWLIST (structural). `sanitizeFields` keeps only the keys in
 *     `LOG_FIELDS` and only primitive values. Headers, request and response
 *     bodies, payloads, downstream responses and credentials have no field
 *     name to travel under, so they cannot be serialized at all.
 *
 *  2. DENYLIST (defensive). `isSensitiveKey` additionally rejects anything
 *     named like a secret, so that a future field whose name collides with a
 *     credential cannot slip through the allowlist.
 *
 * Never weakened to make a test pass (AGENTS.md §4).
 */

/** Header and field names whose VALUES must never be serialized. */
export const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'flowup-signature',
  'idempotency-key',
  'proxy-authorization',
  'x-api-key',
] as const;

/** Substrings that mark a field name as credential-bearing. */
const SENSITIVE_KEY_PATTERNS = [
  'secret',
  'password',
  'passwd',
  'token',
  'credential',
  'apikey',
  'api_key',
  'private_key',
  'signature',
  'session',
  'bearer',
  'auth',
  'cookie',
  'payload',
  'body',
];

export const REDACTED = '[redacted]';

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if ((SENSITIVE_KEYS as readonly string[]).includes(normalized)) return true;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

const ALLOWED_FIELDS = new Set<string>(LOG_FIELDS);

function isLogFieldValue(value: unknown): value is LogFieldValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Reduces an arbitrary object to the allowlisted, primitive, non-sensitive
 * subset that may be serialized into a log record.
 */
export function sanitizeFields(input: Record<string, unknown> | undefined): LogFields {
  if (input === undefined) return {};

  const output: LogFields = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (isSensitiveKey(key)) continue;
    if (!isLogFieldValue(value)) continue;
    output[key as LogField] = value;
  }
  return output;
}

/**
 * Reduces an unknown thrown value to a safe category.
 *
 * SYSTEM_ARCHITECTURE.md §7 logs a *sanitized error category*, never the
 * message: a message can contain a URL, a payload fragment or a credential.
 */
export function errorCategory(error: unknown): string {
  if (error === null || error === undefined) return 'unknown';
  if (error instanceof Error) return error.constructor.name;
  return typeof error;
}
