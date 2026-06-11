/**
 * Auto-categorize events using keyword matching.
 * Fast, free, and runs on every new event import.
 * For edge cases, run the LLM batch script: npx tsx scripts/categorize-events.ts
 */
import { db } from '$lib/server/db';
import { eventCategories, eventCategoryMapping } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

import { matchCategory } from './categorize-rules';

export { matchCategory, CATEGORY_RULES } from './categorize-rules';

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
 * Auto-categorize an event and save the mapping to DB.
 * Skips if event already has a category.
 */
export async function categorizeEvent(eventId: number, title: string, location?: string, description?: string): Promise<void> {
  // Check if already categorized
  const existing = await db
    .select({ eventId: eventCategoryMapping.eventId })
    .from(eventCategoryMapping)
    .where(eq(eventCategoryMapping.eventId, eventId))
    .limit(1);

  if (existing.length > 0) return;

  const catMap = await getCategoryMap();
  const slug = matchCategory(title, location, description);
  const categoryId = catMap.get(slug) || catMap.get('other');

  if (categoryId) {
    await db.insert(eventCategoryMapping).values({ eventId, categoryId }).onDuplicateKeyUpdate({ set: { categoryId } });
  }
}

/**
 * Manually set an event's category, replacing any existing mappings.
 * Used by the admin UI to fix miscategorized events.
 */
export async function setEventCategory(eventId: number, categoryId: number): Promise<void> {
  await db.delete(eventCategoryMapping).where(eq(eventCategoryMapping.eventId, eventId));
  await db.insert(eventCategoryMapping).values({ eventId, categoryId });
}

/**
 * Batch categorize multiple events.
 */
export async function categorizeEvents(events: { id: number; title: string; location?: string; description?: string }[]): Promise<number> {
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

    const slug = matchCategory(event.title, event.location, event.description);
    const categoryId = catMap.get(slug) || catMap.get('other');

    if (categoryId) {
      await db.insert(eventCategoryMapping).values({ eventId: event.id, categoryId }).onDuplicateKeyUpdate({ set: { categoryId } });
      count++;
    }
  }

  return count;
}
