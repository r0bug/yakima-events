import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeAllSources, scrapeSourceById, getScrapingStats } from '$server/scrapers/scraper';
import { requireScraperAuth } from '$lib/server/auth/scraper-guard';

/**
 * GET /api/scrape
 * Get scraping statistics
 */
export const GET: RequestHandler = async () => {
  try {
    const stats = await getScrapingStats();

    return json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching scraping stats:', error);
    return json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/scrape
 * Trigger scraping of all active sources or a specific source.
 * Requires an admin session or the scraper secret (see scraper-guard.ts).
 */
export const POST: RequestHandler = async (event) => {
  // Admin session, or `Authorization: Bearer $SCRAPER_SECRET` (the cron job)
  const auth = requireScraperAuth(event);
  if (!auth.ok) return auth.response;

  try {
    const data = (await event.request.json().catch(() => ({}))) || {};
    const sourceId = data.source_id;

    let results;

    if (sourceId !== undefined && sourceId !== null && sourceId !== '') {
      const id = Number(sourceId);
      if (!Number.isInteger(id) || id <= 0) {
        return json({ success: false, error: 'Invalid source_id' }, { status: 400 });
      }
      // Scrape a single source
      const result = await scrapeSourceById(id);
      results = [result];
    } else {
      // Scrape all active sources
      results = await scrapeAllSources();
    }

    // Calculate summary
    const summary = {
      totalSources: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalEventsFound: results.reduce((sum, r) => sum + r.eventsFound, 0),
      totalEventsAdded: results.reduce((sum, r) => sum + r.eventsAdded, 0),
      totalDuplicatesSkipped: results.reduce((sum, r) => sum + r.duplicatesSkipped, 0),
      totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    };

    return json({
      success: true,
      summary,
      results,
    });
  } catch (error) {
    console.error('Error running scraper:', error);
    return json(
      { success: false, error: 'Failed to run scraper' },
      { status: 500 }
    );
  }
};
