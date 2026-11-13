// Cron Scrape API
// Protected endpoint for scheduled scraping
//
// To set up cron (every 4 hours):
// 0 0,4,8,12,16,20 * * * curl -X POST -H "Authorization: Bearer $SCRAPER_SECRET" http://localhost:3002/api/cron/scrape

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeAllSources, getScrapingStats } from '$server/scrapers/scraper';
import { notifyDailySummary } from '$server/services/email';
import { env } from '$env/dynamic/private';
import { requireScraperAuth, safeEqual } from '$lib/server/auth/scraper-guard';

/**
 * POST is allowed with any of:
 *   - an admin session or the shared scraper secret (see scraper-guard.ts)
 *   - the older dedicated cron key, env CRON_SECRET_KEY, as `?key=` or
 *     `X-Cron-Key` (kept so existing schedulers keep working)
 * There is deliberately no built-in default key any more: if CRON_SECRET_KEY
 * is unset, that path is simply closed.
 */

// The fallback key this file used to ship with. It is public (it is in the
// git history), so it must never be honoured - not even when .env sets
// CRON_SECRET_KEY to this exact value.
const RETIRED_DEFAULT_CRON_KEY = 'yakima-scrape-cron-2024';

function cronKeyMatches(url: URL, request: Request): boolean {
  const configured = env.CRON_SECRET_KEY;
  if (!configured || configured.length < 16 || configured === RETIRED_DEFAULT_CRON_KEY) return false;
  const presented = request.headers.get('x-cron-key') || url.searchParams.get('key');
  return !!presented && safeEqual(presented, configured);
}

export const GET: RequestHandler = async () => {
  // Return scraping stats without authentication
  const stats = await getScrapingStats();
  return json({
    message: 'Cron scrape endpoint. POST to trigger scraping.',
    stats,
  });
};

export const POST: RequestHandler = async (event) => {
  const { url, request } = event;

  if (!cronKeyMatches(url, request)) {
    const auth = requireScraperAuth(event);
    if (!auth.ok) return auth.response;
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
