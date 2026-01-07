/**
 * Scraper API
 * GET - Get scraper stats and sources
 * POST - Trigger scrape
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, calendarSources } from '$server/db';
import { eq, desc } from 'drizzle-orm';
import { scrapeAllSources, scrapeSourceById, getScrapingStats, getRecentLogs } from '$server/scrapers/scraper';

export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action');

  try {
    if (action === 'stats') {
      const stats = await getScrapingStats();
      return json(stats);
    }

    if (action === 'logs') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const logs = await getRecentLogs(limit);
      return json({ logs });
    }

    // Default: return sources list
    const sources = await db
      .select()
      .from(calendarSources)
      .orderBy(desc(calendarSources.lastScraped));

    return json({
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        scrapeType: s.scrapeType,
        active: s.active,
        lastScraped: s.lastScraped,
        intelligentMethodId: s.intelligentMethodId,
      })),
    });
  } catch (error) {
    console.error('[API/Scraper] Error:', error);
    return json(
      { error: 'Failed to fetch scraper data' },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, sourceId } = body;

    if (action === 'scrape-all') {
      const results = await scrapeAllSources();

      const summary = {
        totalSources: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        eventsAdded: results.reduce((sum, r) => sum + r.eventsAdded, 0),
        duplicatesSkipped: results.reduce((sum, r) => sum + r.duplicatesSkipped, 0),
      };

      return json({
        success: true,
        summary,
        results,
      });
    }

    if (action === 'scrape-source' && sourceId) {
      const result = await scrapeSourceById(sourceId);
      return json({
        success: result.success,
        result,
      });
    }

    if (action === 'toggle-source' && sourceId) {
      const current = await db
        .select({ active: calendarSources.active })
        .from(calendarSources)
        .where(eq(calendarSources.id, sourceId))
        .limit(1);

      if (current.length === 0) {
        return json({ error: 'Source not found' }, { status: 404 });
      }

      await db
        .update(calendarSources)
        .set({ active: !current[0].active })
        .where(eq(calendarSources.id, sourceId));

      return json({
        success: true,
        active: !current[0].active,
      });
    }

    return json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API/Scraper] Error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Scrape failed' },
      { status: 500 }
    );
  }
};
