/**
 * Backfill event address/coordinates from local shops.
 *
 * Pass 1: events already linked to a shop (event_shop_participants) inherit
 *         the shop's address/lat/lng where the event is missing them.
 * Pass 2: upcoming events with a location but no shop link are name-matched
 *         against active shops and venue placeholders; matches are linked
 *         and backfilled the same way.
 *
 * Run with: npx tsx scripts/backfill-event-locations.ts [--dry-run]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const dryRun = process.argv.includes('--dry-run');

interface ShopRow {
  id: number;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
}

// Bare city/town names — placeholders with these names carry town-center
// coordinates and location-text "addresses" that would pollute events
const CITY_NAMES = new Set([
  'yakima', 'naches', 'selah', 'zillah', 'tieton', 'wapato', 'toppenish',
  'sunnyside', 'granger', 'prosser', 'moxee', 'union gap', 'grandview',
  'ellensburg', 'cowiche', 'outlook', 'buena', 'mabton', 'harrah',
  'white swan', 'parker', 'terrace heights', 'benton city',
]);

function isCityShop(shop: ShopRow): boolean {
  return CITY_NAMES.has(shop.name.toLowerCase().trim());
}

function buildFills(event: { address: string | null; latitude: string | null }, shop: ShopRow) {
  const fills: Record<string, string> = {};
  // Only inherit addresses that look like real street addresses — placeholder
  // "addresses" are sometimes just the raw location text
  if (!event.address && shop.address && /^\d+\s/.test(shop.address)) fills.address = shop.address;
  if (!event.latitude && shop.latitude && shop.longitude) {
    fills.latitude = shop.latitude;
    fills.longitude = shop.longitude;
  }
  return fills;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  const todayStart =
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles' }).format(new Date()) +
    ' 00:00:00';

  // --- Pass 1: events already linked to shops ---
  const [linked] = await conn.execute(
    `SELECT e.id, e.title, e.address, e.latitude,
            s.id AS shop_id, s.name AS shop_name, s.address AS shop_address,
            s.latitude AS shop_lat, s.longitude AS shop_lng
     FROM events e
     JOIN event_shop_participants esp ON esp.event_id = e.id
     JOIN local_shops s ON s.id = esp.shop_id
     WHERE e.status IN ('approved', 'pending')
       AND e.start_datetime >= ?
       AND (e.address IS NULL OR e.address = '' OR e.latitude IS NULL)
       AND (s.address IS NOT NULL OR s.latitude IS NOT NULL)`,
    [todayStart]
  ) as any;

  let filledLinked = 0;
  for (const row of linked) {
    const shop: ShopRow = { id: row.shop_id, name: row.shop_name, address: row.shop_address, latitude: row.shop_lat, longitude: row.shop_lng };
    if (isCityShop(shop)) continue;
    const fills = buildFills({ address: row.address, latitude: row.latitude }, shop);
    if (Object.keys(fills).length === 0) continue;
    console.log(`[linked] #${row.id} "${String(row.title).slice(0, 50)}" <- ${row.shop_name}: ${Object.keys(fills).join(',')}`);
    if (!dryRun) {
      const cols = Object.keys(fills).map((k) => `${k} = ?`).join(', ');
      await conn.execute(`UPDATE events SET ${cols} WHERE id = ?`, [...Object.values(fills), row.id]);
    }
    filledLinked++;
  }

  // --- Pass 2: unlinked upcoming events, matched by venue name ---
  const [shops] = await conn.execute(
    `SELECT id, name, address, latitude, longitude
     FROM local_shops
     WHERE (active = 1 OR is_venue_placeholder = 1)
       AND latitude IS NOT NULL AND CHAR_LENGTH(name) >= 4`
  ) as any;

  const [unlinked] = await conn.execute(
    `SELECT e.id, e.title, e.location, e.address, e.latitude
     FROM events e
     LEFT JOIN event_shop_participants esp ON esp.event_id = e.id
     WHERE e.status IN ('approved', 'pending')
       AND e.start_datetime >= ?
       AND esp.id IS NULL
       AND e.location IS NOT NULL AND e.location != ''`,
    [todayStart]
  ) as any;

  let filledMatched = 0;
  for (const ev of unlinked) {
    const locationLower = String(ev.location).toLowerCase();
    let match: ShopRow | null = null;
    for (const shop of shops as ShopRow[]) {
      if (isCityShop(shop)) continue;
      const escaped = shop.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^|\\s|,)${escaped}(?:\\s|,|$)`, 'i');
      if (re.test(locationLower)) {
        // Prefer the longest shop-name match (most specific)
        if (!match || shop.name.length > match.name.length) match = shop;
      }
    }
    if (!match) continue;

    const fills = buildFills({ address: ev.address, latitude: ev.latitude }, match);
    console.log(`[match]  #${ev.id} "${String(ev.title).slice(0, 50)}" @ "${String(ev.location).slice(0, 40)}" <- ${match.name}${Object.keys(fills).length ? ': ' + Object.keys(fills).join(',') : ' (link only)'}`);
    if (!dryRun) {
      if (Object.keys(fills).length > 0) {
        const cols = Object.keys(fills).map((k) => `${k} = ?`).join(', ');
        await conn.execute(`UPDATE events SET ${cols} WHERE id = ?`, [...Object.values(fills), ev.id]);
      }
      await conn.execute(
        `INSERT IGNORE INTO event_shop_participants (event_id, shop_id, approval_status, participation_role)
         VALUES (?, ?, 'approved', 'venue')`,
        [ev.id, match.id]
      );
    }
    filledMatched++;
  }

  console.log(`\n${dryRun ? '[DRY RUN] Would backfill' : 'Backfilled'} ${filledLinked} linked + ${filledMatched} name-matched events`);
  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
