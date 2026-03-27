/**
 * One-time: create venue placeholders for events not linked to any shop.
 * Run with: npx tsx scripts/backfill-venues.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const SKIP_PATTERNS = /^(?:yakima|selah|union gap|prosser|online|virtual|tbd|zoom|teams|wa|washington|united states|various|multiple|downtown|see description|to be announced)/i;
const ADDRESS_ONLY = /^\d+\s+(?:N\.?|S\.?|E\.?|W\.?|North|South|East|West)?\s*\w+\s+(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Hwy|Road|Street|Avenue|Drive|Boulevard|Lane|Court|Circle|Place|Trail)/i;

function extractVenueName(location: string): string | null {
	if (!location) return null;
	let name = location.trim();
	name = name.replace(/\d+\s+(?:interested|going).*$/i, '').trim();
	name = name.replace(/[A-Z][a-z]+\s+(?:is|are)\s+interested.*$/i, '').trim();
	name = name.replace(/,\s*(?:Yakima|Selah|Union Gap|Prosser|Sunnyside|Zillah|Naches|Tieton|Ellensburg|Toppenish|Wapato|Grandview|Goldendale)\b.*$/i, '').trim();
	name = name.replace(/,\s*(?:WA|Washington)\b.*$/i, '').trim();
	name = name.replace(/,\s*(?:United States)\b.*$/i, '').trim();
	name = name.replace(/\s+\d{5}(?:-\d{4})?$/, '').trim();
	if (name.length < 4) return null;
	if (SKIP_PATTERNS.test(name)) return null;
	if (ADDRESS_ONLY.test(name) && name.length < 60) return null;
	return name;
}

function normalizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function main() {
	const conn = await mysql.createConnection({
		host: process.env.DATABASE_HOST || 'localhost',
		port: parseInt(process.env.DATABASE_PORT || '3306'),
		user: process.env.DATABASE_USER,
		password: process.env.DATABASE_PASSWORD,
		database: process.env.DATABASE_NAME,
	});

	// Get events not linked to any shop
	const [events] = await conn.query<any[]>(`
		SELECT e.id, e.title, e.location, e.latitude, e.longitude
		FROM events e
		LEFT JOIN event_shop_participants esp ON e.id = esp.event_id
		WHERE esp.id IS NULL
		  AND e.location IS NOT NULL
		  AND e.location != ''
	`);

	console.log(`Found ${events.length} unlinked events with locations`);

	let created = 0;
	let linked = 0;
	let skipped = 0;

	for (const event of events) {
		const venueName = extractVenueName(event.location);
		if (!venueName) {
			skipped++;
			continue;
		}

		const normalized = normalizeName(venueName);

		// Check if venue placeholder (or real shop) already exists
		const [existing] = await conn.query<any[]>(
			'SELECT id FROM local_shops WHERE normalized_name = ? LIMIT 1',
			[normalized]
		);

		let shopId: number;
		if (existing.length > 0) {
			shopId = existing[0].id;
			// Increment source count
			await conn.query(
				'UPDATE local_shops SET venue_source_count = venue_source_count + 1 WHERE id = ?',
				[shopId]
			);
		} else {
			// Create new venue placeholder
			const [result] = await conn.query<any>(
				`INSERT INTO local_shops (name, normalized_name, address, latitude, longitude, is_venue_placeholder, venue_source_count, status, active)
				 VALUES (?, ?, ?, ?, ?, TRUE, 1, 'pending', FALSE)`,
				[venueName, normalized, event.location, event.latitude || null, event.longitude || null]
			);
			shopId = result.insertId;
			created++;
			console.log(`  Created venue: "${venueName}"`);
		}

		// Link event to venue
		await conn.query(
			`INSERT IGNORE INTO event_shop_participants (event_id, shop_id, approval_status, participation_role)
			 VALUES (?, ?, 'approved', 'venue')`,
			[event.id, shopId]
		);
		linked++;
	}

	console.log(`\nDone:`);
	console.log(`  ${created} new venue placeholders created`);
	console.log(`  ${linked} events linked to venues`);
	console.log(`  ${skipped} events skipped (generic/address-only locations)`);

	await conn.end();
}

main().catch(console.error);
