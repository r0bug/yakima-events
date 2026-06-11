import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { applyConfigDefaults } from '$lib/types/junk-run';

const JUNK_RUNS_DIR = resolve('data/junk-runs');

export const PUT: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		error(403, 'Unauthorized');
	}

	const body = await request.json();
	body.slug = params.slug;
	const config = applyConfigDefaults(body);

	if (!existsSync(JUNK_RUNS_DIR)) {
		await mkdir(JUNK_RUNS_DIR, { recursive: true });
	}

	await writeFile(resolve(JUNK_RUNS_DIR, `${params.slug}.json`), JSON.stringify(config, null, 2));

	return json({ success: true, config });
};
