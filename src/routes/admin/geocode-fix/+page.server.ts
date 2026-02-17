import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { localShops, events } from '$lib/server/db/schema';
import { or, isNull, eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login?return=/admin/geocode-fix');
	}

	// Shops with missing or suspicious coordinates
	const shopsNeedingGeocode = await db
		.select({
			id: localShops.id,
			name: localShops.name,
			address: localShops.address,
			latitude: localShops.latitude,
			longitude: localShops.longitude,
		})
		.from(localShops)
		.where(
			or(
				isNull(localShops.latitude),
				isNull(localShops.longitude),
				eq(localShops.latitude, '0'),
				eq(localShops.longitude, '0'),
			)
		)
		.limit(100);

	// Events with missing coordinates that have an address
	const eventsNeedingGeocode = await db
		.select({
			id: events.id,
			title: events.title,
			address: events.address,
			location: events.location,
			latitude: events.latitude,
			longitude: events.longitude,
		})
		.from(events)
		.where(
			sql`${events.address} IS NOT NULL AND ${events.address} != '' AND (${events.latitude} IS NULL OR ${events.longitude} IS NULL)`
		)
		.limit(100);

	// All shops with coords for the map
	const allShopsWithCoords = await db
		.select({
			id: localShops.id,
			name: localShops.name,
			latitude: localShops.latitude,
			longitude: localShops.longitude,
		})
		.from(localShops)
		.where(
			sql`${localShops.latitude} IS NOT NULL AND ${localShops.longitude} IS NOT NULL AND ${localShops.latitude} != 0`
		);

	return {
		user: locals.user,
		shopsNeedingGeocode,
		eventsNeedingGeocode,
		allShopsWithCoords,
	};
};
