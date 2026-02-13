import { db, localShops, shopCategories, shopImages } from '$server/db';
import { eq, and, gte, lte, sql, desc, asc, like, or } from 'drizzle-orm';
import type { LocalShop, NewLocalShop, ShopCategory } from '$server/db/schema';

export interface ShopFilters {
  status?: 'pending' | 'active' | 'inactive';
  category?: string;
  featured?: boolean;
  verified?: boolean;
  search?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // in miles
  limit?: number;
  offset?: number;
}

export interface ShopWithDetails extends LocalShop {
  categoryName?: string;
  categoryIcon?: string;
  primaryImageUrl?: string;
  distance?: number;
}

/**
 * Get shops with optional filtering
 */
export async function getShops(filters: ShopFilters = {}): Promise<ShopWithDetails[]> {
  const conditions = [];

  // Status filter
  if (filters.status) {
    conditions.push(eq(localShops.status, filters.status));
  } else {
    conditions.push(eq(localShops.status, 'active'));
  }

  // Category filter
  if (filters.category) {
    const category = await db
      .select({ id: shopCategories.id })
      .from(shopCategories)
      .where(eq(shopCategories.slug, filters.category))
      .limit(1);

    if (category.length > 0) {
      conditions.push(eq(localShops.categoryId, category[0].id));
    }
  }

  // Featured filter
  if (filters.featured !== undefined) {
    conditions.push(eq(localShops.featured, filters.featured));
  }

  // Verified filter
  if (filters.verified !== undefined) {
    conditions.push(eq(localShops.verified, filters.verified));
  }

  // Search filter
  if (filters.search) {
    conditions.push(
      or(
        like(localShops.name, `%${filters.search}%`),
        like(localShops.description, `%${filters.search}%`)
      )
    );
  }

  let query = db
    .select({
      id: localShops.id,
      name: localShops.name,
      description: localShops.description,
      address: localShops.address,
      latitude: localShops.latitude,
      longitude: localShops.longitude,
      phone: localShops.phone,
      email: localShops.email,
      website: localShops.website,
      imageUrl: localShops.imageUrl,
      categoryId: localShops.categoryId,
      hours: localShops.hours,
      operatingHours: localShops.operatingHours,
      paymentMethods: localShops.paymentMethods,
      amenities: localShops.amenities,
      featured: localShops.featured,
      verified: localShops.verified,
      ownerId: localShops.ownerId,
      status: localShops.status,
      active: localShops.active,
      createdAt: localShops.createdAt,
      updatedAt: localShops.updatedAt,
      categoryName: shopCategories.name,
      categoryIcon: shopCategories.icon,
    })
    .from(localShops)
    .leftJoin(shopCategories, eq(localShops.categoryId, shopCategories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(localShops.featured), asc(localShops.name));

  // Apply pagination
  if (filters.limit) {
    query = query.limit(filters.limit) as typeof query;
  }
  if (filters.offset) {
    query = query.offset(filters.offset) as typeof query;
  }

  const results = await query;

  return results.map(shop => ({
    ...shop,
    primaryImageUrl: shop.imageUrl || undefined,
  })) as ShopWithDetails[];
}

/**
 * Get shops near a location
 */
export async function getNearbyShops(
  latitude: number,
  longitude: number,
  radiusMiles: number = 10,
  category?: string
): Promise<ShopWithDetails[]> {
  const radiusKm = radiusMiles * 1.60934;

  let categoryCondition = '';
  if (category) {
    categoryCondition = `AND sc.slug = '${category}'`;
  }

  const results = await db.execute(sql`
    SELECT
      s.*,
      sc.name as category_name,
      sc.icon as category_icon,
      (6371 * acos(
        cos(radians(${latitude})) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(${longitude})) +
        sin(radians(${latitude})) * sin(radians(s.latitude))
      )) AS distance
    FROM local_shops s
    LEFT JOIN shop_categories sc ON s.category_id = sc.id
    WHERE s.status = 'active'
      AND s.latitude IS NOT NULL
      AND s.longitude IS NOT NULL
      ${sql.raw(categoryCondition)}
    HAVING distance <= ${radiusKm}
    ORDER BY distance ASC, s.featured DESC
  `);

  return (results[0] as Record<string, unknown>[]).map(shop => ({
    ...shop,
    categoryName: shop.category_name,
    categoryIcon: shop.category_icon,
    primaryImageUrl: shop.image_url || undefined,
  })) as ShopWithDetails[];
}

/**
 * Get shop by ID
 */
export async function getShopById(id: number): Promise<ShopWithDetails | null> {
  const result = await db
    .select({
      id: localShops.id,
      name: localShops.name,
      description: localShops.description,
      address: localShops.address,
      latitude: localShops.latitude,
      longitude: localShops.longitude,
      phone: localShops.phone,
      email: localShops.email,
      website: localShops.website,
      imageUrl: localShops.imageUrl,
      categoryId: localShops.categoryId,
      hours: localShops.hours,
      operatingHours: localShops.operatingHours,
      paymentMethods: localShops.paymentMethods,
      amenities: localShops.amenities,
      featured: localShops.featured,
      verified: localShops.verified,
      ownerId: localShops.ownerId,
      status: localShops.status,
      active: localShops.active,
      createdAt: localShops.createdAt,
      updatedAt: localShops.updatedAt,
      categoryName: shopCategories.name,
      categoryIcon: shopCategories.icon,
    })
    .from(localShops)
    .leftJoin(shopCategories, eq(localShops.categoryId, shopCategories.id))
    .where(eq(localShops.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const shop = result[0];

  return {
    ...shop,
    primaryImageUrl: shop.imageUrl || undefined,
  } as ShopWithDetails;
}

/**
 * Create a new shop
 */
export async function createShop(data: NewLocalShop): Promise<number> {
  const result = await db.insert(localShops).values({
    ...data,
    status: data.status || 'pending',
  });

  return Number(result[0].insertId);
}

/**
 * Update a shop
 */
export async function updateShop(id: number, data: Partial<NewLocalShop>): Promise<boolean> {
  const result = await db
    .update(localShops)
    .set(data)
    .where(eq(localShops.id, id));

  return result[0].affectedRows > 0;
}

/**
 * Delete a shop
 */
export async function deleteShop(id: number): Promise<boolean> {
  // Delete images first
  await db.delete(shopImages).where(eq(shopImages.shopId, id));

  // Delete shop
  const result = await db.delete(localShops).where(eq(localShops.id, id));

  return result[0].affectedRows > 0;
}

/**
 * Get all shop categories
 */
export async function getShopCategories(): Promise<ShopCategory[]> {
  return db
    .select()
    .from(shopCategories)
    .where(eq(shopCategories.active, true))
    .orderBy(asc(shopCategories.sortOrder), asc(shopCategories.name));
}

/**
 * Get category tree with children
 */
export async function getShopCategoryTree(): Promise<(ShopCategory & { children: ShopCategory[] })[]> {
  const allCategories = await getShopCategories();

  const rootCategories = allCategories.filter(c => !c.parentId);

  return rootCategories.map(root => ({
    ...root,
    children: allCategories.filter(c => c.parentId === root.id),
  }));
}

/**
 * Check if shop is currently open
 */
export function isShopOpen(operatingHours: Record<string, any> | null): boolean | null {
  if (!operatingHours) return null;

  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[now.getDay()];

  const todayHours = operatingHours[dayOfWeek];
  if (!todayHours || todayHours.closed) return false;

  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  return currentTime >= todayHours.open && currentTime <= todayHours.close;
}

/**
 * Get featured shops
 */
export async function getFeaturedShops(limit: number = 10): Promise<ShopWithDetails[]> {
  return getShops({
    featured: true,
    status: 'active',
    limit,
  });
}
