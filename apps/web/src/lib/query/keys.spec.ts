import { describe, expect, it } from 'vitest';

import { queryKeys } from './keys';

describe('query key factory', () => {
  it('scopes every key by resource so invalidation can be narrow', () => {
    expect(queryKeys.deliveries.list()[1]).toBe('deliveries');
    expect(queryKeys.events.list()[1]).toBe('events');
    expect(queryKeys.deliveries.attempts('del_1')).toEqual(
      expect.arrayContaining(['deliveries', 'del_1', 'attempts']),
    );
  });

  it('keeps a resource prefix that matches all of its list and detail keys', () => {
    const prefix = queryKeys.endpoints.all();
    expect(queryKeys.endpoints.list({ status: 'ENABLED' }).slice(0, prefix.length)).toEqual([
      ...prefix,
    ]);
    expect(queryKeys.endpoints.detail('end_1').slice(0, prefix.length)).toEqual([...prefix]);
  });

  it('does not let one resource prefix match another', () => {
    const events = queryKeys.events.all();
    expect(queryKeys.deliveries.list().slice(0, events.length)).not.toEqual([...events]);
  });

  it('produces one key for equivalent filter objects regardless of order or empties', () => {
    const a = queryKeys.deliveries.list({ status: 'FAILED', endpoint_id: 'end_1' });
    const b = queryKeys.deliveries.list({
      endpoint_id: 'end_1',
      status: 'FAILED',
      cursor: undefined,
      from: '',
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different keys for different filters', () => {
    expect(JSON.stringify(queryKeys.deliveries.list({ status: 'FAILED' }))).not.toBe(
      JSON.stringify(queryKeys.deliveries.list({ status: 'SUCCEEDED' })),
    );
  });
});
