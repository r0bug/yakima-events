import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { pacificToday } from '$server/datetime';

/**
 * GET /tomorrow
 * Convenience redirect to tomorrow's /day/[date] share page (Pacific time).
 * Always share the dated URL it lands on — Facebook caches previews per URL,
 * so sharing /tomorrow itself would pin a stale card.
 */
export const GET: RequestHandler = async () => {
	const today = pacificToday().start.slice(0, 10);
	const d = new Date(`${today}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	redirect(302, `/day/${d.toISOString().slice(0, 10)}`);
};
