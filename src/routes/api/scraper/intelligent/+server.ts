/**
 * Intelligent Scraper API
 * POST - Analyze URL, approve session, batch processing
 * GET - Get sessions, stats
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, intelligentScraperSessions, intelligentScraperBatches, intelligentScraperBatchItems, intelligentScraperMethods } from '$server/db';
import { eq, desc, sql, and } from 'drizzle-orm';
import * as intelligentScraper from '$server/scrapers/intelligent';
import { notifyBatchComplete } from '$server/services/email';

export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action');

  try {
    if (action === 'stats') {
      // Get intelligent scraper statistics
      const sessionsResult = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'events_found' THEN 1 ELSE 0 END) as events_found,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
        FROM intelligent_scraper_sessions
      `);

      const methodsResult = await db.execute(sql`
        SELECT COUNT(*) as total, AVG(success_rate) as avg_success_rate
        FROM intelligent_scraper_methods WHERE active = 1
      `);

      const sessions = (sessionsResult[0] as Record<string, unknown>[])[0] || {};
      const methods = (methodsResult[0] as Record<string, unknown>[])[0] || {};

      return json({
        sessions: {
          total: Number(sessions.total) || 0,
          eventsFound: Number(sessions.events_found) || 0,
          approved: Number(sessions.approved) || 0,
          errors: Number(sessions.errors) || 0,
        },
        methods: {
          total: Number(methods.total) || 0,
          avgSuccessRate: Number(methods.avg_success_rate) || 0,
        },
      });
    }

    if (action === 'sessions') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const sessions = await intelligentScraper.getRecentSessions(limit);
      return json({ sessions });
    }

    if (action === 'session') {
      const sessionId = parseInt(url.searchParams.get('id') || '0');
      if (!sessionId) {
        return json({ error: 'Session ID required' }, { status: 400 });
      }

      const session = await intelligentScraper.getSession(sessionId);
      if (!session) {
        return json({ error: 'Session not found' }, { status: 404 });
      }

      return json({ session });
    }

    if (action === 'methods') {
      const methods = await db
        .select()
        .from(intelligentScraperMethods)
        .where(eq(intelligentScraperMethods.active, true))
        .orderBy(desc(intelligentScraperMethods.successRate))
        .limit(50);

      return json({
        methods: methods.map((m) => ({
          id: m.id,
          name: m.name,
          domain: m.domain,
          methodType: m.methodType,
          confidenceScore: m.confidenceScore,
          usageCount: m.usageCount,
          successRate: m.successRate,
          lastUsed: m.lastUsed,
        })),
      });
    }

    if (action === 'batches') {
      const batches = await db
        .select()
        .from(intelligentScraperBatches)
        .orderBy(desc(intelligentScraperBatches.createdAt))
        .limit(20);

      return json({ batches });
    }

    // Default: return availability status
    return json({
      available: intelligentScraper.isAvailable(),
    });
  } catch (error) {
    console.error('[API/IntelligentScraper] Error:', error);
    return json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, url: targetUrl, sessionId, urls, filename } = body;

    if (action === 'analyze') {
      if (!targetUrl) {
        return json({ error: 'URL required' }, { status: 400 });
      }

      if (!intelligentScraper.isAvailable()) {
        return json(
          { error: 'Intelligent scraper not available (API key not configured)' },
          { status: 503 }
        );
      }

      const result = await intelligentScraper.analyzeUrl(targetUrl);

      return json({
        success: result.success,
        sessionId: result.sessionId,
        events: result.events,
        analysis: result.analysis,
        eventsSaved: result.eventsSaved,
        usedExisting: result.usedExisting,
        error: result.error,
      });
    }

    if (action === 'approve') {
      if (!sessionId) {
        return json({ error: 'Session ID required' }, { status: 400 });
      }

      const result = await intelligentScraper.approveSession(sessionId);

      return json({
        success: true,
        methodId: result.methodId,
        sourceId: result.sourceId,
      });
    }

    if (action === 'batch') {
      // Batch processing - accept array of URLs
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return json({ error: 'URLs array required' }, { status: 400 });
      }

      // Create batch
      const batchResult = await db.insert(intelligentScraperBatches).values({
        filename: filename || null,
        totalUrls: urls.length,
        status: 'pending',
      });

      const batchId = Number(batchResult[0].insertId);

      // Create batch items
      for (const urlItem of urls) {
        const itemUrl = typeof urlItem === 'string' ? urlItem : urlItem.url;
        const itemTitle = typeof urlItem === 'object' ? urlItem.title : null;

        await db.insert(intelligentScraperBatchItems).values({
          batchId,
          url: itemUrl,
          title: itemTitle,
          status: 'pending',
        });
      }

      // Start processing in background (non-blocking)
      processBatch(batchId).catch((err) => {
        console.error(`[Batch ${batchId}] Processing error:`, err);
      });

      return json({
        success: true,
        batchId,
        totalUrls: urls.length,
        message: 'Batch processing started',
      });
    }

    return json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API/IntelligentScraper] Error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    );
  }
};

/**
 * Process batch in background
 */
async function processBatch(batchId: number): Promise<void> {
  const startTime = Date.now();

  // Update batch status
  await db
    .update(intelligentScraperBatches)
    .set({ status: 'processing', startedAt: new Date() })
    .where(eq(intelligentScraperBatches.id, batchId));

  // Get batch items
  const items = await db
    .select()
    .from(intelligentScraperBatchItems)
    .where(eq(intelligentScraperBatchItems.batchId, batchId));

  let successCount = 0;
  let errorCount = 0;
  let totalEvents = 0;

  for (const item of items) {
    try {
      // Update item status
      await db
        .update(intelligentScraperBatchItems)
        .set({ status: 'processing' })
        .where(eq(intelligentScraperBatchItems.id, item.id));

      // Analyze URL
      const result = await intelligentScraper.analyzeUrl(item.url);

      if (result.success) {
        successCount++;
        const eventsFound = result.events?.length || 0;
        totalEvents += eventsFound;

        await db
          .update(intelligentScraperBatchItems)
          .set({
            status: 'completed',
            sessionId: result.sessionId,
            eventsFound,
            processedAt: new Date(),
          })
          .where(eq(intelligentScraperBatchItems.id, item.id));
      } else {
        errorCount++;

        await db
          .update(intelligentScraperBatchItems)
          .set({
            status: 'failed',
            sessionId: result.sessionId,
            errorMessage: result.error,
            processedAt: new Date(),
          })
          .where(eq(intelligentScraperBatchItems.id, item.id));
      }

      // Update batch progress
      await db
        .update(intelligentScraperBatches)
        .set({
          processedUrls: successCount + errorCount,
          successCount,
          errorCount,
          totalEvents,
        })
        .where(eq(intelligentScraperBatches.id, batchId));

      // Rate limiting between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      errorCount++;
      console.error(`[Batch ${batchId}] Error processing ${item.url}:`, error);

      await db
        .update(intelligentScraperBatchItems)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date(),
        })
        .where(eq(intelligentScraperBatchItems.id, item.id));
    }
  }

  // Complete batch
  const duration = Date.now() - startTime;

  await db
    .update(intelligentScraperBatches)
    .set({
      status: 'completed',
      processedUrls: items.length,
      successCount,
      errorCount,
      totalEvents,
      completedAt: new Date(),
    })
    .where(eq(intelligentScraperBatches.id, batchId));

  // Send notification
  const batch = await db
    .select()
    .from(intelligentScraperBatches)
    .where(eq(intelligentScraperBatches.id, batchId))
    .limit(1);

  if (batch.length > 0) {
    await notifyBatchComplete({
      batchId,
      filename: batch[0].filename || undefined,
      totalUrls: items.length,
      successCount,
      errorCount,
      totalEvents,
      duration,
    });
  }
}
