// Cron Scrape API
// Protected endpoint for scheduled scraping
//
// To set up cron (every 4 hours):
// 0 0,4,8,12,16,20 * * * curl -X POST https://yfevents.yakimafinds.com/api/cron/scrape?key=YOUR_CRON_KEY

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeAllSources, getScrapingStats } from '$server/scrapers/scraper';
import { notifyDailySummary } from '$server/services/email';

// Simple cron key protection (you should use a proper secret)
const CRON_KEY = process.env.CRON_SECRET_KEY || 'yakima-scrape-cron-2024';

export const GET: RequestHandler = async ({ url }) => {
  // Return scraping stats without authentication
  const stats = await getScrapingStats();
  return json({
    message: 'Cron scrape endpoint. POST to trigger scraping.',
    stats,
  });
};

export const POST: RequestHandler = async ({ url, request }) => {
  // Check cron key
  const key = url.searchParams.get('key');
  const headerKey = request.headers.get('x-cron-key');

  if (key !== CRON_KEY && headerKey !== CRON_KEY) {
    return json({ error: 'Invalid cron key' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[Cron] Starting scheduled scrape');

  try {
    const results = await scrapeAllSources();

    const summary = {
      totalSources: results.length,
      successfulSources: results.filter((r) => r.success).length,
      failedSources: results.filter((r) => !r.success).length,
      totalEventsAdded: results.reduce((sum, r) => sum + r.eventsAdded, 0),
      totalDuplicatesSkipped: results.reduce((sum, r) => sum + r.duplicatesSkipped, 0),
    };

    const durationMs = Date.now() - startTime;
    console.log(`[Cron] Completed in ${durationMs}ms:`, summary);

    // Check if this is a daily summary request
    const sendSummary = url.searchParams.get('summary') === 'true';
    if (sendSummary) {
      await notifyDailySummary(summary);
    }

    return json({
      success: true,
      summary,
      durationMs,
      results: results.map((r) => ({
        sourceId: r.sourceId,
        sourceName: r.sourceName,
        success: r.success,
        eventsFound: r.eventsFound,
        eventsAdded: r.eventsAdded,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error('[Cron] Scrape failed:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
};
