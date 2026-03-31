import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { db } from '$lib/server/db';
import { localShops, shopCategories, events, eventShopParticipants } from '$lib/server/db/schema';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { pacificToday } from '$lib/server/datetime';

export interface JunkRunConfig {
	slug: string;
	name: string;
	tagline: string;
	headerHtml: string;
	footerHtml: string;
	logo: string | null;
	theme: {
		primary: string;
		accent: string;
		background: string;
		text: string;
		headerBg: string;
		headerText: string;
	};
	mapCenter: [number, number];
	mapZoom: number;
	defaultTags: string[];
	showSalesToday: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	// Load config
	let config: JunkRunConfig;
	try {
		const configPath = resolve('src/lib/config/junk-runs', `${slug}.json`);
		const raw = readFileSync(configPath, 'utf-8');
		config = JSON.parse(raw);
	} catch {
		error(404, 'Junk run route not found');
	}

	// Load categories matching the config's defaultTags
	const categories = await db
		.select({
			id: shopCategories.id,
			name: shopCategories.name,
			slug: shopCategories.slug,
			color: shopCategories.color,
			icon: shopCategories.icon,
		})
		.from(shopCategories)
		.where(and(
			eq(shopCategories.active, true),
			inArray(shopCategories.slug, config.defaultTags)
		));

	const categoryIds = categories.map(c => c.id);

	// Load shops with matching categories that have coordinates
	const shops = categoryIds.length > 0 ? await db
		.select({
			id: localShops.id,
			name: localShops.name,
			description: localShops.description,
			address: localShops.address,
			latitude: localShops.latitude,
			longitude: localShops.longitude,
			phone: localShops.phone,
			website: localShops.website,
			operatingHours: localShops.operatingHours,
			categoryId: localShops.categoryId,
			imageUrl: localShops.imageUrl,
		})
		.from(localShops)
		.where(and(
			eq(localShops.active, true),
			inArray(localShops.categoryId, categoryIds),
			sql`${localShops.latitude} IS NOT NULL`,
			sql`${localShops.longitude} IS NOT NULL`,
		)) : [];

	// Load today's sales (events happening today linked to shops)
	let salesToday: { eventId: number; title: string; shopId: number; location: string | null; startDatetime: string | null }[] = [];
	if (config.showSalesToday) {
		const { start: todayStart, end: todayEnd } = pacificToday();

		salesToday = await db
			.select({
				eventId: events.id,
				title: events.title,
				shopId: eventShopParticipants.shopId,
				location: events.location,
				startDatetime: events.startDatetime,
			})
			.from(events)
			.innerJoin(eventShopParticipants, eq(events.id, eventShopParticipants.eventId))
			.where(and(
				eq(events.status, 'approved'),
				gte(events.startDatetime, todayStart),
				lte(events.startDatetime, todayEnd),
			));
	}

	return {
		config,
		shops: shops.map(s => ({
			...s,
			latitude: s.latitude ? Number(s.latitude) : null,
			longitude: s.longitude ? Number(s.longitude) : null,
		})),
		categories,
		salesToday,
	};
};
