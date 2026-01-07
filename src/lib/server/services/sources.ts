/**
 * Calendar Sources Service
 * Manages event scraping sources (iCal, HTML, JSON, RSS feeds)
 */

import { db, calendarSources } from '$server/db';
import { eq, desc, asc, sql } from 'drizzle-orm';
import type { CalendarSource } from '$server/db/schema';

export interface SourceWithStats extends CalendarSource {
  eventCount?: number;
  lastScrapeStatus?: string;
}

/**
 * Get all calendar sources with stats
 */
export async function getSources(activeOnly = false): Promise<SourceWithStats[]> {
  const result = await db.execute(sql`
    SELECT
      cs.*,
      COUNT(DISTINCT e.id) as event_count
    FROM calendar_sources cs
    LEFT JOIN events e ON cs.id = e.source_id
    ${activeOnly ? sql`WHERE cs.active = 1` : sql``}
    GROUP BY cs.id
    ORDER BY cs.name ASC
  `);

  return (result[0] as any[]).map((row) => ({
    ...row,
    eventCount: Number(row.event_count) || 0,
    configuration: typeof row.configuration === 'string'
      ? JSON.parse(row.configuration)
      : row.configuration,
  }));
}

/**
 * Get source by ID
 */
export async function getSourceById(id: number): Promise<CalendarSource | null> {
  const result = await db
    .select()
    .from(calendarSources)
    .where(eq(calendarSources.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Create a new source
 */
export async function createSource(data: {
  name: string;
  url: string;
  type: 'ical' | 'html' | 'json' | 'rss';
  configuration?: Record<string, unknown>;
  active?: boolean;
  scrapeFrequency?: number;
}): Promise<number> {
  const result = await db.insert(calendarSources).values({
    name: data.name,
    url: data.url,
    type: data.type,
    configuration: data.configuration || null,
    active: data.active ?? true,
    scrapeFrequency: data.scrapeFrequency || 3600,
  });

  return Number(result[0].insertId);
}

/**
 * Update a source
 */
export async function updateSource(
  id: number,
  data: Partial<{
    name: string;
    url: string;
    type: 'ical' | 'html' | 'json' | 'rss';
    configuration: Record<string, unknown>;
    active: boolean;
    scrapeFrequency: number;
  }>
): Promise<boolean> {
  const result = await db
    .update(calendarSources)
    .set(data)
    .where(eq(calendarSources.id, id));

  return result[0].affectedRows > 0;
}

/**
 * Delete a source
 */
export async function deleteSource(id: number): Promise<boolean> {
  // Set events from this source to have no source (preserve events)
  await db.execute(sql`
    UPDATE events SET source_id = NULL WHERE source_id = ${id}
  `);

  const result = await db
    .delete(calendarSources)
    .where(eq(calendarSources.id, id));

  return result[0].affectedRows > 0;
}

/**
 * Toggle source active status
 */
export async function toggleSourceActive(id: number): Promise<boolean> {
  const source = await getSourceById(id);
  if (!source) return false;

  return updateSource(id, { active: !source.active });
}

/**
 * Test a source URL
 */
export async function testSource(id: number): Promise<{
  success: boolean;
  message: string;
  eventCount?: number;
}> {
  const source = await getSourceById(id);
  if (!source) {
    return { success: false, message: 'Source not found' };
  }

  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 YakimaEvents/1.0',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const content = await response.text();

    // Validate based on type
    switch (source.type) {
      case 'ical':
        if (!content.includes('BEGIN:VCALENDAR')) {
          return { success: false, message: 'Invalid iCal format' };
        }
        const icalCount = (content.match(/BEGIN:VEVENT/g) || []).length;
        return {
          success: true,
          message: `Valid iCal feed`,
          eventCount: icalCount,
        };

      case 'json':
        try {
          JSON.parse(content);
          return { success: true, message: 'Valid JSON response' };
        } catch {
          return { success: false, message: 'Invalid JSON format' };
        }

      case 'html':
        if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
          return { success: false, message: 'Invalid HTML format' };
        }
        return { success: true, message: 'Valid HTML page' };

      case 'rss':
        if (!content.includes('<rss') && !content.includes('<feed')) {
          return { success: false, message: 'Invalid RSS/Atom format' };
        }
        return { success: true, message: 'Valid RSS/Atom feed' };

      default:
        return { success: false, message: 'Unknown source type' };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get source type options
 */
export function getSourceTypes() {
  return [
    { value: 'ical', label: 'iCal/ICS Calendar', description: 'Standard calendar format' },
    { value: 'html', label: 'HTML Page', description: 'Scrape events from web pages' },
    { value: 'json', label: 'JSON API', description: 'REST API returning JSON' },
    { value: 'rss', label: 'RSS/Atom Feed', description: 'RSS or Atom news feed' },
  ];
}
