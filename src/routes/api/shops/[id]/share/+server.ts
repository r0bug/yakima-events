import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopShareData } from '$lib/server/services/social';

/**
 * GET /api/shops/[id]/share
 * Get share links and metadata for a shop
 */
export const GET: RequestHandler = async ({ params }) => {
  const shopId = parseInt(params.id);

  if (isNaN(shopId)) {
    return json({ error: 'Invalid shop ID' }, { status: 400 });
  }

  try {
    const shareData = await getShopShareData(shopId);

    if (!shareData) {
      return json({ error: 'Shop not found' }, { status: 404 });
    }

    return json(shareData);
  } catch (error) {
    console.error('Error getting shop share data:', error);
    return json({ error: 'Failed to get share data' }, { status: 500 });
  }
};
