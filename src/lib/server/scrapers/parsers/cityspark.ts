/**
 * CitySpark Parser
 * Parses events from CitySpark API (used by Yakima Herald and other local news sites)
 * API endpoint: POST portal.cityspark.com/api/events/GetEvents/{PublisherName}
 *
 * Required params: { lat, lng, distance, start, end, skip }
 * Returns: { Value: CitySparkEvent[], Success: boolean }
 * Pagination: 100 events per request, use `skip` to paginate
 */

import type { ScrapedEvent } from '../types';

const YAKIMA_LAT = 46.6021;
const YAKIMA_LNG = -120.5059;
const MAX_DISTANCE_MILES = 25;
const PAGE_SIZE = 100;
const MAX_PAGES = 10; // safety limit: 1000 events max

interface CitySparkEvent {
	Name: string;
	Description?: string;
	Venue?: string;
	Address?: string;
	CityState?: string;
	DateStart?: string;
	DateEnd?: string;
	StartLocal?: string;
	EndLocal?: string;
	latitude?: number;
	longitude?: number;
	Images?: Array<{ url: string }>;
	Links?: Array<{ url: string; name?: string }>;
	Id?: string;
	PId?: number;
	Distance?: number;
	PrimaryUrl?: string;
	AllDay?: boolean;
	HasTime?: boolean;
}

/**
 * Fetch and parse events from a CitySpark API endpoint.
 * URL should be like: https://portal.cityspark.com/api/events/GetEvents/YakimaHerald
 */
export async function scrapeCitySpark(url: string): Promise<ScrapedEvent[]> {
	const now = new Date();
	const start = now.toISOString().split('T')[0];
	// Look ahead 90 days
	const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
	const end = endDate.toISOString().split('T')[0];

	const allRaw: CitySparkEvent[] = [];

	for (let page = 0; page < MAX_PAGES; page++) {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (compatible; YFEvents/1.0)',
			},
			body: JSON.stringify({
				lat: YAKIMA_LAT,
				lng: YAKIMA_LNG,
				distance: MAX_DISTANCE_MILES,
				start,
				end,
				skip: page * PAGE_SIZE,
			}),
		});

		if (!response.ok) {
			throw new Error(`CitySpark API returned ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		const batch: CitySparkEvent[] = Array.isArray(data) ? data : data.Value || [];

		if (batch.length === 0) break;
		allRaw.push(...batch);

		console.log(`[CitySpark] Page ${page + 1}: ${batch.length} events (total raw: ${allRaw.length})`);
		if (batch.length < PAGE_SIZE) break;
	}

	console.log(`[CitySpark] API returned ${allRaw.length} total events within ${MAX_DISTANCE_MILES}mi`);

	// Deduplicate by PId
	const seen = new Set<number>();
	const events: ScrapedEvent[] = [];

	for (const raw of allRaw) {
		if (raw.PId && seen.has(raw.PId)) continue;
		if (raw.PId) seen.add(raw.PId);

		// Distance filter (API should handle this, but double-check)
		if (raw.Distance !== undefined && raw.Distance > MAX_DISTANCE_MILES) continue;

		const event = mapCitySparkEvent(raw);
		if (event) events.push(event);
	}

	console.log(`[CitySpark] ${events.length} unique events after dedup and filtering`);
	return events;
}

/**
 * Map a CitySpark event to our ScrapedEvent format
 */
function mapCitySparkEvent(raw: CitySparkEvent): ScrapedEvent | null {
	if (!raw.Name) return null;

	// CitySpark returns Pacific wall-clock times but mislabels them with a Z (UTC)
	// suffix. Strip the trailing Z/offset so `new Date()` treats them as local; the
	// process runs in America/Los_Angeles so the parsed moment matches Pacific.
	const stripTz = (s: string) => s.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, '');

	// Parse start date — try StartLocal first, then DateStart
	let startDatetime: Date | null = null;

	if (raw.StartLocal) {
		startDatetime = new Date(stripTz(raw.StartLocal));
	}
	if ((!startDatetime || isNaN(startDatetime.getTime())) && raw.DateStart) {
		startDatetime = new Date(stripTz(raw.DateStart));
	}
	if (!startDatetime || isNaN(startDatetime.getTime())) return null;

	// Skip events with placeholder dates (year 1 = no real date)
	if (startDatetime.getFullYear() < 2020) return null;

	// Skip past events
	if (startDatetime < new Date()) return null;

	// Parse end date
	let endDatetime: Date | undefined;
	if (raw.EndLocal) {
		const end = new Date(stripTz(raw.EndLocal));
		if (!isNaN(end.getTime()) && end.getFullYear() > 2020) endDatetime = end;
	} else if (raw.DateEnd) {
		const end = new Date(stripTz(raw.DateEnd));
		if (!isNaN(end.getTime()) && end.getFullYear() > 2020) endDatetime = end;
	}

	// Build location from venue + city
	let location = raw.Venue?.trim() || '';
	if (raw.CityState && !location.includes(raw.CityState)) {
		location = location ? `${location}, ${raw.CityState}` : raw.CityState;
	}

	// Build external URL — prefer PrimaryUrl, then non-CitySpark links
	let externalUrl: string | undefined = raw.PrimaryUrl || undefined;
	if (!externalUrl && raw.Links && raw.Links.length > 0) {
		const originalLink = raw.Links.find(l => l.url && !l.url.includes('cityspark.com'));
		externalUrl = originalLink?.url || raw.Links[0]?.url;
	}

	// Strip HTML/markdown from description
	let description = raw.Description || undefined;
	if (description) {
		description = description
			.replace(/<[^>]+>/g, ' ')
			.replace(/\\([.*_~`])/g, '$1') // unescape markdown
			.replace(/\s+/g, ' ')
			.trim();
		if (description.length > 2000) description = description.substring(0, 2000) + '...';
	}

	return {
		title: raw.Name.trim(),
		description,
		startDatetime,
		endDatetime,
		location: location || undefined,
		address: raw.Address || undefined,
		latitude: raw.latitude,
		longitude: raw.longitude,
		externalUrl,
		externalEventId: raw.PId ? `cityspark_${raw.PId}` : undefined,
	};
}
