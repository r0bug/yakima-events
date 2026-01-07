import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopCategoryTree } from '$server/services/shops';

/**
 * GET /api/shops/categories
 * Get all shop categories as a tree
 */
export const GET: RequestHandler = async () => {
  try {
    const categories = await getShopCategoryTree();

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
