import { describe, expect, it } from 'vitest';

import { formatTimestamp, formatTimestampLabel } from './datetime';

describe('timestamp formatting', () => {
  it('states the timezone explicitly in the local label', () => {
    const formatted = formatTimestamp('2026-10-11T07:00:00Z');
    expect(formatted).not.toBeNull();
    // Intl renders a zone name or GMT offset for timeZoneName: 'short'.
    expect(formatted?.label).toMatch(/[A-Z]{2,5}|GMT|UTC|[+-]\d/);
  });

  it('exposes the exact UTC instant and the original API value', () => {
    const formatted = formatTimestamp('2026-10-11T07:00:00Z');
    expect(formatted?.utc).toContain('UTC');
    expect(formatted?.utc).toContain('07:00:00');
    expect(formatted?.iso).toBe('2026-10-11T07:00:00Z');
  });

  it('returns null for an invalid date rather than guessing', () => {
    expect(formatTimestamp('not-a-date')).toBeNull();
  });

  it('shows an explicit dash for a missing or invalid value', () => {
    expect(formatTimestampLabel(null)).toBe('—');
    expect(formatTimestampLabel(undefined)).toBe('—');
    expect(formatTimestampLabel('')).toBe('—');
    expect(formatTimestampLabel('garbage')).toBe('—');
  });
});
