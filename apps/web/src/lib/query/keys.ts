/**
 * FE-01 D6 — the single query-key factory (apps/web/AGENTS.md §6.1).
 *
 * Keys are scoped by resource and by the filters that produced them, so a
 * later task invalidates exactly the queries a write affected instead of
 * clearing the cache.
 *
 * Organization scope is deliberately NOT part of a key in phase 1: the tenant
 * is derived server-side from the session (INV-01) and the client has no
 * organization identity until ADR-01 is resolved. FE-02 adds the organization
 * segment under `scoped()` below, which is the only place that changes.
 */

export type QueryFilters = Record<string, unknown> | undefined;

/** Normalizes filters so two equivalent filter objects produce one cache entry. */
function normalize(filters: QueryFilters): Record<string, unknown> {
  if (filters === undefined) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

const ROOT = 'flowup' as const;

/** The one place an organization segment will be inserted (FE-02). */
function scoped(resource: string): readonly [typeof ROOT, string] {
  return [ROOT, resource] as const;
}

export const queryKeys = {
  all: [ROOT] as const,

  applications: {
    all: () => [...scoped('applications')] as const,
    list: (filters?: QueryFilters) =>
      [...scoped('applications'), 'list', normalize(filters)] as const,
    detail: (applicationId: string) =>
      [...scoped('applications'), 'detail', applicationId] as const,
  },

  endpoints: {
    all: () => [...scoped('endpoints')] as const,
    list: (filters?: QueryFilters) => [...scoped('endpoints'), 'list', normalize(filters)] as const,
    detail: (endpointId: string) => [...scoped('endpoints'), 'detail', endpointId] as const,
  },

  events: {
    all: () => [...scoped('events')] as const,
    list: (filters?: QueryFilters) => [...scoped('events'), 'list', normalize(filters)] as const,
    detail: (eventId: string) => [...scoped('events'), 'detail', eventId] as const,
  },

  deliveries: {
    all: () => [...scoped('deliveries')] as const,
    list: (filters?: QueryFilters) =>
      [...scoped('deliveries'), 'list', normalize(filters)] as const,
    detail: (deliveryId: string) => [...scoped('deliveries'), 'detail', deliveryId] as const,
    attempts: (deliveryId: string) =>
      [...scoped('deliveries'), 'detail', deliveryId, 'attempts'] as const,
  },

  apiKeys: {
    all: () => [...scoped('api-keys')] as const,
    list: (filters?: QueryFilters) => [...scoped('api-keys'), 'list', normalize(filters)] as const,
  },

  usage: {
    all: () => [...scoped('usage')] as const,
    summary: (filters?: QueryFilters) =>
      [...scoped('usage'), 'summary', normalize(filters)] as const,
  },
} as const;
