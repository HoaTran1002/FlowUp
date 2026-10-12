import { z } from 'zod';
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '@flowup/contracts';

/**
 * FE-01 §4 — the typed search-parameter contract for every list route.
 *
 * These schemas are declared now, in phase 1, because deep links must retain
 * filters (`UI_UX_SPECIFICATION.md` §2) and later tasks must not change the
 * URL contract once links exist.
 *
 * A payload, a credential or any sensitive value MUST NEVER appear in a query
 * parameter (UI_UX_SPECIFICATION.md §2, INV-08). Every schema below is limited
 * to identifiers, documented enum values, a time range and the cursor.
 *
 * Filter names mirror the documented query parameters in
 * `API_SPECIFICATION.md` §5; nothing here invents a filter the API does not
 * define.
 */

const limit = z.coerce
  .number()
  .int()
  .min(1)
  .max(PAGINATION_MAX_LIMIT)
  .catch(PAGINATION_DEFAULT_LIMIT)
  .default(PAGINATION_DEFAULT_LIMIT);

/** An opaque cursor from `next_cursor`. Never constructed by the client. */
const cursor = z.string().min(1).optional().catch(undefined);

/** RFC3339 UTC instants, as the API documents them. */
const from = z.string().datetime({ offset: true }).optional().catch(undefined);
const to = z.string().datetime({ offset: true }).optional().catch(undefined);

const identifier = z.string().min(1).max(128).optional().catch(undefined);

export const DELIVERY_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'SUCCEEDED',
  'FAILED',
  'RETRY_WAIT',
  'CANCELLED',
] as const;

export const APPLICATION_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export const ENDPOINT_STATUSES = ['ENABLED', 'DISABLED'] as const;

const cursorPage = { limit, cursor } as const;

export const applicationsSearchSchema = z.object({
  ...cursorPage,
  status: z.enum(APPLICATION_STATUSES).optional().catch(undefined),
});

export const endpointsSearchSchema = z.object({
  ...cursorPage,
  application_id: identifier,
  status: z.enum(ENDPOINT_STATUSES).optional().catch(undefined),
});

export const eventsSearchSchema = z.object({
  ...cursorPage,
  application_id: identifier,
  type: z
    .string()
    .regex(/^[a-z][a-z0-9_.-]{0,99}$/)
    .optional()
    .catch(undefined),
  from,
  to,
});

export const deliveriesSearchSchema = z.object({
  ...cursorPage,
  application_id: identifier,
  endpoint_id: identifier,
  event_id: identifier,
  status: z.enum(DELIVERY_STATUSES).optional().catch(undefined),
  from,
  to,
});

export const apiKeysSearchSchema = z.object({ ...cursorPage });

export const usageSearchSchema = z.object({ from, to });

export type ApplicationsSearch = z.output<typeof applicationsSearchSchema>;
export type EndpointsSearch = z.output<typeof endpointsSearchSchema>;
export type EventsSearch = z.output<typeof eventsSearchSchema>;
export type DeliveriesSearch = z.output<typeof deliveriesSearchSchema>;
export type ApiKeysSearch = z.output<typeof apiKeysSearchSchema>;
export type UsageSearch = z.output<typeof usageSearchSchema>;

/**
 * Builds a `validateSearch` function that never throws.
 *
 * A malformed deep link must degrade to the documented defaults, not render an
 * error page: a user pasting a truncated URL is not an error condition. Each
 * field falls back on its own (`.catch`), so one bad filter drops only itself
 * and the valid filters in the same link survive.
 */
export function searchValidator<TSchema extends z.ZodObject>(
  schema: TSchema,
): (search: Record<string, unknown>) => z.output<TSchema> {
  return (search) => {
    const parsed = schema.safeParse(search);
    return parsed.success ? parsed.data : schema.parse({});
  };
}
