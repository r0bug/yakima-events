import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { db } from '$lib/server/db';
import { localShops, shopCategories } from '$lib/server/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { applyConfigDefaults } from '$lib/types/junk-run';
import type { JunkRunConfig } from '$lib/types/junk-run';

const JUNK_RUNS_DIR = resolve('data/junk-runs');

async function loadConfig(slug: string): Promise<JunkRunConfig> {
	const filePath = resolve(JUNK_RUNS_DIR, `${slug}.json`);
	const legacyPath = resolve('src/lib/config/junk-runs', `${slug}.json`);
	const path = existsSync(filePath) ? filePath : legacyPath;
	const raw = await readFile(path, 'utf-8');
	return applyConfigDefaults(JSON.parse(raw));
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(302, `/login?return=/admin/junk-runs/${params.slug}`);
	}

	let config: JunkRunConfig;
	try {
		config = await loadConfig(params.slug);
	} catch {
		error(404, 'Junk run config not found');
	}

	// Load all active shop categories for the tag selector
	const allCategories = await db
		.select({
			id: shopCategories.id,
			name: shopCategories.name,
			slug: shopCategories.slug,
			color: shopCategories.color,
		})
		.from(shopCategories)
		.where(eq(shopCategories.active, true));

	// Load shops matching current tags for the exclusion list
	const selectedCategoryIds = allCategories
		.filter(c => config.defaultTags.includes(c.slug))
		.map(c => c.id);

	const shops = selectedCategoryIds.length > 0 ? await db
		.select({
			id: localShops.id,
			name: localShops.name,
			address: localShops.address,
			categoryId: localShops.categoryId,
		})
		.from(localShops)
		.where(and(
			eq(localShops.active, true),
			inArray(localShops.categoryId, selectedCategoryIds),
			sql`${localShops.latitude} IS NOT NULL`,
			sql`${localShops.longitude} IS NOT NULL`,
		)) : [];

	return { user: locals.user, config, allCategories, shops };
};
