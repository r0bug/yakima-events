/**
 * Calendar Sources API
 * CRUD operations for calendar sources
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, calendarSources } from '$server/db';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get('id');

  try {
    if (id) {
      const source = await db
        .select()
        .from(calendarSources)
        .where(eq(calendarSources.id, parseInt(id)))
        .limit(1);

      if (source.length === 0) {
        return json({ error: 'Source not found' }, { status: 404 });
      }

      return json({ source: source[0] });
    }

    // List all sources
    const sources = await db.select().from(calendarSources);
    return json({ sources });
  } catch (error) {
    console.error('[API/Sources] Error:', error);
    return json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, url: sourceUrl, scrapeType, scrapeConfig, active } = body;

    if (!name || !sourceUrl || !scrapeType) {
      return json(
        { error: 'Name, URL, and scrape type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['ical', 'html', 'json', 'rss', 'yakima_valley', 'intelligent', 'firecrawl'];
    if (!validTypes.includes(scrapeType)) {
      return json({ error: 'Invalid scrape type' }, { status: 400 });
    }

    const result = await db.insert(calendarSources).values({
      name,
      url: sourceUrl,
      scrapeType,
      scrapeConfig: scrapeConfig || null,
      active: active !== false,
    });

    const sourceId = Number(result[0].insertId);

    return json({
      success: true,
      sourceId,
      message: 'Source created successfully',
    });
  } catch (error) {
    console.error('[API/Sources] Error creating source:', error);
    return json({ error: 'Failed to create source' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, name, url: sourceUrl, scrapeType, scrapeConfig, active } = body;

    if (!id) {
      return json({ error: 'Source ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (sourceUrl !== undefined) updateData.url = sourceUrl;
    if (scrapeType !== undefined) updateData.scrapeType = scrapeType;
    if (scrapeConfig !== undefined) updateData.scrapeConfig = scrapeConfig;
    if (active !== undefined) updateData.active = active;

    await db
      .update(calendarSources)
      .set(updateData)
      .where(eq(calendarSources.id, id));

    return json({
      success: true,
      message: 'Source updated successfully',
    });
  } catch (error) {
    console.error('[API/Sources] Error updating source:', error);
    return json({ error: 'Failed to update source' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get('id');

  if (!id) {
    return json({ error: 'Source ID required' }, { status: 400 });
  }

  try {
    await db
      .delete(calendarSources)
      .where(eq(calendarSources.id, parseInt(id)));

    return json({
      success: true,
      message: 'Source deleted successfully',
    });
  } catch (error) {
    console.error('[API/Sources] Error deleting source:', error);
    return json({ error: 'Failed to delete source' }, { status: 500 });
  }
};
