import { readFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * Song Factory music library (/music).
 *
 * Content lives in data/music.json (gitignored runtime data, read per request)
 * and audio in uploads/music/, both published from Song Factory by
 * scripts/export_music_site.py in the YakimaFindsSongWriter repo.
 */

import type { MusicLibrary } from '$lib/types/music';
export type * from '$lib/types/music';

export async function loadMusic(): Promise<MusicLibrary | null> {
	try {
		return JSON.parse(await readFile(resolve('data/music.json'), 'utf-8'));
	} catch {
		return null;
	}
}

/** Page list for navigation, without the (large) song payloads. */
export function pageNav(lib: MusicLibrary) {
	return lib.pages.map((p) => ({ slug: p.slug, title: p.title, count: p.songs.length }));
}
