import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadMusic, pageNav } from '$lib/server/music';

export const load: PageServerLoad = async () => {
	const lib = await loadMusic();
	if (!lib) error(404, 'Not found');
	return { libTitle: lib.title, nav: pageNav(lib), pronunciation: lib.pronunciation };
};
