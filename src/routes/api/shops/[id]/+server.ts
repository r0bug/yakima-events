import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopById, updateShop, deleteShop, isShopOpen } from '$server/services/shops';
import { canUserEditShop } from '$server/services/shopStaff';
import { isAdminUser, requireAdmin } from '$server/api-utils';

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
 * Update a shop. Admins/moderators may change anything; shop staff holding the
 * `canEditShop` permission may edit their own shop's descriptive fields only
 * (never moderation fields: status, featured, verified).
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) {
      return json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const id = parseInt(params.id);

    if (isNaN(id)) {
      return json(
        { success: false, error: 'Invalid shop ID' },
        { status: 400 }
      );
    }

    const admin = isAdminUser(locals.user);
    if (!admin && !(await canUserEditShop(id, locals.user.id))) {
      return json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

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
    if (admin) {
      // Moderation fields are admin-only
      if (data.status !== undefined) updateData.status = data.status;
      if (data.featured !== undefined) updateData.featured = data.featured;
      if (data.verified !== undefined) updateData.verified = data.verified;
    }

    // A website is rendered as a link on the public shop page: refuse any
    // explicit scheme other than http(s) (javascript:, data:, ...)
    if (typeof updateData.website === 'string') {
      const website = updateData.website.trim();
      if (/^[a-z][a-z0-9+.-]*:/i.test(website) && !/^https?:\/\//i.test(website)) {
        return json(
          { success: false, error: 'Website must be an http:// or https:// address' },
          { status: 400 }
        );
      }
      updateData.website = website;
    }

    if (Object.keys(updateData).length === 0) {
      return json({ success: false, error: 'No editable fields supplied' }, { status: 400 });
    }

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
 * Delete a shop (admin/moderator only)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const authError = requireAdmin(locals);
    if (authError) return authError;

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
