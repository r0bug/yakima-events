import type { PageServerLoad } from './$types';
import { loadFeedback, loadFreshHop, favoriteSummary } from '$lib/server/freshhop';

// Auth is enforced by admin/+layout.server.ts
export const load: PageServerLoad = async () => {
	const [feedback, config, favorites] = await Promise.all([
		loadFeedback(),
		loadFreshHop(),
		favoriteSummary(),
	]);
	const ranking = (config?.songs ?? [])
		.map((s) => ({ title: s.title, count: favorites.counts[s.slug] || 0 }))
		.sort((a, b) => b.count - a.count);
	return { feedback, ranking, voters: favorites.voters };
};
