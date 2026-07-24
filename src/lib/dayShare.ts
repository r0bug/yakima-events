/**
 * Shared helpers for the /day/[date] share pages and their OG card image.
 * Pure functions only — imported from both server loaders and components.
 */

/** Strict YYYY-MM-DD that is also a real calendar date */
export function isValidDateParam(date: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const parsed = new Date(`${date}T12:00:00Z`);
	return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** "Saturday, July 25" from "2026-07-25" (no timezone drift) */
export function formatDayHeadline(date: string): string {
	return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	});
}

/** "6:15 PM" from a Pacific wall-time string "YYYY-MM-DD HH:MM:SS" */
export function formatEventTime(startDatetime: string): string {
	const hhmm = startDatetime.slice(11, 16);
	const [h, m] = hhmm.split(':').map(Number);
	if (isNaN(h)) return '';
	if (h === 0 && m === 0) return 'All day';
	const suffix = h >= 12 ? 'PM' : 'AM';
	const hour12 = h % 12 === 0 ? 12 : h % 12;
	return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}
