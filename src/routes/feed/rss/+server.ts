import type { RequestHandler } from './$types';
import { getEvents } from '$lib/server/services/events';
import { toPacificDatetime } from '$lib/server/datetime';

/**
 * Rate limit: shared with JSON feed — 1 request per hour per client IP.
 */
const rateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 60 * 1000;

/**
 * GET /feed/rss
 *
 * RSS 2.0 feed of upcoming approved events.
 * Rate limited to 1 request per hour per client IP.
 */
export const GET: RequestHandler = async ({ getClientAddress }) => {
	const ip = getClientAddress();
	const now = Date.now();
	const lastRequest = rateLimit.get(ip);

	if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
		const retryAfter = Math.ceil((RATE_LIMIT_MS - (now - lastRequest)) / 1000);
		return new Response(
			`<error>Rate limited. Retry after ${retryAfter} seconds.</error>`,
			{
				status: 429,
				headers: {
					'Content-Type': 'application/xml',
					'Retry-After': String(retryAfter),
				},
			}
		);
	}
	rateLimit.set(ip, now);

	const today = new Date();
	const sixMonthsOut = new Date(today);
	sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

	const events = await getEvents({
		startDate: toPacificDatetime(today),
		endDate: toPacificDatetime(sixMonthsOut),
		status: 'approved',
	});

	const baseUrl = 'https://yfevents.yakimafinds.com';
	const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

	const items = events.map((event) => {
		const eventUrl = `${baseUrl}/events/${event.id}`;
		const pubDate = event.createdAt
			? new Date(event.createdAt).toUTCString()
			: new Date().toUTCString();

		const parts: string[] = [];
		if (event.startDatetime) parts.push(`Date: ${event.startDatetime}`);
		if (event.location) parts.push(`Location: ${event.location}`);
		if (event.address) parts.push(`Address: ${event.address}`);
		if (event.sourceName) parts.push(`Source: ${event.sourceName}`);
		if (event.categoryDetails?.length) {
			parts.push(`Categories: ${event.categoryDetails.map(c => c.name).join(', ')}`);
		}
		if (event.description) parts.push('', event.description);

		const description = esc(parts.join('\n'));

		return `    <item>
      <title>${esc(event.title)}</title>
      <link>${esc(event.externalUrl || eventUrl)}</link>
      <guid isPermaLink="true">${esc(eventUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      ${event.categoryDetails?.length ? event.categoryDetails.map(c => `<category>${esc(c.name)}</category>`).join('\n      ') : ''}
      ${event.primaryImageUrl ? `<enclosure url="${esc(event.primaryImageUrl)}" type="image/jpeg" />` : ''}
    </item>`;
	});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Yakima Valley Events</title>
    <link>${baseUrl}</link>
    <description>Upcoming events across the Yakima Valley — concerts, markets, fundraisers, classes, and more.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed/rss" rel="self" type="application/rss+xml" />
    <ttl>60</ttl>
${items.join('\n')}
  </channel>
</rss>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
			'Access-Control-Allow-Origin': '*',
		},
	});
};
