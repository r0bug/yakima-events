import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { localShops, shopCategories } from '$lib/server/db/schema';
import { desc, eq, sql, and, like } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    redirect(302, '/login?return=/admin/shops');
  }

  const page = parseInt(url.searchParams.get('page') || '1');
  const status = url.searchParams.get('status') || 'all';
  const search = url.searchParams.get('search') || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [];
  if (status !== 'all') {
    conditions.push(eq(localShops.status, status as 'active' | 'pending' | 'inactive'));
  }
  if (search) {
    conditions.push(like(localShops.name, `%${search}%`));
  }

  // Get shops with pagination
  const shopList = await db
    .select()
    .from(localShops)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(localShops.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(localShops)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const totalCount = countResult?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Get status counts
  const [activeCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(localShops)
    .where(eq(localShops.status, 'active'));

  const [pendingCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(localShops)
    .where(eq(localShops.status, 'pending'));

  const [verifiedCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(localShops)
    .where(eq(localShops.verified, true));

  // Get categories
  const categories = await db.select().from(shopCategories);

  return {
    user: locals.user,
    shops: shopList,
    categories,
    pagination: {
      page,
      totalPages,
      totalCount,
    },
    filters: {
      status,
      search,
    },
    counts: {
      active: activeCount?.count || 0,
      pending: pendingCount?.count || 0,
      verified: verifiedCount?.count || 0,
    },
  };
};
