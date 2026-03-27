/**
 * One-time: match existing events to local shops.
 * Run with: npx tsx scripts/match-shops.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

// Known aliases
const SHOP_ALIASES: Record<string, string> = {
  'tin shed': 'Flippers Antiques',
  'flippers': 'Flippers Antiques',
  'the seasons': 'The Seasons Performance Hall',
  'seasons performance hall': 'The Seasons Performance Hall',
  'seasons': 'The Seasons Performance Hall',
  'capitol theatre': 'Capitol Theatre',
  'the capitol theatre': 'Capitol Theatre',
  'capitol theater': 'Capitol Theatre',
  'larson gallery': 'Larson Gallery',
  'yv museum': 'Yakima Valley Museum',
  'yakima valley museum': 'Yakima Valley Museum',
  'single hill': 'Single Hill Brewing',
  'single hill brewing': 'Single Hill Brewing',
  'single hill brewing co': 'Single Hill Brewing',
  'single hill brewing company': 'Single Hill Brewing',
  'state fair park': 'State Fair Park - Home of the Yakima Valley SunDome & Central Washington State Fair',
  'sundome': 'State Fair Park - Home of the Yakima Valley SunDome & Central Washington State Fair',
  'yakima sundome': 'State Fair Park - Home of the Yakima Valley SunDome & Central Washington State Fair',
  'boxx gallery': 'Boxx Gallery',
  "churchill's": "Churchill's Booklover's Haunt",
  'churchills': "Churchill's Booklover's Haunt",
  'gilbert cellars': 'Gilbert Cellars',
  'kana winery': 'Kana Winery',
  'yakima arboretum': 'Yakima Area Arboretum',
  'the arboretum': 'Yakima Area Arboretum',
  'maker space': 'Yakima Maker Space',
  'yakima maker space': 'Yakima Maker Space',
  'creative yakima': 'Creative Yakima',
  'mak daddy': 'Mak Daddy Coffee',
  'second street grill': 'Second Street Grill',
  'essencia': 'Essencia Artisan Bakery',
  "mel's diner": "Mel's Diner",
  'mels diner': "Mel's Diner",
};

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  // Load shops
  const [shops] = await conn.execute('SELECT id, name, address FROM local_shops WHERE active = 1') as any;
  const shopByName = new Map<string, number>(shops.map((s: any) => [s.name.toLowerCase(), s.id]));
  console.log(`Loaded ${shops.length} shops`);

  // Load events
  const [events] = await conn.execute('SELECT id, title, location FROM events WHERE status = "approved"') as any;
  console.log(`Checking ${events.length} events...`);

  // Check existing links
  const [existing] = await conn.execute('SELECT event_id FROM event_shop_participants') as any;
  const existingSet = new Set(existing.map((e: any) => e.event_id));

  let linked = 0;
  const matches: { eventId: number; title: string; location: string; shopName: string; shopId: number }[] = [];

  for (const event of events) {
    if (existingSet.has(event.id)) continue;

    const titleLower = (event.title || '').toLowerCase();
    const locationLower = (event.location || '').toLowerCase();
    let matchedShopId: number | null = null;
    let matchedShopName = '';

    // 1. Check aliases
    for (const [alias, shopName] of Object.entries(SHOP_ALIASES)) {
      if (locationLower.includes(alias) || titleLower.includes(alias)) {
        const id = shopByName.get(shopName.toLowerCase());
        if (id) {
          matchedShopId = id;
          matchedShopName = shopName;
          break;
        }
      }
    }

    // 2. Direct shop name match (full name only, no partial words)
    if (!matchedShopId) {
      for (const shop of shops) {
        const sn = shop.name.toLowerCase();
        if (sn.length < 4) continue;
        if (locationLower.includes(sn) || titleLower.includes(sn)) {
          matchedShopId = shop.id;
          matchedShopName = shop.name;
          break;
        }
      }
    }

    // 3. Address match
    if (!matchedShopId) {
      for (const shop of shops) {
        if (!shop.address) continue;
        const addrMatch = shop.address.match(/^(\d+\s+\S+\s+\S+)/);
        if (addrMatch && locationLower.includes(addrMatch[1].toLowerCase())) {
          matchedShopId = shop.id;
          matchedShopName = shop.name;
          break;
        }
      }
    }

    if (matchedShopId) {
      matches.push({
        eventId: event.id,
        title: event.title,
        location: event.location || '',
        shopName: matchedShopName,
        shopId: matchedShopId,
      });
    }
  }

  // Show matches first
  console.log(`\nFound ${matches.length} matches:\n`);
  for (const m of matches) {
    console.log(`  Event #${m.eventId}: "${m.title}" @ "${m.location}" → ${m.shopName} (shop #${m.shopId})`);
  }

  // Insert links
  if (matches.length > 0) {
    console.log(`\nInserting ${matches.length} shop links...`);
    for (const m of matches) {
      await conn.execute(
        'INSERT INTO event_shop_participants (event_id, shop_id, approval_status, participation_role) VALUES (?, ?, "approved", "venue")',
        [m.eventId, m.shopId]
      );
      linked++;
    }
  }

  console.log(`\nLinked ${linked} events to shops`);
  await conn.end();
}

main().catch(console.error);
