import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getSourceById,
  updateSource,
  deleteSource,
  testSource,
} from '$server/services/sources';

/**
 * GET /api/sources/[id]
 * Get a single source
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ success: false, error: 'Invalid source ID' }, { status: 400 });
    }

    const source = await getSourceById(id);
    if (!source) {
      return json({ success: false, error: 'Source not found' }, { status: 404 });
    }

    return json({
      success: true,
      source,
    });
  } catch (error) {
    console.error('Error fetching source:', error);
    return json(
      { success: false, error: 'Failed to fetch source' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/sources/[id]
 * Update a source
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ success: false, error: 'Invalid source ID' }, { status: 400 });
    }

    const data = await request.json();
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.configuration !== undefined) updateData.configuration = data.configuration;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.scrape_frequency !== undefined) updateData.scrapeFrequency = data.scrape_frequency;

    const success = await updateSource(id, updateData);
    if (!success) {
      return json({ success: false, error: 'Source not found' }, { status: 404 });
    }

    return json({
      success: true,
      message: 'Source updated successfully',
    });
  } catch (error) {
    console.error('Error updating source:', error);
    return json(
      { success: false, error: 'Failed to update source' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/sources/[id]
 * Delete a source
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ success: false, error: 'Invalid source ID' }, { status: 400 });
    }

    const success = await deleteSource(id);
    if (!success) {
      return json({ success: false, error: 'Source not found' }, { status: 404 });
    }

    return json({
      success: true,
      message: 'Source deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting source:', error);
    return json(
      { success: false, error: 'Failed to delete source' },
      { status: 500 }
    );
  }
};
