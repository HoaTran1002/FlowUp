/**
 * The structured log field contract (SYSTEM_ARCHITECTURE.md §7).
 *
 * The full field set is fixed here in phase 1 so that later tasks only
 * POPULATE it. In phase 1 only `request_id`, `worker_id`/`process` and
 * `trace_id` can exist; the rest are declared and left absent.
 *
 * This list is also the serializer's ALLOWLIST. A key that is not named here
 * is dropped before serialization, which is what makes it structurally
 * impossible for a header, a body, a payload or a credential to reach a log
 * record (INV-08).
 */
export const LOG_FIELDS = [
  'request_id',
  'organization_id',
  'event_id',
  'delivery_id',
  'attempt_id',
  'generation',
  'worker_id',
  'error_category',
  'trace_id',
  'http_method',
  'http_route',
  'http_status',
  'duration_ms',
  'check',
  'port',
  'concurrency',
  'poll_interval_ms',
  'signal',
] as const;

export type LogField = (typeof LOG_FIELDS)[number];

/** A log field value. Only primitives are serializable. */
export type LogFieldValue = string | number | boolean | null;

export type LogFields = Partial<Record<LogField, LogFieldValue>>;

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
