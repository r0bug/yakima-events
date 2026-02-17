import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import type { ScrapedEvent } from '$lib/server/scrapers/types';
import { processEvent } from '$lib/server/scrapers/scraper';
import { db, calendarSources } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

const browserEventSchema = z.object({
  eventId: z.string().min(1),
  url: z.string().url(),
  title: z.string().optional(),
  dateText: z.string().optional(),
  location: z.string().optional(),
  imageUrl: z.string().optional(),
});

const importSchema = z.object({
  events: z.array(browserEventSchema).min(1).max(200),
});

/**
 * Parse date text from Facebook's various formats into a Date.
 * Falls back to current date if unparseable.
 */
function parseDateText(text: string | undefined): Date {
  if (!text) return new Date();

  const trimmed = text.trim();

  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  // "Today" / "Tomorrow"
  const now = new Date();
  if (/^today/i.test(trimmed)) {
    return now;
  }
  if (/^tomorrow/i.test(trimmed)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // Try to extract time from patterns like "at 7 PM", "at 7:30 PM"
  let hours = 0;
  let minutes = 0;
  const timeMatch = trimmed.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const isPM = timeMatch[3].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
  }

  // "Day, Month DD" or "Month DD" patterns
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const dateMatch = trimmed.match(
    /(?:(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i
  );
  if (dateMatch) {
    const month = months[dateMatch[1].toLowerCase().slice(0, 3)];
    const day = parseInt(dateMatch[2], 10);
    const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
    if (month !== undefined) {
      const d = new Date(year, month, day, hours, minutes);
      // If date is in the past without explicit year, try next year
      if (!dateMatch[3] && d < now) {
        d.setFullYear(d.getFullYear() + 1);
      }
      return d;
    }
  }

  // Generic Date.parse fallback
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback;

  // Unparseable — use current date as placeholder
  return new Date();
}

/**
 * Find or create the "Facebook Browser Import" calendar source
 */
async function getOrCreateBrowserSource(): Promise<number> {
  const name = 'Facebook Browser Import';

  const existing = await db
    .select({ id: calendarSources.id })
    .from(calendarSources)
    .where(and(eq(calendarSources.name, name), eq(calendarSources.scrapeType, 'facebook')))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const result = await db.insert(calendarSources).values({
    name,
    url: 'https://www.facebook.com/events/',
    scrapeType: 'facebook',
    active: false, // Not auto-scraped
  });

  return Number(result[0].insertId);
}

/**
 * POST /api/scraper/facebook-browser
 * Import events extracted by the browser bookmarklet
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const sourceId = await getOrCreateBrowserSource();
    const results: Array<{
      eventId: string;
      title: string;
      status: 'added' | 'duplicate' | 'invalid';
      error?: string;
    }> = [];

    let added = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const ev of parsed.data.events) {
      try {
        const startDatetime = parseDateText(ev.dateText);
        const scrapedEvent: ScrapedEvent = {
          title: ev.title || `Facebook Event ${ev.eventId}`,
          startDatetime,
          location: ev.location || undefined,
          externalUrl: ev.url,
          externalEventId: `fb_${ev.eventId}`,
        };

        const result = await processEvent(scrapedEvent, sourceId);
        results.push({
          eventId: ev.eventId,
          title: scrapedEvent.title,
          status: result,
        });

        if (result === 'added') added++;
        else if (result === 'duplicate') duplicates++;
        else invalid++;
      } catch (err) {
        invalid++;
        results.push({
          eventId: ev.eventId,
          title: ev.title || ev.eventId,
          status: 'invalid',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return json({
      success: true,
      summary: { total: parsed.data.events.length, added, duplicates, invalid },
      results,
    });
  } catch (error) {
    console.error('[API] Facebook browser import error:', error);
    return json(
      {
        error: 'Failed to import events',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};
