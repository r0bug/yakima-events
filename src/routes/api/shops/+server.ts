import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShops, createShop, getShopCategories, getShopCategoryTree } from '$server/services/shops';

/**
 * GET /api/shops
 * Get shops with optional filtering
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const category = url.searchParams.get('category') || undefined;
    const featured = url.searchParams.get('featured');
    const verified = url.searchParams.get('verified');
    const search = url.searchParams.get('search') || undefined;
    const latitude = url.searchParams.get('latitude');
    const longitude = url.searchParams.get('longitude');
    const radius = url.searchParams.get('radius');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    const status = url.searchParams.get('status') as 'active' | 'pending' | 'inactive' | undefined;

    const filters = {
      category,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
      search,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      radius: radius ? parseFloat(radius) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      status: status || 'active',
    };

    const shops = await getShops(filters);

    // Process shops for API response
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
      total: processedShops.length,
    });
  } catch (error) {
    console.error('Error fetching shops:', error);
    return json(
      { success: false, error: 'Failed to fetch shops' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/shops
 * Create a new shop
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.name || !data.address) {
      return json(
        { success: false, error: 'Name and address are required' },
        { status: 400 }
      );
    }

    const shopData = {
      name: data.name,
      description: data.description || null,
      address: data.address,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      categoryId: data.category_id || null,
      operatingHours: data.operating_hours || null,
      paymentMethods: data.payment_methods || null,
      amenities: data.amenities || null,
      status: 'pending' as const, // Public submissions require approval
    };

    const shopId = await createShop(shopData);

    return json({
      success: true,
      message: 'Shop submitted successfully and is pending approval',
      shop_id: shopId,
    });
  } catch (error) {
    console.error('Error creating shop:', error);
    return json(
      { success: false, error: 'Failed to create shop' },
      { status: 500 }
    );
  }
};
