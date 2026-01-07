import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeAllSources, scrapeSourceById, getScrapingStats } from '$server/scrapers/scraper';

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
 * Trigger scraping of all active sources or a specific source
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json().catch(() => ({}));
    const sourceId = data.source_id;

    let results;

    if (sourceId) {
      // Scrape a single source
      const result = await scrapeSourceById(parseInt(sourceId));
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
