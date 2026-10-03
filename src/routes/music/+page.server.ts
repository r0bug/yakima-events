import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadMusic, pageNav } from '$lib/server/music';

export const load: PageServerLoad = async () => {
	const lib = await loadMusic();
	if (!lib) error(404, 'Not found');
	return {
		title: lib.title,
		intro: lib.intro,
		githubUrl: lib.githubUrl,
		nav: pageNav(lib),
		pages: lib.pages.map((p) => ({
			slug: p.slug,
			title: p.title,
			description: p.description,
			count: p.songs.length,
			sample: p.songs.slice(0, 4).map((s) => s.title),
		})),
		total: lib.pages.reduce((n, p) => n + p.songs.length, 0),
	};
};
