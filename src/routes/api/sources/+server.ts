import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getSources,
  createSource,
  getSourceTypes,
} from '$server/services/sources';

/**
 * GET /api/sources
 * Get all calendar sources
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const activeOnly = url.searchParams.get('active') === 'true';
    const sources = await getSources(activeOnly);

    return json({
      success: true,
      sources,
      types: getSourceTypes(),
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    return json(
      { success: false, error: 'Failed to fetch sources' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/sources
 * Create a new calendar source
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.name || !data.url || !data.type) {
      return json(
        { success: false, error: 'Name, URL, and type are required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['ical', 'html', 'json', 'rss'];
    if (!validTypes.includes(data.type)) {
      return json(
        { success: false, error: 'Invalid source type' },
        { status: 400 }
      );
    }

    const sourceId = await createSource({
      name: data.name,
      url: data.url,
      type: data.type,
      configuration: data.configuration,
      active: data.active ?? true,
      scrapeFrequency: data.scrape_frequency || 3600,
    });

    return json({
      success: true,
      message: 'Source created successfully',
      source_id: sourceId,
    });
  } catch (error) {
    console.error('Error creating source:', error);
    return json(
      { success: false, error: 'Failed to create source' },
      { status: 500 }
    );
  }
};
