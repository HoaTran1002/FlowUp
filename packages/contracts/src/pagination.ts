import { z } from 'zod';

/**
 * The cursor-pagination envelope (API_SPECIFICATION.md §1).
 *
 * Cursor pagination only: `?limit=20&cursor=...`, default 20, max 100,
 * deterministic `(created_at, id)` ordering. There is no offset pagination and
 * no fabricated total count.
 */
export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export function paginatedSchema<TItem extends z.ZodType>(
  item: TItem,
): z.ZodObject<{ data: z.ZodArray<TItem>; next_cursor: z.ZodNullable<z.ZodString> }> {
  return z.object({
    data: z.array(item),
    next_cursor: z.string().min(1).nullable(),
  });
}

export interface Paginated<TItem> {
  data: TItem[];
  next_cursor: string | null;
}
