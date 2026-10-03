import type { PageServerLoad } from './$types';
import { loadFeedback } from '$lib/server/freshhop';

// Auth is enforced by admin/+layout.server.ts
export const load: PageServerLoad = async () => {
	return { feedback: await loadFeedback() };
};
