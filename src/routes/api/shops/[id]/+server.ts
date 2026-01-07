import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopById, updateShop, deleteShop, isShopOpen } from '$server/services/shops';

/**
 * GET /api/shops/[id]
 * Get a single shop by ID
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return json(
        { success: false, error: 'Invalid shop ID' },
        { status: 400 }
      );
    }

    const shop = await getShopById(id);

    if (!shop) {
      return json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      );
    }

    // Format for API response
    const formattedShop = {
      ...shop,
      operating_hours: shop.operatingHours,
      payment_methods: shop.paymentMethods,
      category_name: shop.categoryName,
      category_icon: shop.categoryIcon,
      image_url: shop.primaryImageUrl,
      is_open: isShopOpen(shop.operatingHours as Record<string, any> | null),
    };

    return json({
      success: true,
      shop: formattedShop,
    });
  } catch (error) {
    console.error('Error fetching shop:', error);
    return json(
      { success: false, error: 'Failed to fetch shop' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/shops/[id]
 * Update a shop
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return json(
        { success: false, error: 'Invalid shop ID' },
        { status: 400 }
      );
    }

    const data = await request.json();

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.category_id !== undefined) updateData.categoryId = data.category_id;
    if (data.operating_hours !== undefined) updateData.operatingHours = data.operating_hours;
    if (data.payment_methods !== undefined) updateData.paymentMethods = data.payment_methods;
    if (data.amenities !== undefined) updateData.amenities = data.amenities;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.featured !== undefined) updateData.featured = data.featured;
    if (data.verified !== undefined) updateData.verified = data.verified;

    const success = await updateShop(id, updateData);

    if (!success) {
      return json(
        { success: false, error: 'Shop not found or no changes made' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: 'Shop updated successfully',
    });
  } catch (error) {
    console.error('Error updating shop:', error);
    return json(
      { success: false, error: 'Failed to update shop' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/shops/[id]
 * Delete a shop
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return json(
        { success: false, error: 'Invalid shop ID' },
        { status: 400 }
      );
    }

    const success = await deleteShop(id);

    if (!success) {
      return json(
        { success: false, error: 'Shop not found' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: 'Shop deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting shop:', error);
    return json(
      { success: false, error: 'Failed to delete shop' },
      { status: 500 }
    );
  }
};
