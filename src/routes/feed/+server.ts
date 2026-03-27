import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEvents } from '$lib/server/services/events';

/**
 * Rate limit: 1 request per hour per client IP.
 * In-memory store — resets on server restart, which is fine for this use case.
 */
const rateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
	const now = Date.now();
	const lastRequest = rateLimit.get(ip);

	if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
		const retryAfter = Math.ceil((RATE_LIMIT_MS - (now - lastRequest)) / 1000);
		return { allowed: false, retryAfter };
	}

	rateLimit.set(ip, now);

	// Prune stale entries every 100 requests
	if (rateLimit.size > 500) {
		for (const [key, time] of rateLimit) {
			if (now - time > RATE_LIMIT_MS) rateLimit.delete(key);
		}
	}

	return { allowed: true };
}

/**
 * GET /feed
 *
 * JSON Feed (v1.1) of upcoming approved events.
 * Spec: https://www.jsonfeed.org/version/1.1/
 *
 * Rate limited to 1 request per hour per client IP.
 */
export const GET: RequestHandler = async ({ request, getClientAddress }) => {
	const ip = getClientAddress();
	const { allowed, retryAfter } = checkRateLimit(ip);

	if (!allowed) {
		return json(
			{ error: 'Rate limited. One request per hour.', retry_after_seconds: retryAfter },
			{
				status: 429,
				headers: {
					'Retry-After': String(retryAfter),
					'Cache-Control': 'no-store',
				},
			}
		);
	}

	const now = new Date();
	const sixMonthsOut = new Date(now);
	sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

	const events = await getEvents({
		startDate: now.toISOString(),
		endDate: sixMonthsOut.toISOString(),
		status: 'approved',
	});

	const baseUrl = 'https://yfevents.yakimafinds.com';

	const feed = {
		version: 'https://jsonfeed.org/version/1.1',
		title: 'Yakima Valley Events',
		home_page_url: baseUrl,
		feed_url: `${baseUrl}/feed`,
		description: 'Upcoming events across the Yakima Valley — concerts, markets, fundraisers, classes, and more.',
		icon: `${baseUrl}/favicon.png`,
		language: 'en-US',
		items: events.map((event) => {
			const eventUrl = `${baseUrl}/events/${event.id}`;
			const published = event.createdAt
				? new Date(event.createdAt).toISOString()
				: undefined;

			return {
				id: String(event.id),
				url: event.externalUrl || eventUrl,
				title: event.title,
				content_text: event.description || undefined,
				date_published: published,
				image: event.primaryImageUrl || undefined,

				// JSON Feed extension: event details
				_yfevents: {
					event_url: eventUrl,
					start_datetime: event.startDatetime,
					end_datetime: event.endDatetime || undefined,
					location: event.location || undefined,
					address: event.address || undefined,
					latitude: event.latitude ? Number(event.latitude) : undefined,
					longitude: event.longitude ? Number(event.longitude) : undefined,
					featured: event.featured || false,
					external_url: event.externalUrl || undefined,
					external_event_id: event.externalEventId || undefined,
					source: {
						name: event.sourceName || undefined,
						url: event.sourceUrl || undefined,
					},
					categories: (event.categoryDetails || []).map((c) => ({
						name: c.name,
						slug: c.slug,
						color: c.color,
					})),
					linked_shop: event.linkedShop
						? { id: event.linkedShop.id, name: event.linkedShop.name }
						: undefined,
				},
			};
		}),
	};

	return new Response(JSON.stringify(feed, null, 2), {
		headers: {
			'Content-Type': 'application/feed+json; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
			'Access-Control-Allow-Origin': '*',
		},
	});
};
