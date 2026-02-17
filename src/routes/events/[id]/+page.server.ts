import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getEventById } from '$lib/server/services/events';
import { db } from '$lib/server/db';
import { events, eventShopParticipants, localShops, eventImages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		error(404, 'Event not found');
	}

	const event = await getEventById(id);
	if (!event) {
		error(404, 'Event not found');
	}

	// Get collaboration fields not included in getEventById
	const [fullEvent] = await db
		.select({
			primaryShopId: events.primaryShopId,
			isCollaborative: events.isCollaborative,
		})
		.from(events)
		.where(eq(events.id, id))
		.limit(1);

	const primaryShopId = fullEvent?.primaryShopId;
	const isCollaborative = fullEvent?.isCollaborative ?? false;

	// Fetch primary image
	const images = await db
		.select({ filename: eventImages.filename })
		.from(eventImages)
		.where(and(eq(eventImages.eventId, id), eq(eventImages.isPrimary, true)))
		.limit(1);

	const primaryImage = images[0]?.filename || null;

	// Fetch primary shop if set
	let primaryShop: { id: number; name: string } | null = null;
	if (primaryShopId) {
		const shops = await db
			.select({ id: localShops.id, name: localShops.name })
			.from(localShops)
			.where(eq(localShops.id, primaryShopId))
			.limit(1);
		primaryShop = shops[0] || null;
	}

	// Fetch participating shops if collaborative
	let participants: { id: number; name: string; role: string | null; status: string | null }[] = [];
	if (isCollaborative) {
		const results = await db
			.select({
				shopId: localShops.id,
				shopName: localShops.name,
				role: eventShopParticipants.participationRole,
				status: eventShopParticipants.approvalStatus,
			})
			.from(eventShopParticipants)
			.innerJoin(localShops, eq(eventShopParticipants.shopId, localShops.id))
			.where(eq(eventShopParticipants.eventId, id));

		participants = results.map(r => ({
			id: r.shopId,
			name: r.shopName,
			role: r.role,
			status: r.status,
		}));
	}

	// Build canonical URL
	const siteUrl = 'https://yfevents.yakimafinds.com';
	const eventUrl = `${siteUrl}/events/${id}`;

	// Format date for OG tags
	const startDate = event.startDatetime ? new Date(event.startDatetime) : null;
	const description = event.description
		? event.description.substring(0, 200).replace(/\n/g, ' ')
		: `Event in Yakima, WA`;

	return {
		event: {
			...event,
			primaryImage,
			isCollaborative,
			primaryShopId,
		},
		primaryShop,
		participants,
		seo: {
			title: event.title,
			description,
			url: eventUrl,
			image: primaryImage ? `${siteUrl}/uploads/${primaryImage}` : `${siteUrl}/og-default.png`,
			startDate: startDate?.toISOString() || null,
			location: event.location || event.address || 'Yakima, WA',
		},
	};
};
