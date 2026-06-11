/**
 * Extract venue names from event locations and create venue placeholders.
 * Venues are stored as local_shops with is_venue_placeholder=true.
 * Owners can claim them to promote to full shop listings.
 */
import { db } from '$lib/server/db';
import { localShops, eventShopParticipants } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Generic/skip locations that shouldn't become venues
const SKIP_PATTERNS = /^(?:yakima|selah|union gap|prosser|naches|zillah|tieton|wapato|toppenish|sunnyside|granger|moxee|grandview|ellensburg|cowiche|outlook|buena|mabton|harrah|white swan|parker|terrace heights|benton city|online|virtual|tbd|zoom|teams|wa|washington|united states|various|multiple|downtown|see description|to be announced)(?:\s*,|\s+wa\b|\s*$)/i;
const ADDRESS_ONLY = /^\d+\s+(?:N\.?|S\.?|E\.?|W\.?|North|South|East|West)?\s*\w+\s+(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Hwy|Road|Street|Avenue|Drive|Boulevard|Lane|Court|Circle|Place|Trail)/i;

/**
 * Extract a venue name from an event location string.
 * Returns null if the location is too generic or just an address.
 */
export function extractVenueName(location: string): string | null {
	if (!location) return null;

	let name = location.trim();

	// Remove trailing social text junk that may have slipped through
	name = name.replace(/\d+\s+(?:interested|going).*$/i, '').trim();
	name = name.replace(/[A-Z][a-z]+\s+(?:is|are)\s+interested.*$/i, '').trim();

	// Strip trailing city/state/zip patterns
	// "The Capitol Theatre, Yakima" -> "The Capitol Theatre"
	// "Single Hill Brewing Company, Yakima, WA 98901" -> "Single Hill Brewing Company"
	name = name.replace(/,\s*(?:Yakima|Selah|Union Gap|Prosser|Sunnyside|Zillah|Naches|Tieton|Ellensburg|Toppenish|Wapato|Grandview|Goldendale)\b.*$/i, '').trim();
	name = name.replace(/,\s*(?:WA|Washington)\b.*$/i, '').trim();
	name = name.replace(/,\s*(?:United States)\b.*$/i, '').trim();

	// Strip trailing zip codes
	name = name.replace(/\s+\d{5}(?:-\d{4})?$/, '').trim();

	// Too short or generic
	if (name.length < 4) return null;
	if (SKIP_PATTERNS.test(name)) return null;

	// If what remains is purely an address (starts with a number + street), skip
	if (ADDRESS_ONLY.test(name) && name.length < 60) return null;

	return name;
}

/**
 * Normalize a venue name for dedup matching.
 */
function normalizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find or create a venue placeholder in local_shops.
 * Returns the shop ID, or null if the location isn't suitable for a venue.
 */
export async function findOrCreateVenuePlaceholder(
	location: string,
	address?: string,
	lat?: string,
	lng?: string
): Promise<number | null> {
	const venueName = extractVenueName(location);
	if (!venueName) return null;

	const normalized = normalizeName(venueName);

	// Check if a venue placeholder already exists with this normalized name
	const existing = await db
		.select({
			id: localShops.id,
			address: localShops.address,
			latitude: localShops.latitude,
			isVenuePlaceholder: localShops.isVenuePlaceholder,
		})
		.from(localShops)
		.where(eq(localShops.normalizedName, normalized))
		.limit(1);

	if (existing.length > 0) {
		const found = existing[0];
		// Increment source count, and enrich the placeholder with any venue
		// details this event has that the placeholder still lacks
		const fills: Record<string, unknown> = { venueSourceCount: sql`venue_source_count + 1` };
		if (found.isVenuePlaceholder) {
			if (address && (!found.address || found.address === location)) fills.address = address;
			if (!found.latitude && lat && lng) {
				fills.latitude = lat;
				fills.longitude = lng;
			}
		}
		await db.update(localShops).set(fills).where(eq(localShops.id, found.id));
		return found.id;
	}

	// Create new venue placeholder
	const result = await db.insert(localShops).values({
		name: venueName,
		normalizedName: normalized,
		address: address || location,
		latitude: lat || null,
		longitude: lng || null,
		isVenuePlaceholder: true,
		venueSourceCount: 1,
		status: 'pending',
		active: false, // Not visible in public shop listings
	});

	return Number(result[0].insertId);
}
