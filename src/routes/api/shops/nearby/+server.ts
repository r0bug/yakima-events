import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNearbyShops } from '$server/services/shops';

/**
 * GET /api/shops/nearby
 * Get shops near a location
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const latitude = url.searchParams.get('latitude');
    const longitude = url.searchParams.get('longitude');
    const radius = url.searchParams.get('radius');
    const category = url.searchParams.get('category') || undefined;

    if (!latitude || !longitude) {
      return json(
        { success: false, error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusMiles = radius ? parseFloat(radius) : 10;

    if (isNaN(lat) || isNaN(lng)) {
      return json(
        { success: false, error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    const shops = await getNearbyShops(lat, lng, radiusMiles, category);

    const processedShops = shops.map(shop => ({
      ...shop,
      operating_hours: shop.operatingHours,
      payment_methods: shop.paymentMethods,
      category_name: shop.categoryName,
      category_icon: shop.categoryIcon,
      image_url: shop.primaryImageUrl,
    }));

    return json({
      success: true,
      shops: processedShops,
    });
  } catch (error) {
    console.error('Error fetching nearby shops:', error);
    return json(
      { success: false, error: 'Failed to fetch shops' },
      { status: 500 }
    );
  }
};
