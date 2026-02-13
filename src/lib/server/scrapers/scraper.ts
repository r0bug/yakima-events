/**
 * Event Scraper Service
 * Main scraping orchestrator that fetches and processes events from various sources
 */

import { db, calendarSources, events, scrapingLogs } from '$server/db';
import { eq, and, sql } from 'drizzle-orm';
import type { CalendarSource, ScrapedEvent, ScrapeResult, ScrapeConfig, ScrapeType } from './types';
import { parseICalContent } from './parsers/ical';
import { parseHtmlContent } from './parsers/html';
import { parseJsonContent } from './parsers/json';
import { parseRssContent } from './parsers/rss';
import { parseYakimaValleyContent } from './parsers/yakima-valley';
import * as intelligentScraper from './intelligent';
import * as firecrawlService from '$server/services/firecrawl';
import * as facebookService from '$server/services/facebook';
import * as eventbriteService from '$server/services/eventbrite';
import { geocodeYakimaArea } from '$server/services/geocode';
import { notifyScraperError } from '$server/services/email';

/**
 * Scrape all active sources
 */
export async function scrapeAllSources(): Promise<ScrapeResult[]> {
  const sources = await getActiveSources();
  const results: ScrapeResult[] = [];

  console.log(`[Scraper] Starting scrape of ${sources.length} active sources`);

  for (const source of sources) {
    const result = await scrapeSource(source);
    results.push(result);

    // Notify on failure
    if (!result.success && result.error) {
      await notifyScraperError({
        sourceName: source.name,
        sourceId: source.id,
        error: result.error,
        timestamp: new Date(),
      });
    }
  }

  return results;
}

/**
 * Scrape a single source by ID
 */
export async function scrapeSourceById(sourceId: number): Promise<ScrapeResult> {
  const source = await getSourceById(sourceId);
  if (!source) {
    return {
      success: false,
      sourceId,
      sourceName: 'Unknown',
      eventsFound: 0,
      eventsAdded: 0,
      duplicatesSkipped: 0,
      error: 'Source not found',
      durationMs: 0,
    };
  }

  return scrapeSource(source);
}

/**
 * Scrape a single source
 */
export async function scrapeSource(source: CalendarSource): Promise<ScrapeResult> {
  const startTime = Date.now();
  console.log(`[Scraper] Starting scrape for source: ${source.name} (${source.scrapeType})`);

  // Log scrape start
  const logId = await logScrapingStart(source.id);

  let eventsFound = 0;
  let eventsAdded = 0;
  let duplicatesSkipped = 0;

  try {
    let scrapedEvents: ScrapedEvent[] = [];

    // Handle different scraper types
    switch (source.scrapeType) {
      case 'ical':
        scrapedEvents = await scrapeIcal(source);
        break;

      case 'html':
        scrapedEvents = await scrapeHtml(source);
        break;

      case 'json':
        scrapedEvents = await scrapeJson(source);
        break;

      case 'rss':
        scrapedEvents = await scrapeRss(source);
        break;

      case 'yakima_valley':
        scrapedEvents = await scrapeYakimaValley(source);
        break;

      case 'intelligent':
        scrapedEvents = await scrapeIntelligent(source);
        break;

      case 'firecrawl':
        scrapedEvents = await scrapeFirecrawl(source);
        break;

      case 'eventbrite':
        scrapedEvents = await scrapeEventbriteSource(source);
        break;

      case 'facebook':
        scrapedEvents = await scrapeFacebook(source);
        break;

      default:
        throw new Error(`Unsupported scrape type: ${source.scrapeType}`);
    }

    eventsFound = scrapedEvents.length;
    console.log(`[Scraper] Found ${eventsFound} events from ${source.name}`);

    // Process and save each event
    for (const eventData of scrapedEvents) {
      const result = await processEvent(eventData, source.id);
      if (result === 'added') {
        eventsAdded++;
      } else if (result === 'duplicate') {
        duplicatesSkipped++;
      }
    }

    // Update last scraped time
    await updateLastScraped(source.id);

    const durationMs = Date.now() - startTime;
    console.log(
      `[Scraper] Completed ${source.name}: ${eventsAdded} added, ${duplicatesSkipped} duplicates, ${durationMs}ms`
    );

    // Log success
    await logScrapingComplete(logId, eventsFound, eventsAdded, duplicatesSkipped, 'success', durationMs);

    return {
      success: true,
      sourceId: source.id,
      sourceName: source.name,
      eventsFound,
      eventsAdded,
      duplicatesSkipped,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scraper] Error scraping ${source.name}:`, errorMessage);

    // Log failure
    await logScrapingComplete(logId, eventsFound, eventsAdded, duplicatesSkipped, 'failed', durationMs, errorMessage);

    return {
      success: false,
      sourceId: source.id,
      sourceName: source.name,
      eventsFound,
      eventsAdded,
      duplicatesSkipped,
      error: errorMessage,
      durationMs,
    };
  }
}

/**
 * Scrape iCal source
 */
async function scrapeIcal(source: CalendarSource): Promise<ScrapedEvent[]> {
  const content = await fetchContent(source.url);
  if (!content) {
    throw new Error('Failed to fetch iCal content');
  }
  return parseICalContent(content);
}

/**
 * Scrape HTML source
 */
async function scrapeHtml(source: CalendarSource): Promise<ScrapedEvent[]> {
  const content = await fetchContent(source.url);
  if (!content) {
    throw new Error('Failed to fetch HTML content');
  }
  const config = source.scrapeConfig || {};
  return parseHtmlContent(content, config, source.url);
}

/**
 * Scrape JSON source
 */
async function scrapeJson(source: CalendarSource): Promise<ScrapedEvent[]> {
  const content = await fetchContent(source.url);
  if (!content) {
    throw new Error('Failed to fetch JSON content');
  }
  const jsonData = JSON.parse(content);
  const config = source.scrapeConfig || {};
  return parseJsonContent(jsonData, config);
}

/**
 * Scrape RSS source
 */
async function scrapeRss(source: CalendarSource): Promise<ScrapedEvent[]> {
  const content = await fetchContent(source.url);
  if (!content) {
    throw new Error('Failed to fetch RSS content');
  }
  return parseRssContent(content);
}

/**
 * Scrape Yakima Valley source
 */
async function scrapeYakimaValley(source: CalendarSource): Promise<ScrapedEvent[]> {
  const content = await fetchContent(source.url);
  if (!content) {
    throw new Error('Failed to fetch Yakima Valley content');
  }
  const config = source.scrapeConfig || {};
  return parseYakimaValleyContent(content, config, source.url);
}

/**
 * Scrape using intelligent (LLM) scraper
 */
async function scrapeIntelligent(source: CalendarSource): Promise<ScrapedEvent[]> {
  if (!intelligentScraper.isAvailable()) {
    throw new Error('Intelligent scraper not available (API key not configured)');
  }

  const result = await intelligentScraper.analyzeUrl(source.url);

  if (!result.success) {
    throw new Error(result.error || 'Intelligent scraper failed');
  }

  return result.events || [];
}

/**
 * Scrape using Firecrawl
 */
async function scrapeFirecrawl(source: CalendarSource): Promise<ScrapedEvent[]> {
  if (!firecrawlService.isAvailable()) {
    // Fallback to HTML scraping
    console.warn('[Scraper] Firecrawl not available, falling back to HTML');
    return scrapeHtml(source);
  }

  const config = source.scrapeConfig || {};
  const method = config.firecrawlMethod || 'structured';

  let response;

  switch (method) {
    case 'structured':
      const schema = firecrawlService.getEventExtractionSchema();
      response = await firecrawlService.extract(source.url, schema);
      break;

    case 'search':
      const query = config.searchQuery || `events site:${new URL(source.url).hostname}`;
      response = await firecrawlService.search(query, { limit: 20 });
      break;

    case 'basic':
    default:
      response = await firecrawlService.scrape(source.url);
      break;
  }

  if (!response) {
    // Fallback
    const fallbackType = config.fallbackType || 'html';
    if (fallbackType === 'html') {
      return scrapeHtml(source);
    } else if (fallbackType === 'yakima_valley') {
      return scrapeYakimaValley(source);
    }
    throw new Error('Firecrawl scrape failed and no fallback available');
  }

  const events = firecrawlService.parseEventsFromResponse(response, source.url);

  // Convert to ScrapedEvent format
  return events.map((e) => ({
    title: e.title,
    description: e.description,
    startDatetime: e.startDatetime ? new Date(e.startDatetime) : new Date(),
    endDatetime: e.endDatetime ? new Date(e.endDatetime) : undefined,
    location: e.location,
    address: e.address,
    externalUrl: e.externalUrl,
  }));
}

/**
 * Scrape Facebook page events
 */
async function scrapeFacebook(source: CalendarSource): Promise<ScrapedEvent[]> {
  if (!facebookService.isAvailable()) {
    throw new Error('Facebook scraper not available (RAPIDAPI_KEY not configured)');
  }

  const config = source.scrapeConfig || {};
  const facebookConfig = {
    pageId: config.facebookPageId as string | undefined,
    includePastEvents: config.includePastEvents as boolean | undefined,
    maxEvents: config.maxEvents as number | undefined,
  };

  return facebookService.scrapePageEvents(source.url, facebookConfig);
}

/**
 * Scrape Eventbrite events (search or single event)
 */
async function scrapeEventbriteSource(source: CalendarSource): Promise<ScrapedEvent[]> {
  if (!eventbriteService.isAvailable()) {
    throw new Error('Eventbrite scraper not available (RAPIDAPI_KEY not configured)');
  }

  const config = source.scrapeConfig || {};
  const maxPages = (config.maxPages as number) || 3;

  if (eventbriteService.isSearchUrl(source.url)) {
    return eventbriteService.scrapeSearchResults(source.url, maxPages);
  }

  const event = await eventbriteService.scrapeEvent(source.url);
  return event ? [event] : [];
}

/**
 * Process and save a scraped event
 */
async function processEvent(
  eventData: ScrapedEvent,
  sourceId: number
): Promise<'added' | 'duplicate' | 'invalid'> {
  // Validate required fields
  if (!eventData.title || !eventData.startDatetime) {
    return 'invalid';
  }

  // Check for duplicates (same title and start time)
  const duplicate = await findDuplicate(
    eventData.title,
    eventData.startDatetime,
    eventData.externalEventId
  );

  if (duplicate) {
    return 'duplicate';
  }

  // Geocode address if needed and not already geocoded
  if ((eventData.location || eventData.address) && !eventData.latitude) {
    const coords = await geocodeYakimaArea(eventData.address || eventData.location || '');
    if (coords) {
      eventData.latitude = coords.lat;
      eventData.longitude = coords.lng;
    }
  }

  // Insert new event
  try {
    await db.insert(events).values({
      title: eventData.title,
      description: eventData.description || null,
      startDatetime: eventData.startDatetime,
      endDatetime: eventData.endDatetime || null,
      location: eventData.location || null,
      address: eventData.address || null,
      latitude: eventData.latitude ? String(eventData.latitude) : null,
      longitude: eventData.longitude ? String(eventData.longitude) : null,
      contactInfo: eventData.contactInfo ? JSON.stringify(eventData.contactInfo) : null,
      externalUrl: eventData.externalUrl || null,
      externalEventId: eventData.externalEventId || null,
      sourceId,
      status: 'pending', // Scraped events require approval
    });

    return 'added';
  } catch (error) {
    console.error('[Scraper] Error inserting event:', error);
    return 'invalid';
  }
}

/**
 * Find duplicate event
 */
async function findDuplicate(
  title: string,
  startDatetime: Date,
  externalEventId?: string
): Promise<boolean> {
  // Check by external event ID first
  if (externalEventId) {
    const byExternalId = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.externalEventId, externalEventId))
      .limit(1);

    if (byExternalId.length > 0) {
      return true;
    }
  }

  // Check by title and start time
  const byTitleTime = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.title, title),
        eq(events.startDatetime, startDatetime)
      )
    )
    .limit(1);

  return byTitleTime.length > 0;
}

/**
 * Fetch content from URL
 */
async function fetchContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(`[Scraper] HTTP ${response.status} for ${url}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`[Scraper] Fetch error for ${url}:`, error);
    return null;
  }
}

/**
 * Get all active sources
 */
async function getActiveSources(): Promise<CalendarSource[]> {
  const sources = await db
    .select()
    .from(calendarSources)
    .where(eq(calendarSources.active, true));

  return sources.map(mapSourceRow);
}

/**
 * Get source by ID
 */
async function getSourceById(id: number): Promise<CalendarSource | null> {
  const result = await db
    .select()
    .from(calendarSources)
    .where(eq(calendarSources.id, id))
    .limit(1);

  if (result.length === 0) return null;
  return mapSourceRow(result[0]);
}

/**
 * Update last scraped time for a source
 */
async function updateLastScraped(sourceId: number): Promise<void> {
  await db
    .update(calendarSources)
    .set({ lastScraped: new Date() })
    .where(eq(calendarSources.id, sourceId));
}

/**
 * Map database row to CalendarSource type
 */
function mapSourceRow(row: typeof calendarSources.$inferSelect): CalendarSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    scrapeType: row.scrapeType as ScrapeType,
    scrapeConfig: row.scrapeConfig as ScrapeConfig | null,
    intelligentMethodId: row.intelligentMethodId,
    active: row.active ?? true,
    lastScraped: row.lastScraped,
    createdBy: row.createdBy,
  };
}

/**
 * Log scraping start
 */
async function logScrapingStart(sourceId: number): Promise<number> {
  const result = await db.insert(scrapingLogs).values({
    sourceId,
    status: 'running',
    eventsFound: 0,
    eventsAdded: 0,
    duplicatesSkipped: 0,
  });

  return Number(result[0].insertId);
}

/**
 * Log scraping completion
 */
async function logScrapingComplete(
  logId: number,
  eventsFound: number,
  eventsAdded: number,
  duplicatesSkipped: number,
  status: 'success' | 'failed',
  durationMs: number,
  errorMessage?: string
): Promise<void> {
  await db
    .update(scrapingLogs)
    .set({
      status,
      eventsFound,
      eventsAdded,
      duplicatesSkipped,
      durationMs,
      errorMessage: errorMessage || null,
      endTime: new Date(),
    })
    .where(eq(scrapingLogs.id, logId));
}

/**
 * Get scraping summary statistics
 */
export async function getScrapingStats(): Promise<{
  totalSources: number;
  activeSources: number;
  totalEvents: number;
  pendingEvents: number;
  approvedEvents: number;
}> {
  const sourcesResult = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active
    FROM calendar_sources
  `);

  const eventsResult = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
    FROM events
  `);

  const sources = (sourcesResult[0] as Record<string, unknown>[])[0] || { total: 0, active: 0 };
  const eventStats = (eventsResult[0] as Record<string, unknown>[])[0] || { total: 0, pending: 0, approved: 0 };

  return {
    totalSources: Number(sources.total) || 0,
    activeSources: Number(sources.active) || 0,
    totalEvents: Number(eventStats.total) || 0,
    pendingEvents: Number(eventStats.pending) || 0,
    approvedEvents: Number(eventStats.approved) || 0,
  };
}

/**
 * Get recent scraping logs
 */
export async function getRecentLogs(limit: number = 50): Promise<Array<{
  id: number;
  sourceId: number;
  sourceName?: string;
  status: string;
  eventsFound: number;
  eventsAdded: number;
  durationMs?: number;
  errorMessage?: string;
  startTime: Date;
}>> {
  const results = await db.execute(sql`
    SELECT
      sl.id,
      sl.source_id,
      cs.name as source_name,
      sl.status,
      sl.events_found,
      sl.events_added,
      sl.duration_ms,
      sl.error_message,
      sl.start_time
    FROM scraping_logs sl
    LEFT JOIN calendar_sources cs ON sl.source_id = cs.id
    ORDER BY sl.start_time DESC
    LIMIT ${limit}
  `);

  return (results[0] as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    sourceId: Number(row.source_id),
    sourceName: row.source_name as string | undefined,
    status: row.status as string,
    eventsFound: Number(row.events_found) || 0,
    eventsAdded: Number(row.events_added) || 0,
    durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
    errorMessage: row.error_message as string | undefined,
    startTime: new Date(row.start_time as string),
  }));
}
