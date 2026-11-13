import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { processEvent } from '$lib/server/scrapers/scraper';
import type { ScrapedEvent } from '$lib/server/scrapers/types';
import { db } from '$lib/server/db';
import { calendarSources, events } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireScraperAuth, consumeLegacyBudget } from '$lib/server/auth/scraper-guard';
import { httpUrlOrUndefined } from '$lib/utils/safe-url';

/** Hard cap per request (the extension has posted 230+ events from one long scroll) */
const MAX_EVENTS_PER_REQUEST = 500;

/** Where unauthenticated (legacy-switch) posts land, always as `pending` */
const UNVERIFIED_SOURCE_NAME = 'Browser Extension (unverified)';

/** Capture files are only ever written as capture_<epoch-ms>.json */
const CAPTURE_FILENAME = /^capture_\d{1,16}\.json$/;

/**
 * Strict shape for an event from an UNAUTHENTICATED (legacy) post. Unknown keys
 * are dropped, every string is bounded, and links must be plain http(s).
 */
const optionalText = (max: number) => z.string().max(max).nullish();
const legacyEventSchema = z.object({
	title: z.string().trim().min(4).max(300),
	startDate: optionalText(100),
	_rawDate: optionalText(200),
	venue: optionalText(300),
	location: optionalText(500),
	description: optionalText(5000),
	url: z
		.string()
		.max(2000)
		.refine((u) => httpUrlOrUndefined(u) !== undefined, 'url must be http(s)')
		.nullish(),
	facebookId: z
		.union([z.string(), z.number()])
		.transform((v) => String(v))
		.refine((v) => /^\d{5,25}$/.test(v), 'facebookId must be numeric')
		.nullish(),
	source: optionalText(50),
});

/**
 * POST /api/scraper/page-capture/import
 *
 * Import events captured by the browser extension. This is the endpoint the
 * extension's "Send All to YFEvents" button posts to, and the single biggest
 * source of events on the site.
 *
 * Accepts either:
 *   - { filename: "capture_xxx.json" } to import from a saved capture file
 *   - { events: [...] } to import events directly
 *
 * Auth (see scraper-guard.ts): admin session, or the scraper secret as
 * `Authorization: Bearer` / `X-API-Key`. Those trusted posts are auto-approved
 * and go public immediately, exactly as before.
 *
 * With SCRAPER_LEGACY_EXTENSION=1, a post with no credentials is still accepted
 * (so extension copies without a key keep working) but is untrusted: `events`
 * only, strictly validated, rate limited, stored as `pending` under a separate
 * "unverified" source. A later trusted import of the same event approves it.
 */
export const POST: RequestHandler = async (event) => {
	const auth = requireScraperAuth(event, { allowLegacy: true });
	if (!auth.ok) return auth.response;
	const legacy = auth.mode === 'legacy';

	try {
		const body = await event.request.json().catch(() => null);
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
		}

		let eventsToImport: any[] = [];

		if (body.filename && !legacy) {
			// Load from saved capture file
			if (typeof body.filename !== 'string' || !CAPTURE_FILENAME.test(body.filename)) {
				return json({ success: false, error: 'Invalid capture filename' }, { status: 400 });
			}
			const fs = await import('fs');
			const path = await import('path');
			const filePath = path.join(process.cwd(), 'data', 'captures', body.filename);

			if (!fs.existsSync(filePath)) {
				return json({ success: false, error: 'Capture file not found' }, { status: 404 });
			}

			const capture = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
			eventsToImport = capture.events || [];
		} else if (body.events) {
			eventsToImport = body.events;
		} else {
			return json({ success: false, error: 'Provide filename or events array' }, { status: 400 });
		}

		if (!Array.isArray(eventsToImport)) {
			return json({ success: false, error: 'events must be an array' }, { status: 400 });
		}

		if (eventsToImport.length === 0) {
			return json({ success: false, error: 'No events to import' }, { status: 400 });
		}

		if (eventsToImport.length > MAX_EVENTS_PER_REQUEST) {
			return json(
				{ success: false, error: `Too many events in one request (max ${MAX_EVENTS_PER_REQUEST})` },
				{ status: 413 }
			);
		}

		if (legacy && !consumeLegacyBudget(eventsToImport.length)) {
			return json(
				{
					success: false,
					error:
						'Too many imports without an API key this hour. Add the YFEvents API key in the extension Config tab to lift this limit.',
				},
				{ status: 429 }
			);
		}

		const results = { added: 0, duplicate: 0, invalid: 0, errors: [] as string[] };

		// Non-object rows can never be events
		const rows = eventsToImport.filter((e: any) => {
			const ok = e && typeof e === 'object' && !Array.isArray(e);
			if (!ok) results.invalid++;
			return ok;
		});

		// Determine source based on content
		const hasFacebookEvents = rows.some((e: any) => e.facebookId || e.source === 'facebook');
		const hasHeraldEvents = rows.some((e: any) =>
			e.source === 'herald' ||
			(typeof e.url === 'string' && (e.url.includes('yakimaherald.com') || e.url.includes('cityspark.com')))
		);
		const sourceId = legacy
			? await getOrCreateSource(UNVERIFIED_SOURCE_NAME, 'browser-extension', 'html', false)
			: hasFacebookEvents
				? await getOrCreateSource('Facebook Browser Extension', 'https://www.facebook.com/events/', 'facebook')
				: hasHeraldEvents
					? await getOrCreateSource('Herald Browser Extension', 'https://www.yakimaherald.com/events/', 'cityspark')
					: await getOrCreateSource(
							'Browser Extension',
							typeof body.url === 'string' ? body.url.slice(0, 500) : 'browser-extension',
							'html'
						);
		const unverifiedSourceId = legacy ? null : await findSourceId(UNVERIFIED_SOURCE_NAME);

		for (let raw of rows) {
			try {
				if (legacy) {
					const strict = legacyEventSchema.safeParse(raw);
					if (!strict.success) {
						results.invalid++;
						continue;
					}
					raw = strict.data;
				}

				const scraped = convertCaptureToScrapedEvent(raw);
				if (!scraped) {
					results.invalid++;
					continue;
				}

				const result = await processEvent(scraped, sourceId, legacy ? 'pending' : 'approved');
				results[result]++;

				if (result === 'duplicate' && unverifiedSourceId !== null) {
					await promoteUnverified(scraped, unverifiedSourceId, sourceId);
				}
			} catch (err) {
				results.invalid++;
				if (results.errors.length < 20) {
					results.errors.push(`${String(raw?.title || 'unknown').slice(0, 80)}: ${String(err).slice(0, 200)}`);
				}
			}
		}

		console.log(`[PageCapture Import] (${auth.mode}) Processed ${eventsToImport.length} events: ${results.added} added, ${results.duplicate} duplicates, ${results.invalid} invalid`);

		return json({
			success: true,
			total: eventsToImport.length,
			...results,
			...(legacy
				? {
						pendingReview: true,
						notice:
							'No API key was sent, so these events are waiting for admin approval instead of going live. Paste the YFEvents API key into the extension Config tab to publish directly.',
					}
				: {}),
		});
	} catch (err) {
		console.error('[PageCapture Import] Error:', err);
		return json({ success: false, error: 'Failed to import events' }, { status: 500 });
	}
};

/**
 * A trusted import just reported `scraped` as a duplicate. If the existing row
 * is one an unauthenticated (legacy) post left pending, take it over: replace
 * its content with the trusted copy and approve it. Without this, anything a
 * legacy post touched first would stay pending forever (or, worse, keep
 * whatever text the unauthenticated poster supplied).
 */
async function promoteUnverified(
	scraped: ScrapedEvent,
	unverifiedSourceId: number,
	trustedSourceId: number
): Promise<void> {
	if (!scraped.externalEventId) return;
	await db
		.update(events)
		.set({
			title: scraped.title,
			description: scraped.description || null,
			// same Date -> DATETIME handling as the insert in processEvent()
			startDatetime: scraped.startDatetime as unknown as string,
			location: scraped.location || null,
			address: scraped.address || null,
			externalUrl: scraped.externalUrl || null,
			sourceId: trustedSourceId,
			status: 'approved',
		})
		.where(
			and(
				eq(events.externalEventId, scraped.externalEventId),
				eq(events.sourceId, unverifiedSourceId),
				eq(events.status, 'pending')
			)
		);
}

/**
 * Convert a raw capture event to a ScrapedEvent for processEvent()
 */
function convertCaptureToScrapedEvent(raw: any): ScrapedEvent | null {
	if (typeof raw.title !== 'string' || raw.title.trim().length < 4) return null;
	// Everything below treats these as strings; coerce junk types away up front
	for (const key of ['startDate', '_rawDate', 'venue', 'location', 'description', 'url'] as const) {
		if (raw[key] != null && typeof raw[key] !== 'string') raw = { ...raw, [key]: undefined };
	}
	if (raw.facebookId != null) {
		const fbId = String(raw.facebookId);
		raw = { ...raw, facebookId: /^[A-Za-z0-9_.-]{1,64}$/.test(fbId) ? fbId : undefined };
	}
	// Stored links are rendered as <a href>: only ever keep plain http(s)
	raw = { ...raw, url: httpUrlOrUndefined(raw.url) };

	// Parse the start date
	let startDatetime: Date | null = null;

	if (raw.startDate) {
		// Try ISO or standard date string first
		const parsed = new Date(raw.startDate);
		if (!isNaN(parsed.getTime())) {
			startDatetime = parsed;
			// If year is far in the past, it probably parsed wrong — try generic parser
			if (startDatetime.getFullYear() < new Date().getFullYear() - 1) {
				startDatetime = null;
			}
		}
		// Try generic date parser for "March 28", "April 24-26, 2026", "March 6 - 27" etc.
		if (!startDatetime) {
			const genericParsed = parseGenericDate(raw.startDate);
			if (genericParsed) startDatetime = genericParsed;
		}
	}

	if (!startDatetime && raw._rawDate) {
		// Try parsing raw date text (Facebook style)
		const parsed = parseFacebookDate(raw._rawDate);
		if (parsed) startDatetime = parsed;
	}

	// Try extracting date from Herald/CitySpark URL pattern: /details/slug/id/YYYY-MM-DDTHH
	if (!startDatetime && raw.url) {
		const heraldDate = parseHeraldUrlDate(raw.url);
		if (heraldDate) startDatetime = heraldDate;
	}

	if (!startDatetime) return null;

	// Build location string from available fields
	let location = '';
	if (raw.venue) location = raw.venue;
	if (raw.location) {
		// Clean up location - remove venue name if it got stuck to the front
		let loc = raw.location;
		if (raw.venue && loc.startsWith(raw.venue)) {
			loc = loc.substring(raw.venue.length).trim();
		}
		location = location ? `${location}, ${loc}` : loc;
	}

	// Clean up title - remove trailing whitespace, partial words
	let title = raw.title.trim();

	// Try Herald link text format: "Event TitleVenue | City, ST time"
	const heraldParsed = parseHeraldLinkText(title);
	if (heraldParsed) {
		title = heraldParsed.title;
		if (heraldParsed.city && !location) {
			location = heraldParsed.city;
		}
	}

	// Remove trailing "with" or similar incomplete phrases
	title = title.replace(/\s+(?:with|at|in|on|for|and|the|a|an)\s*$/i, '').trim();

	// Clean Facebook social context junk from title and location
	title = cleanFacebookSocialText(title);
	location = cleanFacebookSocialText(location);
	let address = raw.location ? cleanFacebookSocialText(raw.location) : undefined;

	// Split venue names concatenated to title (e.g. "Yoga with MeganGlenwood Square")
	const venueSplit = splitVenueFromTitle(title);
	if (venueSplit) {
		title = venueSplit.title;
		if (!location || location.length < 5) {
			location = venueSplit.venue;
		}
	}

	// Generate external event ID — CitySpark IDs from Herald URLs
	let externalEventId: string | undefined;
	if (raw.facebookId) {
		externalEventId = `fb_${raw.facebookId}`;
	} else if (raw.url?.includes('cityspark.com') || raw.url?.includes('yakimaherald.com/events/')) {
		const csMatch = raw.url.match(/\/details\/[^/]+\/(\d+)\//);
		externalEventId = csMatch ? `cityspark_${csMatch[1]}` : `ext_${hashCode(raw.title + (raw.startDate || ''))}`;
	} else if (raw.url?.includes('eventbrite.com/e/')) {
		externalEventId = `eb_${raw.url.split('/e/')[1]?.split(/[?/]/)[0] || hashCode(raw.title)}`;
	} else if (raw.url && raw.title) {
		externalEventId = `ext_${hashCode(raw.title + (raw.startDate || ''))}`;
	}

	return {
		title,
		description: raw.description || null,
		startDatetime,
		endDatetime: undefined,
		location: location || undefined,
		address: address || undefined,
		externalUrl: raw.url || undefined,
		externalEventId,
	};
}

/**
 * Remove Facebook social context text that gets concatenated to event data.
 * Examples:
 *   "7714 Cowiche Canyon Road, Yakima, WABreaunna is interested" -> "7714 Cowiche Canyon Road, Yakima, WA"
 *   "Watercolor 101North Town Coffee House11 interested · 4 going" -> "Watercolor 101"
 *   "Yakima, WA 989021 going" -> "Yakima, WA 98902"
 *   "1606 West Nob Hill Blvd., Yakima, WA12 interested · 3 going" -> "1606 West Nob Hill Blvd., Yakima, WA"
 */
/**
 * Detect and split venue names that got concatenated to event titles.
 * e.g. "Basic Yoga with MeganGlenwood Square" -> { title: "Basic Yoga with Megan", venue: "Glenwood Square" }
 */
function splitVenueFromTitle(title: string): { title: string; venue: string } | null {
	if (!title) return null;

	// Known Yakima area venue names
	const VENUES = [
		'Glenwood Square', 'North Town Coffee House', 'Mojo Studio', 'Capitol Theatre',
		'Warehouse Theatre', 'Yakima Valley Museum', 'Yakima Convention Center',
		'Yakima Convention & Event Center', 'Wellness House', 'Emil Kissel Park',
		'Stone Church', 'Seasons Performance Hall', 'Yakima Athletic Club',
		'West Valley High School', 'Central Washington Agricultural Museum',
	];

	for (const venue of VENUES) {
		const idx = title.indexOf(venue);
		if (idx > 0 && title[idx - 1] !== ' ' && title[idx - 1] !== ',') {
			return { title: title.substring(0, idx).trim(), venue };
		}
	}

	// Generic: detect camelCase boundary before venue-like words
	// "TitleTextVenue Hall" pattern — lowercase touching uppercase before a venue word
	const match = title.match(/^(.+?[a-z])([A-Z][a-z]+(?:\s+(?:Square|Center|Park|Church|Studio|House|Club|Hall|Museum|Cafe|Theatre|Theater|Gallery|Arena|Pavilion|Library|Complex|Mall|Plaza)(?:\b.*)?))$/);
	if (match && match[1].length > 5) {
		return { title: match[1].trim(), venue: match[2].trim() };
	}

	return null;
}

function cleanFacebookSocialText(text: string): string {
	if (!text) return text;

	// IMPORTANT: Do NOT use /i flag on patterns starting with [A-Z][a-z]+
	// because /i makes [a-z] match uppercase too, turning "proper name" into "any word"

	// Pattern 1: "N interested" / "N going" (safe to use /i since starts with \d)
	text = text.replace(/\d+\s+interested(?:\s*·\s*\d+\s+going)?.*$/i, '').trim();
	text = text.replace(/\d+\s+going.*$/i, '').trim();

	// Pattern 2: Names glued without space (e.g. "WAErik, Connor and 10 friends")
	// Must run before name patterns since it splits at the boundary
	text = text.replace(/([a-z.,])([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:\s+and\s+(?:[A-Z][a-z]+|\d+\s+friends?))?(?:\s+(?:is|are)\s+(?:interested|going))?\s*$)/, '$1').trim();

	// Pattern 3: "Name is/are interested/going" (NO /i flag)
	text = text.replace(/[A-Z][a-z]+(?:(?:,\s*[A-Z][a-z]+)*\s+and\s+(?:[A-Z][a-z]+|\d+\s+friends?))\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();
	text = text.replace(/[A-Z][a-z]+\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();
	text = text.replace(/[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();

	// Pattern 4: "Name, Name and N friends [interested]" (with or without action word)
	text = text.replace(/[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*\s+and\s+\d+\s+friends?(?:\s+interested)?.*$/, '').trim();

	// Pattern 5: Clean up any trailing punctuation artifacts
	text = text.replace(/[,\s]+$/, '').trim();

	return text;
}

/**
 * Parse Facebook-style date strings like "Tomorrow at 8 PM", "Sat, May 30 at 5 PM", etc.
 */
function parseFacebookDate(text: string): Date | null {
	const now = new Date();
	const lower = text.toLowerCase().trim();

	const MONTHS: Record<string, number> = {
		jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
		jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
	};

	// "Tomorrow at 8 PM"
	if (lower.startsWith('tomorrow')) {
		const d = new Date(now);
		d.setDate(d.getDate() + 1);
		return applyTimeFromText(d, text);
	}

	// "Today at 8 PM"
	if (lower.startsWith('today')) {
		return applyTimeFromText(new Date(now), text);
	}

	// "This Saturday at 11 AM" or bare "Wednesday at 4:00 PM"
	const thisDayMatch = lower.match(/(?:this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
	if (thisDayMatch) {
		const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
		const target = days.indexOf(thisDayMatch[1]);
		const d = new Date(now);
		let diff = (target - d.getDay() + 7) % 7;
		if (diff === 0) diff = 7;
		d.setDate(d.getDate() + diff);
		return applyTime(d, thisDayMatch[2], thisDayMatch[3]);
	}

	// "Sat, May 30 at 5 PM" or "Fri, Jul 10 - Jul 12"
	const absMatch = text.match(/(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s+(\w+)\s+(\d{1,2})(?:\s*[-–]\s*(?:\w+\s+)?(\d{1,2}))?(?:,?\s+(\d{4}))?(?:\s+at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm))?/i);
	if (absMatch) {
		const monthStr = absMatch[1].toLowerCase().substring(0, 3);
		const month = MONTHS[monthStr];
		if (month === undefined) return null;
		const day = parseInt(absMatch[2]);
		const year = absMatch[4] ? parseInt(absMatch[4]) : now.getFullYear();
		const d = new Date(year, month, day);
		if (!absMatch[4] && d < now) d.setFullYear(d.getFullYear() + 1);
		if (absMatch[5]) return applyTime(d, absMatch[5], absMatch[6]);
		d.setHours(12, 0, 0, 0); // Default to noon if no time
		return d;
	}

	return null;
}

/**
 * Simple string hash for generating external event IDs from non-Facebook sources
 */
function hashCode(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash |= 0;
	}
	return Math.abs(hash).toString(36);
}

/**
 * Parse generic date strings like "March 28, 2026", "April 24-26, 2026", "March 6 - 27", "January 1 - December 31"
 */
function parseGenericDate(text: string): Date | null {
	const MONTHS: Record<string, number> = {
		january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
		july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
	};
	const now = new Date();

	// "March 28, 2026" or "March 28" or "April 24-26, 2026" or "March 6 - 27"
	const match = text.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:\s*[-–]\s*(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+)?\d{1,2})?(?:,?\s*(\d{4}))?/i);
	if (match) {
		const month = MONTHS[match[1].toLowerCase()];
		if (month === undefined) return null;
		const day = parseInt(match[2]);
		const year = match[3] ? parseInt(match[3]) : now.getFullYear();
		const d = new Date(year, month, day, 12, 0, 0, 0);
		// If no year given and date is in the past, bump to next year
		if (!match[3] && d < now) d.setFullYear(d.getFullYear() + 1);
		return d;
	}

	// "03/28/2026" or "3/28"
	const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
	if (slashMatch) {
		const month = parseInt(slashMatch[1]) - 1;
		const day = parseInt(slashMatch[2]);
		let year = slashMatch[3] ? parseInt(slashMatch[3]) : now.getFullYear();
		if (year < 100) year += 2000;
		const d = new Date(year, month, day, 12, 0, 0, 0);
		if (!slashMatch[3] && d < now) d.setFullYear(d.getFullYear() + 1);
		return d;
	}

	return null;
}

function applyTimeFromText(d: Date, text: string): Date {
	const tm = text.match(/at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
	if (tm) return applyTime(d, tm[1], tm[2]);
	d.setHours(12, 0, 0, 0);
	return d;
}

function applyTime(d: Date, timeStr: string, ampm: string): Date {
	const parts = timeStr.split(':');
	let hours = parseInt(parts[0]);
	const mins = parts.length > 1 ? parseInt(parts[1]) : 0;
	if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
	if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
	d.setHours(hours, mins, 0, 0);
	return d;
}

/**
 * Parse date from Herald/CitySpark URL pattern.
 * URLs like: /details/some-event-slug/12345/2026-03-29T19
 * or: /details/some-event-slug/12345/2026-03-29T19:00:00
 */
function parseHeraldUrlDate(url: string): Date | null {
	// Match ISO date pattern in URL path segments
	const match = url.match(/\/(\d{4}-\d{2}-\d{2}T\d{2}(?::\d{2}(?::\d{2})?)?)/);
	if (!match) return null;

	let dateStr = match[1];
	// Pad incomplete ISO strings: "2026-03-29T19" -> "2026-03-29T19:00:00"
	if (dateStr.length === 13) dateStr += ':00:00'; // YYYY-MM-DDTHH
	else if (dateStr.length === 16) dateStr += ':00'; // YYYY-MM-DDTHH:MM

	const parsed = new Date(dateStr);
	return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parse Herald link text format where title and venue are concatenated.
 * Example: "Live Music NightCapitol Theatre | Yakima, WA 7:00 PM"
 * Returns parsed title and location if the pipe separator is found.
 */
function parseHeraldLinkText(text: string): { title: string; venue?: string; city?: string } | null {
	if (!text) return null;

	// Pattern: "Event TitleVenue Name | City, ST time"
	const pipeIdx = text.indexOf(' | ');
	if (pipeIdx === -1) return null;

	const beforePipe = text.substring(0, pipeIdx).trim();
	const afterPipe = text.substring(pipeIdx + 3).trim();

	// After pipe is typically "City, ST time" — extract city
	const city = afterPipe.replace(/\s+\d{1,2}:\d{2}\s*(am|pm)?\s*$/i, '').trim();

	return { title: beforePipe, city: city || undefined };
}

/**
 * Get or create a calendar_sources entry for browser extension imports
 */
async function getOrCreateSource(name: string, url: string, scrapeType: string, active = true): Promise<number> {
	const existingId = await findSourceId(name);
	if (existingId !== null) return existingId;

	const result = await db.insert(calendarSources).values({
		name,
		url,
		scrapeType,
		active,
	});

	return Number(result[0].insertId);
}

async function findSourceId(name: string): Promise<number | null> {
	const existing = await db.select({ id: calendarSources.id })
		.from(calendarSources)
		.where(eq(calendarSources.name, name))
		.limit(1);

	return existing.length > 0 ? existing[0].id : null;
}
