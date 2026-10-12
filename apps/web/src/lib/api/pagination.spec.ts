import { describe, expect, it } from 'vitest';

import { clampLimit, cursorQuery, hasNextPage } from './pagination';

describe('cursor pagination', () => {
  it('defaults the limit to 20 and caps it at 100', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(500)).toBe(100);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(Number.NaN)).toBe(20);
  });

  it('builds ?limit&cursor and carries filters, dropping empty ones', () => {
    expect(
      cursorQuery({ limit: 50, cursor: 'abc', status: 'FAILED', endpoint_id: '', type: undefined }),
    ).toEqual({ limit: 50, cursor: 'abc', status: 'FAILED' });
  });

  it('never emits an offset or page parameter', () => {
    const query = cursorQuery({ limit: 20 });
    expect(Object.keys(query)).toEqual(['limit']);
  });

  it('reports a next page only from next_cursor', () => {
    expect(hasNextPage({ data: [], next_cursor: 'c' })).toBe(true);
    expect(hasNextPage({ data: [1], next_cursor: null })).toBe(false);
  });
});
