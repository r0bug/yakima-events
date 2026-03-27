import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processEvent } from '$lib/server/scrapers/scraper';
import type { ScrapedEvent } from '$lib/server/scrapers/types';
import { db } from '$lib/server/db';
import { calendarSources } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/scraper/page-capture/import
 *
 * Import Facebook events from browser extension captures.
 * Accepts either:
 *   - { filename: "capture_xxx.json" } to import from a saved capture file
 *   - { events: [...] } to import events directly
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		let eventsToImport: any[] = [];

		if (body.filename) {
			// Load from saved capture file
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

		if (eventsToImport.length === 0) {
			return json({ success: false, error: 'No events to import' }, { status: 400 });
		}

		// Determine source based on content
		const hasFacebookEvents = eventsToImport.some((e: any) => e.facebookId || e.source === 'facebook');
		let sourceId = hasFacebookEvents
			? await getOrCreateSource('Facebook Browser Extension', 'https://www.facebook.com/events/', 'facebook')
			: await getOrCreateSource('Browser Extension', body.url || 'browser-extension', 'html');

		const results = { added: 0, duplicate: 0, invalid: 0, errors: [] as string[] };

		for (const raw of eventsToImport) {
			try {
				const scraped = convertCaptureToScrapedEvent(raw);
				if (!scraped) {
					results.invalid++;
					continue;
				}

				const result = await processEvent(scraped, sourceId, 'approved');
				results[result]++;
			} catch (err) {
				results.invalid++;
				results.errors.push(`${raw.title || 'unknown'}: ${String(err)}`);
			}
		}

		console.log(`[PageCapture Import] Processed ${eventsToImport.length} events: ${results.added} added, ${results.duplicate} duplicates, ${results.invalid} invalid`);

		return json({
			success: true,
			total: eventsToImport.length,
			...results
		});
	} catch (err) {
		console.error('[PageCapture Import] Error:', err);
		return json({ success: false, error: String(err) }, { status: 500 });
	}
};

/**
 * Convert a raw capture event to a ScrapedEvent for processEvent()
 */
function convertCaptureToScrapedEvent(raw: any): ScrapedEvent | null {
	if (!raw.title || raw.title.length < 4) return null;

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

	return {
		title,
		description: raw.description || null,
		startDatetime,
		endDatetime: undefined,
		location: location || undefined,
		address: address || undefined,
		externalUrl: raw.url || undefined,
		externalEventId: raw.facebookId
			? `fb_${raw.facebookId}`
			: raw.url && raw.title
				? `ext_${hashCode(raw.title + (raw.startDate || ''))}`
				: undefined,
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

	// Pattern 1: "N interested" / "N going" / "N interested · N going" (with optional preceding names)
	// This catches: "12 interested · 3 going", "1 going", "2 interested"
	text = text.replace(/\d+\s+interested(?:\s*·\s*\d+\s+going)?.*$/i, '').trim();
	text = text.replace(/\d+\s+going.*$/i, '').trim();

	// Pattern 2: "Name is interested" / "Name and Name are interested" / "Name, Name and N friends interested"
	// Catches: "Breaunna is interested", "Rob, Roger and 2 friends interested", "Heather and Kevin are interested"
	text = text.replace(/[A-Z][a-z]+(?:(?:,\s*[A-Z][a-z]+)*\s+and\s+(?:[A-Z][a-z]+|\d+\s+friends?))\s+(?:is|are)\s+interested.*$/i, '').trim();
	text = text.replace(/[A-Z][a-z]+\s+is\s+interested.*$/i, '').trim();
	text = text.replace(/[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+are\s+interested.*$/i, '').trim();
	// "Rob, Roger and 2 friends interested" (without is/are)
	text = text.replace(/[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*\s+and\s+\d+\s+friends?\s+interested.*$/i, '').trim();

	// Pattern 3: "— Game Day!" type separators with venue info that got stuck
	// Keep this for now, may need more specific patterns

	// Pattern 4: Clean up any trailing punctuation artifacts
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

	// "This Saturday at 11 AM"
	const thisDayMatch = lower.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
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
 * Get or create a calendar_sources entry for browser extension imports
 */
async function getOrCreateSource(name: string, url: string, scrapeType: string): Promise<number> {
	const existing = await db.select()
		.from(calendarSources)
		.where(eq(calendarSources.name, name))
		.limit(1);

	if (existing.length > 0) {
		return existing[0].id;
	}

	const result = await db.insert(calendarSources).values({
		name,
		url,
		scrapeType,
		active: true,
	});

	return Number(result[0].insertId);
}
