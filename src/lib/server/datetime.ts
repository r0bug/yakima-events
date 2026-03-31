/**
 * Pacific timezone helpers for date queries.
 *
 * Event datetimes are stored in the database as Pacific time strings
 * (YYYY-MM-DD HH:MM:SS). All date comparisons must use Pacific time,
 * not UTC, or queries will return wrong results when the server
 * timezone differs from Pacific (which it does on DigitalOcean/UTC).
 */

const PACIFIC = 'America/Los_Angeles';

/**
 * Format a Date as a Pacific time string suitable for DB comparison.
 * Returns "YYYY-MM-DD HH:MM:SS" in America/Los_Angeles.
 */
export function toPacificDatetime(date: Date): string {
  // Intl.DateTimeFormat gives us Pacific-local parts regardless of server TZ
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? '00';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Get today's date boundaries in Pacific time.
 * Returns start ("YYYY-MM-DD 00:00:00") and end ("YYYY-MM-DD 23:59:59").
 */
export function pacificToday(): { start: string; end: string } {
  const now = new Date();
  const dateStr = toPacificDatetime(now).slice(0, 10); // "YYYY-MM-DD"
  return {
    start: `${dateStr} 00:00:00`,
    end: `${dateStr} 23:59:59`,
  };
}

/**
 * Get the Pacific date string (YYYY-MM-DD) for a Date.
 */
export function toPacificDate(date: Date): string {
  return toPacificDatetime(date).slice(0, 10);
}
