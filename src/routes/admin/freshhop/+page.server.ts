import type { PageServerLoad } from './$types';
import { loadFeedback, loadFreshHop, favoriteSummary, recordingIds } from '$lib/server/freshhop';

// Auth is enforced by admin/+layout.server.ts
export const load: PageServerLoad = async () => {
	const [feedback, config, favorites] = await Promise.all([
		loadFeedback(),
		loadFreshHop(),
		favoriteSummary(),
	]);
	const ids = config ? recordingIds(config) : new Map<string, string>();
	const ranking = [...ids]
		.map(([id, title]) => ({ title, count: favorites.counts[id] || 0 }))
		.sort((a, b) => b.count - a.count);
	return { feedback, ranking, voters: favorites.voters };
};
