/**
 * FE-01 D6 — the one timestamp helper.
 *
 * The API returns RFC3339 UTC (`API_SPECIFICATION.md`, "RFC3339 UTC
 * timestamps"). The UI displays local time with the zone stated explicitly, so
 * an operator reading a delivery timeline is never guessing which clock a row
 * refers to (UI_UX_SPECIFICATION.md §1).
 */

export interface FormattedTimestamp {
  /** Local time with an explicit zone, for display. */
  readonly label: string;
  /** The exact UTC value, for a title attribute or a copy action. */
  readonly utc: string;
  /** The original API value, unchanged. */
  readonly iso: string;
}

// `dateStyle`/`timeStyle` cannot be combined with `timeZoneName`, so the fields
// are spelled out. The zone name is the point of this helper.
const FIELDS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
};

const LOCAL = new Intl.DateTimeFormat(undefined, { ...FIELDS, timeZoneName: 'short' });

const UTC = new Intl.DateTimeFormat('en-GB', { ...FIELDS, timeZone: 'UTC' });

export function formatTimestamp(iso: string): FormattedTimestamp | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return {
    label: LOCAL.format(parsed),
    utc: `${UTC.format(parsed)} UTC`,
    iso,
  };
}

/** The display string, or an explicit dash. An invalid date is never guessed. */
export function formatTimestampLabel(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') {
    return '—';
  }
  return formatTimestamp(iso)?.label ?? '—';
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
