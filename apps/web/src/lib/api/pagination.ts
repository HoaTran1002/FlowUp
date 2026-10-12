import type { AxiosInstance } from 'axios';
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT, type Paginated } from '@flowup/contracts';

/**
 * FE-01 D5 — cursor pagination only (`API_SPECIFICATION.md` §1).
 *
 * There is no offset pagination and no total count: a page carries `data` and
 * `next_cursor`, and nothing else may be inferred from it
 * (apps/web/AGENTS.md §3.6).
 */

export interface CursorPageParams {
  limit?: number;
  cursor?: string | null;
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return PAGINATION_DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), PAGINATION_MAX_LIMIT);
}

/** Builds the documented query string: `?limit=20&cursor=...`. */
export function cursorQuery(
  params: CursorPageParams & Record<string, unknown>,
): Record<string, unknown> {
  const { limit, cursor, ...filters } = params;
  const query: Record<string, unknown> = { limit: clampLimit(limit) };

  if (typeof cursor === 'string' && cursor !== '') {
    query.cursor = cursor;
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = value;
    }
  }

  return query;
}

export async function fetchCursorPage<TItem>(
  client: AxiosInstance,
  path: string,
  params: CursorPageParams & Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<Paginated<TItem>> {
  const response = await client.get<Paginated<TItem>>(path, {
    params: cursorQuery(params),
    signal,
  });
  return response.data;
}

export function hasNextPage<TItem>(page: Paginated<TItem>): boolean {
  return page.next_cursor !== null;
}
