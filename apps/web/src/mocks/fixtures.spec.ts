import { describe, expect, it } from 'vitest';

import { deliveries, events } from './fixtures';

/** apps/web/AGENTS.md §5 — even placeholder data must be honest. */
describe('fixture domain semantics', () => {
  it('includes an accepted event with zero deliveries and the documented reason', () => {
    const empty = events.find((event) => event.delivery_count === 0);

    expect(empty).toBeDefined();
    expect(empty?.no_matching_reason).toBe('no_matching_subscriptions');
    expect(deliveries.some((d) => d.event_id === empty?.id)).toBe(false);
  });

  it('shows one event with independent delivery outcomes', () => {
    const forEvent = deliveries.filter((d) => d.event_id === 'evt_001');

    expect(forEvent.length).toBeGreaterThanOrEqual(2);
    expect(new Set(forEvent.map((d) => d.status)).size).toBeGreaterThan(1);
  });

  it('does not treat a retried attempt as a failed delivery', () => {
    const retrying = deliveries.find((d) => d.status === 'RETRY_WAIT');

    expect(retrying?.last_error_code).not.toBeNull();
    expect(retrying?.next_attempt_at).not.toBeNull();
    expect(retrying?.status).not.toBe('FAILED');
  });

  it('never reports an event as delivered', () => {
    expect(events.every((event) => event.status === 'accepted')).toBe(true);
  });
});
