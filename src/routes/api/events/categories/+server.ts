import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventCategories } from '$server/services/events';

/**
 * GET /api/events/categories
 * Get all event categories
 */
export const GET: RequestHandler = async () => {
  try {
    const categories = await getEventCategories();

    return json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
};
