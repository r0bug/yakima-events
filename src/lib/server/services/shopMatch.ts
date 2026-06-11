/**
 * Auto-match events to local shops based on venue/location text.
 * Runs on every new event import alongside auto-categorization.
 */
import { db } from '$lib/server/db';
import { localShops, eventShopParticipants } from '$lib/server/db/schema';
import { eq, and, or } from 'drizzle-orm';

interface ShopEntry {
  id: number;
  name: string;
  address: string;
}

// Known aliases: alternative names that map to shop IDs
// "alias" → shop name (matched by shop name in DB)
const SHOP_ALIASES: Record<string, string> = {
  // Venue nicknames
  'tin shed': 'Flippers Antiques',
  'flippers': 'Flippers Antiques',
  'the seasons': 'The Seasons Performance Hall',
  'seasons performance hall': 'The Seasons Performance Hall',
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
  'churchill\'s': 'Churchill\'s Booklover\'s Haunt',
  'churchills': 'Churchill\'s Booklover\'s Haunt',
  'gilbert cellars': 'Gilbert Cellars',
  'kana winery': 'Kana Winery',
  'yakima arboretum': 'Yakima Area Arboretum',
  'the arboretum': 'Yakima Area Arboretum',
  'maker space': 'Yakima Maker Space',
  'yakima maker space': 'Yakima Maker Space',
  'creative yakima': 'Creative Yakima',
  'mak daddy': 'Mak Daddy Coffee',
  'mak daddy coffee': 'Mak Daddy Coffee',
  'second street grill': 'Second Street Grill',
  'essencia': 'Essencia Artisan Bakery',
  'essencia bakery': 'Essencia Artisan Bakery',
  'mel\'s diner': 'Mel\'s Diner',
  'mels diner': 'Mel\'s Diner',
};

let shopCache: ShopEntry[] | null = null;
let shopByName: Map<string, number> | null = null;

async function loadShops(): Promise<void> {
  if (shopCache) return;

  const rows = await db
    .select({ id: localShops.id, name: localShops.name, address: localShops.address })
    .from(localShops)
    .where(or(eq(localShops.active, true), eq(localShops.isVenuePlaceholder, true)));

  shopCache = rows.map(r => ({ id: r.id, name: r.name, address: r.address ?? '' }));
  shopByName = new Map(shopCache.map(s => [s.name.toLowerCase(), s.id]));
}

/**
 * Find a matching shop for an event based on its location/title text.
 * Returns the shop ID or null.
 */
export async function findMatchingShop(title: string, location?: string): Promise<number | null> {
  await loadShops();
  if (!shopCache || !shopByName) return null;

  const locationLower = (location || '').toLowerCase().trim();
  const titleLower = title.toLowerCase().trim();
  const combined = `${titleLower} ${locationLower}`;

  // 1. Check aliases first (highest priority, handles nicknames like "Tin Shed")
  for (const [alias, shopName] of Object.entries(SHOP_ALIASES)) {
    if (locationLower.includes(alias) || titleLower.includes(alias)) {
      const shopId = shopByName.get(shopName.toLowerCase());
      if (shopId) return shopId;
    }
  }

  // 2. Direct shop name match in location or title text
  //    Require the match to be preceded by whitespace/start (not a hyphen) to avoid
  //    "Well-Crafted" matching the shop "Crafted"
  for (const shop of shopCache!) {
    const shopLower = shop.name.toLowerCase();
    if (shopLower.length < 4) continue;
    const escaped = shopLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\s|,)${escaped}(?:\\s|,|$)`, 'i');
    if (re.test(locationLower) || re.test(titleLower)) {
      return shop.id;
    }
  }

  // 3. Address match — if event location contains the shop's street address
  for (const shop of shopCache!) {
    if (!shop.address) continue;
    // Extract the street number + street name, require word boundary on the number
    const addrMatch = shop.address.match(/^(\d+\s+\S+\s+\S+)/);
    if (addrMatch) {
      const streetPart = addrMatch[1].toLowerCase();
      const escaped = streetPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^|\\s)${escaped}`, 'i');
      if (re.test(locationLower)) {
        return shop.id;
      }
    }
  }

  return null;
}

/**
 * Address/coordinates for a shop, used to backfill events held there.
 */
export async function getShopVenueDetails(
  shopId: number
): Promise<{ address: string | null; latitude: string | null; longitude: string | null } | null> {
  const rows = await db
    .select({
      address: localShops.address,
      latitude: localShops.latitude,
      longitude: localShops.longitude,
    })
    .from(localShops)
    .where(eq(localShops.id, shopId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Link an event to a shop as venue. Skips if already linked.
 */
export async function linkEventToShop(eventId: number, shopId: number): Promise<boolean> {
  // Check if already linked
  const existing = await db
    .select({ id: eventShopParticipants.id })
    .from(eventShopParticipants)
    .where(and(
      eq(eventShopParticipants.eventId, eventId),
      eq(eventShopParticipants.shopId, shopId)
    ))
    .limit(1);

  if (existing.length > 0) return false;

  await db.insert(eventShopParticipants).values({
    eventId,
    shopId,
    approvalStatus: 'approved',
    participationRole: 'venue',
  });

  return true;
}

/**
 * Auto-match an event to a shop and create the link.
 * Called from processEvent() after insert.
 */
export async function matchAndLinkEvent(eventId: number, title: string, location?: string): Promise<void> {
  const shopId = await findMatchingShop(title, location);
  if (shopId) {
    await linkEventToShop(eventId, shopId);
  }
}

/**
 * Clear the shop cache (call when shops are updated).
 */
export function clearShopCache(): void {
  shopCache = null;
  shopByName = null;
}
