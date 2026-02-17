import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { calendarSources } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login?return=/admin/validate-urls');
	}

	const sources = await db
		.select({
			id: calendarSources.id,
			name: calendarSources.name,
			url: calendarSources.url,
			type: calendarSources.scrapeType,
		})
		.from(calendarSources)
		.where(eq(calendarSources.active, true));

	return { user: locals.user, sources };
};
