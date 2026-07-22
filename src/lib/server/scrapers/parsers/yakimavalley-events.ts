/**
 * yakimavalley.events Parser
 * Scrapes the /events listing page of www.yakimavalley.events, which embeds a
 * complete schema.org JSON-LD @graph of every upcoming event (title, start/end,
 * location, description, and a sameAs link to the original source).
 *
 * That site aggregates many of the same upstream sources we do (Facebook,
 * Visit Yakima, CitySpark) — including our own feed. To avoid re-importing
 * echoes of our own data:
 *  - events whose sameAs points at yfevents.yakimafinds.com are skipped
 *  - Facebook/Eventbrite sameAs links are mapped to the same externalEventId
 *    formats our other scrapers use (fb_<id> / eb_<id>) so findDuplicate()
 *    matches them against events we already have
 */

import type { ScrapedEvent } from '../types';

interface LdPlace {
	'@type'?: string;
	name?: string;
	address?: string | { streetAddress?: string; addressLocality?: string };
}

interface LdEvent {
	'@type'?: string;
	name?: string;
	url?: string;
	startDate?: string;
	endDate?: string;
	description?: string;
	eventStatus?: string;
	location?: LdPlace;
	sameAs?: string;
}

/**
 * Fetch and parse events from a yakimavalley.events listing page.
 * URL should be like: https://www.yakimavalley.events/events
 */
export async function scrapeYakimaValleyEvents(url: string): Promise<ScrapedEvent[]> {
	const response = await fetch(url, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (compatible; YFEvents/1.0; +https://yfevents.yakimafinds.com)',
			Accept: 'text/html,application/xhtml+xml',
		},
		redirect: 'follow',
	});

	if (!response.ok) {
		throw new Error(`yakimavalley.events returned ${response.status}: ${response.statusText}`);
	}

	const html = await response.text();
	const rawEvents = extractLdEvents(html);
	console.log(`[YakimaValleyEvents] JSON-LD graph contains ${rawEvents.length} events`);

	const events: ScrapedEvent[] = [];
	const seen = new Set<string>();
	let skippedOwn = 0;

	for (const raw of rawEvents) {
		// Don't re-import events that cite our own site as their source
		if (raw.sameAs?.includes('yfevents.yakimafinds.com')) {
			skippedOwn++;
			continue;
		}

		const event = mapLdEvent(raw);
		if (!event) continue;

		const key = event.externalEventId || `${event.title}|${event.startDatetime.toISOString()}`;
		if (seen.has(key)) continue;
		seen.add(key);

		events.push(event);
	}

	console.log(
		`[YakimaValleyEvents] ${events.length} events mapped (${skippedOwn} skipped as yfevents echoes)`
	);
	return events;
}

/**
 * Pull schema.org Event objects out of every ld+json block on the page —
 * both @graph collections and standalone Event objects.
 */
function extractLdEvents(html: string): LdEvent[] {
	const events: LdEvent[] = [];
	const blockPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
	let match;

	while ((match = blockPattern.exec(html)) !== null) {
		let data: unknown;
		try {
			data = JSON.parse(match[1]);
		} catch {
			continue;
		}

		const nodes: unknown[] = [];
		if (Array.isArray(data)) {
			nodes.push(...data);
		} else if (data && typeof data === 'object') {
			const obj = data as Record<string, unknown>;
			if (Array.isArray(obj['@graph'])) {
				nodes.push(...(obj['@graph'] as unknown[]));
			} else {
				nodes.push(obj);
			}
		}

		for (const node of nodes) {
			if (node && typeof node === 'object' && (node as LdEvent)['@type'] === 'Event') {
				events.push(node as LdEvent);
			}
		}
	}

	return events;
}

/**
 * Map a schema.org Event to our ScrapedEvent format
 */
function mapLdEvent(raw: LdEvent): ScrapedEvent | null {
	if (!raw.name || !raw.startDate) return null;
	if (raw.eventStatus?.includes('EventCancelled')) return null;

	// startDate carries an explicit UTC offset (e.g. 2026-07-26T12:00:00-07:00),
	// so Date parsing is unambiguous regardless of server timezone
	const startDatetime = new Date(raw.startDate);
	if (isNaN(startDatetime.getTime())) return null;

	let endDatetime: Date | undefined;
	if (raw.endDate) {
		const end = new Date(raw.endDate);
		if (!isNaN(end.getTime())) endDatetime = end;
	}

	const location = typeof raw.location?.name === 'string' ? raw.location.name.trim() : undefined;
	let address: string | undefined;
	if (typeof raw.location?.address === 'string') {
		address = raw.location.address.trim();
	} else if (raw.location?.address?.streetAddress) {
		address = raw.location.address.streetAddress.trim();
	}

	return {
		title: raw.name.trim(),
		description: raw.description?.trim() || undefined,
		startDatetime,
		endDatetime,
		location,
		address,
		// Prefer the original upstream source over the aggregator page
		externalUrl: raw.sameAs || raw.url,
		externalEventId: deriveExternalId(raw),
	};
}

/**
 * Derive an externalEventId that lines up with our other scrapers' formats so
 * cross-source duplicates collapse: fb_<id> matches the Facebook browser
 * extension, eb_<id> matches the Eventbrite scraper. Everything else gets a
 * stable yve_<hash> from the site's own slug suffix.
 */
function deriveExternalId(raw: LdEvent): string | undefined {
	const fbMatch = raw.sameAs?.match(/facebook\.com\/events\/(\d+)/);
	if (fbMatch) return `fb_${fbMatch[1]}`;

	const ebMatch = raw.sameAs?.match(/eventbrite\.com\/e\/[^/]*?(\d+)(?:[/?]|$)/);
	if (ebMatch) return `eb_${ebMatch[1]}`;

	// Their event URLs end in a stable 8-hex slug suffix
	const slugMatch = raw.url?.match(/\/events\/[a-z0-9-]*?([0-9a-f]{8})(?:[/?#]|$)/);
	if (slugMatch) return `yve_${slugMatch[1]}`;

	return undefined;
}
