import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { applyConfigDefaults } from '$lib/types/junk-run';
import type { JunkRunConfig } from '$lib/types/junk-run';

const JUNK_RUNS_DIR = resolve('data/junk-runs');

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login?return=/admin/junk-runs');
	}

	const configs: JunkRunConfig[] = [];

	if (existsSync(JUNK_RUNS_DIR)) {
		const files = await readdir(JUNK_RUNS_DIR);
		for (const file of files) {
			if (!file.endsWith('.json')) continue;
			try {
				const raw = await readFile(resolve(JUNK_RUNS_DIR, file), 'utf-8');
				configs.push(applyConfigDefaults(JSON.parse(raw)));
			} catch {
				// skip invalid files
			}
		}
	}

	return { user: locals.user, configs };
};
