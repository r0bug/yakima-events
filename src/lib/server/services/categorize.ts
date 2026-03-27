/**
 * Auto-categorize events using keyword matching.
 * Fast, free, and runs on every new event import.
 * For edge cases, run the LLM batch script: npx tsx scripts/categorize-events.ts
 */
import { db } from '$lib/server/db';
import { eventCategories, eventCategoryMapping } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

// Keyword rules: checked in order, first match wins
const CATEGORY_RULES: { slug: string; keywords: RegExp }[] = [
  // Fundraiser — benefit events, give-back nights, charity
  {
    slug: 'fundraiser',
    keywords: /\b(fundrais|benefit\b|give[\s-]*back|spirit\s*night|percentage\s*night|community\s*night|dine\s*out\s*(?:for|night)|charity|relay\s*for\s*life|cancer\s*walk|als\s*awareness|pancake\s*breakfast|spaghetti\s*dinner|flapjack)\b/i,
  },
  // Killer Pick — estate sales, rummage, yard sales, thrift, antiques
  {
    slug: 'killer-pick',
    keywords: /\b(estate\s*sale|rummage|yard\s*sale|garage\s*sale|barn\s*sale|flea\s*market|swap\s*meet|thrift|antique|vintage\s*(sale|fair|show)|junk|tag\s*sale|moving\s*sale|downsizing|consignment)\b/i,
  },
  // Live Music
  {
    slug: 'live-music',
    keywords: /\b(live\s*music|concert|band|open\s*mic|karaoke|jazz|blues|acoustic|dj\s|symphony|orchestra|choir|recital|jam\s*session|songwriter)\b/i,
  },
  // Sports & Fitness
  {
    slug: 'sports-fitness',
    keywords: /\b(yoga|fitness|workout|run\b|marathon|5k|10k|basketball|baseball|soccer|football|softball|volleyball|tennis|golf|hockey|boxing|mma|wrestling|cycling|swim|triathlon|crossfit|pilates|tai\s*chi|zumba|bootcamp|athletic|gym|hike|hiking)\b/i,
  },
  // Food & Drink
  {
    slug: 'food-drink',
    keywords: /\b(food|dinner|lunch|brunch|breakfast|bbq|barbecue|tasting|wine|beer|brewery|brew\b|distillery|cocktail|happy\s*hour|cook|chef|restaurant|cafe|coffee|pizza|taco|burger|fish\s*fry|potluck|feast|ribeye|coney)\b/i,
  },
  // Markets & Sales
  {
    slug: 'markets-sales',
    keywords: /\b(market|bazaar|craft\s*(fair|show|sale)|vendor|pop[\s-]*up|artisan|handmade|farmers?\s*market|holiday\s*sale|bake\s*sale|plant\s*sale|book\s*sale)\b/i,
  },
  // Family & Kids
  {
    slug: 'family-kids',
    keywords: /\b(kids|children|family|toddler|baby|storytime|story\s*time|youth|teen|easter\s*egg|egg\s*hunt|trick[\s-]or[\s-]treat|santa|bunny|playground|puppet|face\s*paint)\b/i,
  },
  // Arts & Culture
  {
    slug: 'arts-culture',
    keywords: /\b(art|gallery|exhibit|museum|theater|theatre|play\b|musical|dance|ballet|opera|poetry|reading|author|book\s*club|paint|watercolor|sculpture|film|cinema|movie|photography|craft|ceramic|quilt|knit|sew)\b/i,
  },
  // Education
  {
    slug: 'education',
    keywords: /\b(class|workshop|seminar|lecture|training|course|learn|education|school|college|university|library|tutor|certification|webinar|conference|summit|panel|presentation|cpr|first\s*aid)\b/i,
  },
  // Outdoors
  {
    slug: 'outdoors',
    keywords: /\b(outdoor|nature|park|trail|camping|fishing|kayak|canoe|river|mountain|garden|birding|wildlife|stargazing|astronomy|cleanup|conservation)\b/i,
  },
  // Community
  {
    slug: 'community',
    keywords: /\b(community|volunteer|fundrais|charity|benefit|auction|gala|ribbon\s*cutting|town\s*hall|city\s*council|meeting|church|worship|service|memorial|veteran|rotary|kiwanis|lions\s*club|chamber|nonprofit|donation|drive\b)\b/i,
  },
  // Nightlife
  {
    slug: 'nightlife',
    keywords: /\b(night|bar\b|club\b|lounge|salsa|latin\s*night|trivia|bingo|comedy|stand[\s-]*up|drag|burlesque|after[\s-]*dark|pub\b|tap\s*room)\b/i,
  },
  // Holiday
  {
    slug: 'holiday',
    keywords: /\b(christmas|easter|thanksgiving|halloween|valentine|new\s*year|4th\s*of\s*july|fourth\s*of\s*july|independence\s*day|memorial\s*day|labor\s*day|mother'?s?\s*day|father'?s?\s*day|st\.?\s*patrick|mardi\s*gras|cinco\s*de\s*mayo|holiday|good\s*friday|maundy|palm\s*sunday|lent)\b/i,
  },
];

let categoryCache: Map<string, number> | null = null;

async function getCategoryMap(): Promise<Map<string, number>> {
  if (categoryCache) return categoryCache;

  const cats = await db
    .select({ id: eventCategories.id, slug: eventCategories.slug })
    .from(eventCategories)
    .where(eq(eventCategories.active, true));

  categoryCache = new Map(cats.map(c => [c.slug, c.id]));
  return categoryCache;
}

/**
 * Categorize a single event by title + location keywords.
 * Returns the category slug or 'other' as fallback.
 */
export function matchCategory(title: string, location?: string): string {
  const text = `${title} ${location || ''}`;

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.test(text)) {
      return rule.slug;
    }
  }

  return 'other';
}

/**
 * Auto-categorize an event and save the mapping to DB.
 * Skips if event already has a category.
 */
export async function categorizeEvent(eventId: number, title: string, location?: string): Promise<void> {
  // Check if already categorized
  const existing = await db
    .select({ eventId: eventCategoryMapping.eventId })
    .from(eventCategoryMapping)
    .where(eq(eventCategoryMapping.eventId, eventId))
    .limit(1);

  if (existing.length > 0) return;

  const catMap = await getCategoryMap();
  const slug = matchCategory(title, location);
  const categoryId = catMap.get(slug) || catMap.get('other');

  if (categoryId) {
    await db.insert(eventCategoryMapping).values({ eventId, categoryId }).onDuplicateKeyUpdate({ set: { categoryId } });
  }
}

/**
 * Batch categorize multiple events.
 */
export async function categorizeEvents(events: { id: number; title: string; location?: string }[]): Promise<number> {
  const catMap = await getCategoryMap();
  let count = 0;

  // Check which are already categorized
  const eventIds = events.map(e => e.id);
  const existing = await db
    .select({ eventId: eventCategoryMapping.eventId })
    .from(eventCategoryMapping)
    .where(inArray(eventCategoryMapping.eventId, eventIds));

  const existingSet = new Set(existing.map(e => e.eventId));

  for (const event of events) {
    if (existingSet.has(event.id)) continue;

    const slug = matchCategory(event.title, event.location);
    const categoryId = catMap.get(slug) || catMap.get('other');

    if (categoryId) {
      await db.insert(eventCategoryMapping).values({ eventId: event.id, categoryId }).onDuplicateKeyUpdate({ set: { categoryId } });
      count++;
    }
  }

  return count;
}
