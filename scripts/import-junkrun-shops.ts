/**
 * Import junk run shops into the database.
 * - Ensures junk-run categories exist with colors
 * - Cross-references 39 hardcoded shops with local_shops
 * - Inserts missing shops, updates coordinates on existing ones
 *
 * Run: npx tsx scripts/import-junkrun-shops.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

// Junk run category definitions
const JUNK_RUN_CATEGORIES = [
  { slug: 'antique', name: 'Antiques & Vintage', color: '#b7410e', icon: 'star' },
  { slug: 'killer', name: 'Killer Thrift', color: '#7b2d8e', icon: 'fire' },
  { slug: 'charity', name: 'Charity Thrift', color: '#2d6a4f', icon: 'heart' },
  { slug: 'corporate', name: 'Corporate Thrift', color: '#2b6cb0', icon: 'building' },
  { slug: 'specialty', name: 'Specialty', color: '#0d9488', icon: 'gem' },
];

// All 39 shops from the static junk run page
const JUNK_RUN_SHOPS = [
  { name: "Yesterday's Village", address: "15 W Yakima Ave, Yakima, WA 98902", lat: 46.60185, lng: -120.50809, phone: "(509) 457-4981", hours: "Tue-Sat 10am-5pm", notes: "Big multi-floor antique mall.", cat: "antique" },
  { name: "Yakima Finds Antique Mall", address: "111 S 2nd St, Yakima, WA 98901", lat: 46.60112, lng: -120.50377, phone: "(509) 969-1111", hours: "Mon-Sat 11am-7pm; Sun 11am-5pm", notes: "Curated multi-vendor antique mall.", cat: "antique" },
  { name: "Flippers Antiques & Estate Sales", address: "519 W Yakima Ave, Yakima, WA 98902", lat: 46.60002, lng: -120.51604, phone: "(509) 571-3112", hours: null, notes: "Known for estate furniture finds.", cat: "antique" },
  { name: "Antiques Etc.", address: "5110 Tieton Dr, Yakima, WA", lat: 46.59260, lng: -120.57718, phone: null, hours: null, notes: "Boutique-style shop in Glenwood Square.", cat: "antique" },
  { name: "Eclectricities", address: "5110 Tieton Dr Suite 261, Yakima, WA 98908", lat: 46.59260, lng: -120.57718, phone: "(509) 728-0248", hours: null, notes: "Authentic vintage clothing and accessories.", cat: "antique" },
  { name: "Vintage Me", address: "106 S 3rd St, Yakima, WA 98901", lat: 46.60144, lng: -120.50250, phone: "(509) 834-8166", hours: null, notes: "Vintage-inspired gifts and refurbished goods.", cat: "antique" },
  { name: "Ron's Coin & Collectables", address: "6 N 3rd St, Yakima, WA 98901", lat: 46.60306, lng: -120.50326, phone: "(509) 248-1117", hours: null, notes: "Vintage coins, gold, silver, and paper money.", cat: "antique" },
  { name: "Sideshow Antiques", address: "111 S 2nd St, Yakima, WA", lat: 46.60112, lng: -120.50377, phone: "(509) 426-4525", hours: null, notes: "Oddities, taxidermy, and circus pieces.", cat: "antique" },
  { name: "Cobblestone's Gifts", address: "4906 Summitview Ave, Yakima, WA", lat: 46.59982, lng: -120.57456, phone: "(509) 457-4540", hours: null, notes: "Antiques plus vintage-style decor.", cat: "antique" },
  { name: "Whimsical Details", address: "30 N 2nd St, Yakima, WA", lat: 46.60294, lng: -120.50498, phone: null, hours: null, notes: "Upcycled and restored vintage furniture.", cat: "antique" },
  { name: "Heritage Outfitters", address: "32 N 3rd St, Yakima, WA", lat: 46.60335, lng: -120.50340, phone: null, hours: null, notes: "Industrial vintage, tools, and rustic Americana.", cat: "antique" },
  { name: "One More Time Around", address: "419 W Yakima Ave, Yakima, WA 98902", lat: 46.60037, lng: -120.51453, phone: "(509) 571-4413", hours: null, notes: "Quirky vintage mix and accessories.", cat: "antique" },
  { name: "The Closet Thrift Store", address: "121 S 1st St, Yakima, WA", lat: 46.60100, lng: -120.50250, phone: null, hours: null, notes: "Retro section with genuine 50s-90s finds.", cat: "antique" },
  { name: "Yakima Gaming and Collectibles", address: "910 Summitview Ave Suite 1A, Yakima, WA", lat: 46.59977, lng: -120.52228, phone: null, hours: null, notes: "Retro games, cards, and action figures.", cat: "antique" },
  { name: "Appletown Game & Hobby", address: "1018 W Nob Hill Blvd, Yakima, WA", lat: 46.58516, lng: -120.52152, phone: null, hours: null, notes: "Vintage tabletop and hobby collections.", cat: "antique" },
  { name: "Gretchen", address: "4001 Summitview Ave, Yakima, WA", lat: 46.59999, lng: -120.56212, phone: null, hours: null, notes: "Upscale boutique with some genuine designer vintage.", cat: "antique" },
  { name: "Shopkeeper", address: "3105 Summitview Ave, Yakima, WA", lat: 46.60000, lng: -120.55036, phone: null, hours: null, notes: "Gift shop with antique seasonal decor and glassware.", cat: "antique" },
  { name: "Farmgirl Pickings", address: "2515 Main St, Union Gap, WA 98903", lat: 46.56283, lng: -120.47926, phone: "(509) 225-1477", hours: null, notes: "Curated farmhouse aesthetic shop.", cat: "antique" },
  { name: "Somewhere in Time / That 70s Shop", address: "3911 1st St, Union Gap, WA 98903", lat: 46.54857, lng: -120.47648, phone: "(509) 248-7352", hours: null, notes: "1950s-1980s memorabilia, toys, and kitchenware.", cat: "antique" },
  { name: "Gap Treasures", address: "3711 Main St, Union Gap, WA 98903", lat: 46.56283, lng: -120.47926, phone: "(509) 249-8656", hours: null, notes: "Confirmed antique shop on Main St.", cat: "antique" },
  { name: "Granny's Attic", address: "4215 Main St, Union Gap, WA 98903", lat: 46.56466, lng: -120.48130, phone: "(509) 594-1665", hours: null, notes: "Union Gap antique shop.", cat: "antique" },
  { name: "Precision Fruit & Antiques", address: "140 E Selah Rd, Yakima, WA 98901", lat: 46.64699, lng: -120.50083, phone: "(509) 457-5963", hours: null, notes: "Half fruit stand, half antique barn.", cat: "antique" },
  { name: "Trinket Box Antiques", address: "105 E Naches Ave, Selah, WA 98942", lat: 46.65413, lng: -120.53025, phone: "(509) 823-9192", hours: null, notes: "Curated antique shop on Naches Ave.", cat: "antique" },
  { name: "Country Garden Antiques", address: "6451 Yakima Valley Hwy, Wapato, WA 98951", lat: 46.44763, lng: -120.42034, phone: "(509) 877-4644", hours: null, notes: "English country furniture, porcelain, and garden pieces.", cat: "antique" },
  { name: "Darlenes", address: "2573 Branch Rd, Wapato, WA", lat: 46.44763, lng: -120.42034, phone: null, hours: null, notes: "Project pieces and DIY-friendly antiques.", cat: "antique" },
  { name: "Hidden Treasures Thrift Store", address: "415 W Washington Ave A, Yakima, WA 98903", lat: 46.57050, lng: -120.51028, phone: "(509) 969-8106", hours: null, notes: "Includes estate sale services.", cat: "killer" },
  { name: "Legacy Thrift & Consignment", address: "11 Pence Rd, Yakima, WA 98908", lat: 46.63932, lng: -120.59346, phone: "(509) 795-5732", hours: null, notes: "Thrift and consignment finds.", cat: "killer" },
  { name: "El Mister Deals", address: "2901 W Nob Hill Blvd, Yakima, WA 98902", lat: 46.58531, lng: -120.53592, phone: "(509) 426-9403", hours: null, notes: "Discount and overstock retail.", cat: "killer" },
  { name: "St. Vincent de Paul Thrift", address: "212 S 1st St, Union Gap, WA 98903", lat: 46.55318, lng: -120.47658, phone: null, hours: null, notes: "Well-known charity thrift in Union Gap.", cat: "charity" },
  { name: "St. Vincent Center Thrift", address: "2629 Main St, Union Gap, WA 98903", lat: 46.56466, lng: -120.48130, phone: "(509) 457-5111", hours: null, notes: "Charity thrift and resource center.", cat: "charity" },
  { name: "YUGM Thrift Store (Selah)", address: "111 Pleasant Ave, Selah, WA 98942", lat: 46.64525, lng: -120.53071, phone: "(509) 457-3370", hours: null, notes: "Newest YUGM location in Selah.", cat: "charity" },
  { name: "Mission Thrift (YUGM)", address: "2011 W Lincoln Ave, Yakima, WA 98902", lat: 46.60354, lng: -120.53604, phone: "(509) 317-2544", hours: null, notes: "Yakima Union Gospel Mission thrift.", cat: "charity" },
  { name: "Summit Thrift (YUGM)", address: "5606 Summitview Ave, Yakima, WA 98908", lat: 46.59992, lng: -120.58342, phone: "(509) 248-9207", hours: null, notes: "YUGM Summitview thrift location.", cat: "charity" },
  { name: "Lighthouse Thrift (YUGM Bins)", address: "1606 N 1st St, Yakima, WA 98901", lat: 46.60350, lng: -120.50671, phone: "(509) 424-4888", hours: null, notes: "Bins/outlet style YUGM store.", cat: "charity" },
  { name: "Goodwill Selah", address: "503 S 1st St, Selah, WA 98942", lat: 46.64681, lng: -120.53026, phone: "(509) 698-3560", hours: null, notes: "One of three local Goodwill stores.", cat: "corporate" },
  { name: "Goodwill Yakima", address: "3710 Tieton Dr, Yakima, WA 98902", lat: 46.59263, lng: -120.55874, phone: "(509) 965-7355", hours: null, notes: "Yakima Goodwill retail store.", cat: "corporate" },
  { name: "Goodwill Union Gap", address: "1907 S 1st St, Yakima, WA 98903", lat: 46.56809, lng: -120.48513, phone: "(509) 452-0207", hours: null, notes: "Goodwill Union Gap store.", cat: "corporate" },
  { name: "Bowlby's Gun and Pawn", address: "129 S 3rd St, Yakima, WA 98901", lat: 46.60127, lng: -120.50217, phone: "(509) 248-8280", hours: null, notes: "Pawn shop with antiques.", cat: "specialty" },
  { name: "Churchill Books", address: "10 N 2nd St, Yakima, WA 98901", lat: 46.60272, lng: -120.50488, phone: "(509) 453-6522", hours: null, notes: "Rare, used, and collectible bookstore.", cat: "specialty" },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  // Step 1: Add color column if missing
  try {
    await conn.query('ALTER TABLE shop_categories ADD COLUMN color VARCHAR(7) DEFAULT NULL');
    console.log('Added color column to shop_categories');
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('color column already exists');
    } else {
      throw e;
    }
  }

  // Step 2: Upsert junk run categories
  const catIdMap: Record<string, number> = {};
  for (const cat of JUNK_RUN_CATEGORIES) {
    const [existing] = await conn.query<any[]>(
      'SELECT id FROM shop_categories WHERE slug = ? LIMIT 1',
      [cat.slug]
    );
    if (existing.length > 0) {
      await conn.query(
        'UPDATE shop_categories SET name = ?, color = ?, icon = ?, active = TRUE WHERE id = ?',
        [cat.name, cat.color, cat.icon, existing[0].id]
      );
      catIdMap[cat.slug] = existing[0].id;
      console.log(`Updated category: ${cat.name} (id ${existing[0].id})`);
    } else {
      const [result] = await conn.query<any>(
        'INSERT INTO shop_categories (name, slug, color, icon, active) VALUES (?, ?, ?, ?, TRUE)',
        [cat.name, cat.slug, cat.color, cat.icon]
      );
      catIdMap[cat.slug] = result.insertId;
      console.log(`Created category: ${cat.name} (id ${result.insertId})`);
    }
  }

  // Step 3: Import shops
  let created = 0, updated = 0, skipped = 0;

  for (const shop of JUNK_RUN_SHOPS) {
    const categoryId = catIdMap[shop.cat];
    const normalized = shop.name.toLowerCase().trim().replace(/\s+/g, ' ');

    // Try to find existing shop by normalized name or similar name
    const [existing] = await conn.query<any[]>(
      `SELECT id, name, latitude, longitude FROM local_shops
       WHERE LOWER(TRIM(name)) LIKE ? OR normalized_name = ?
       LIMIT 1`,
      [`%${normalized.substring(0, 20)}%`, normalized]
    );

    // Build description from notes + hours
    const descParts = [];
    if (shop.notes) descParts.push(shop.notes);
    if (shop.hours) descParts.push(`Hours: ${shop.hours}`);
    const description = descParts.join(' ') || null;

    // Build operating_hours JSON if hours text is provided
    const opHours = shop.hours ? JSON.stringify({ description: shop.hours }) : null;

    if (existing.length > 0) {
      // Update coordinates, category, and description if shop exists
      await conn.query(
        `UPDATE local_shops SET
          latitude = ?, longitude = ?, category_id = ?,
          phone = COALESCE(?, phone),
          operating_hours = COALESCE(?, operating_hours),
          description = COALESCE(?, description),
          status = 'active', active = TRUE
        WHERE id = ?`,
        [shop.lat, shop.lng, categoryId, shop.phone, opHours, description, existing[0].id]
      );
      updated++;
      console.log(`  Updated: "${existing[0].name}" (id ${existing[0].id}) → coords ${shop.lat},${shop.lng}`);
    } else {
      // Insert new shop
      const [result] = await conn.query<any>(
        `INSERT INTO local_shops (name, normalized_name, address, latitude, longitude, phone, operating_hours, description, category_id, status, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', TRUE)`,
        [shop.name, normalized, shop.address, shop.lat, shop.lng, shop.phone, opHours, description, categoryId]
      );
      created++;
      console.log(`  Created: "${shop.name}" (id ${result.insertId})`);
    }
  }

  console.log(`\nDone: ${created} created, ${updated} updated, ${skipped} skipped`);
  console.log('Category map:', catIdMap);

  await conn.end();
}

main().catch(console.error);
