#!/usr/bin/env npx tsx
/**
 * Event Scraping Cron Job
 *
 * Run daily to scrape events from configured sources
 *
 * Usage:
 *   npx tsx scripts/scrape-events.ts
 *
 * Cron example (daily at 2 AM):
 *   0 2 * * * cd /path/to/yakima && npx tsx scripts/scrape-events.ts >> logs/scrape.log 2>&1
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';
import { parseICalContent } from '../src/lib/server/scrapers/parsers/ical';
import { parseJsonContent } from '../src/lib/server/scrapers/parsers/json';
import { parseRssContent } from '../src/lib/server/scrapers/parsers/rss';

// Configuration
const config = {
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'yakima',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'yakima_events',
  },
  logDir: './logs',
  timezone: 'America/Los_Angeles',
};

// Logging
function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

// Main execution
async function main() {
  log('Starting event scraping process');

  // Create database connection
  const pool = mysql.createPool({
    ...config.database,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const db = drizzle(pool, { schema, mode: 'default' });

  try {
    // Get active sources
    const sources = await db
      .select()
      .from(schema.calendarSources)
      .where(eq(schema.calendarSources.active, true));

    log(`Found ${sources.length} active sources to scrape`);

    let totalEventsFound = 0;
    let totalEventsAdded = 0;
    let successfulSources = 0;
    let failedSources = 0;

    // Process each source
    for (const source of sources) {
      const startTime = Date.now();
      log(`Scraping source: ${source.name} (${source.type})`);

      try {
        // Fetch content
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'YakimaEvents/1.0 (Event Calendar Scraper)',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();
        let events: any[] = [];

        // Parse based on type
        const sourceConfig = source.configuration as any || {};

        switch (source.type) {
          case 'ical':
            events = parseICalContent(content);
            break;
          case 'json':
            const jsonData = JSON.parse(content);
            events = parseJsonContent(jsonData, sourceConfig);
            break;
          case 'rss':
            events = parseRssContent(content);
            break;
          case 'html':
            // HTML parsing requires jsdom, skip in CLI for simplicity
            log(`HTML scraping not supported in CLI mode for: ${source.name}`, 'WARN');
            continue;
          default:
            log(`Unknown source type: ${source.type}`, 'WARN');
            continue;
        }

        totalEventsFound += events.length;
        let addedCount = 0;
        let duplicateCount = 0;

        // Process events
        for (const event of events) {
          if (!event.title || !event.startDatetime) continue;

          // Check for duplicates
          const existing = await db
            .select({ id: schema.events.id })
            .from(schema.events)
            .where(
              sql`title = ${event.title} AND start_datetime = ${event.startDatetime}`
            )
            .limit(1);

          if (existing.length > 0) {
            duplicateCount++;
            continue;
          }

          // Insert event
          await db.insert(schema.events).values({
            title: event.title,
            description: event.description || null,
            startDatetime: event.startDatetime,
            endDatetime: event.endDatetime || null,
            location: event.location || null,
            address: event.address || null,
            latitude: event.latitude ? String(event.latitude) : null,
            longitude: event.longitude ? String(event.longitude) : null,
            externalUrl: event.externalUrl || null,
            externalEventId: event.externalEventId || null,
            sourceId: source.id,
            status: 'pending',
          });

          addedCount++;
        }

        totalEventsAdded += addedCount;
        successfulSources++;

        // Update last scraped
        await db
          .update(schema.calendarSources)
          .set({ lastScraped: new Date() })
          .where(eq(schema.calendarSources.id, source.id));

        const duration = Date.now() - startTime;
        log(
          `  ${source.name}: Found ${events.length}, added ${addedCount}, duplicates ${duplicateCount} (${duration}ms)`
        );
      } catch (error) {
        failedSources++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`  ${source.name}: FAILED - ${errorMessage}`, 'ERROR');
      }
    }

    // Summary
    log('='.repeat(50));
    log('Scraping completed');
    log(`Sources processed: ${sources.length}`);
    log(`Successful: ${successfulSources}`);
    log(`Failed: ${failedSources}`);
    log(`Total events found: ${totalEventsFound}`);
    log(`Total events added: ${totalEventsAdded}`);
  } catch (error) {
    log(`Critical error: ${error}`, 'ERROR');
    process.exit(1);
  } finally {
    await pool.end();
  }

  process.exit(0);
}

main().catch((error) => {
  log(`Unhandled error: ${error}`, 'ERROR');
  process.exit(1);
});
