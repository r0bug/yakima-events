import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadMusic, pageNav } from '$lib/server/music';

export const load: PageServerLoad = async ({ params }) => {
	const lib = await loadMusic();
	const page = lib?.pages.find((p) => p.slug === params.page);
	if (!lib || !page) error(404, 'Not found');
	return { libTitle: lib.title, nav: pageNav(lib), page };
};
