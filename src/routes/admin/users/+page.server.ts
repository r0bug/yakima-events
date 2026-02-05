import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { desc, eq, sql, and, like, or } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    redirect(302, '/login?return=/admin/users');
  }

  const page = parseInt(url.searchParams.get('page') || '1');
  const role = url.searchParams.get('role') || 'all';
  const search = url.searchParams.get('search') || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [];
  if (role !== 'all') {
    if (role === 'admin') {
      conditions.push(eq(users.role, 'admin'));
    } else if (role === 'business_owner') {
      conditions.push(eq(users.isBusinessOwner, true));
    } else if (role === 'yf_staff') {
      conditions.push(eq(users.isYfStaff, true));
    }
  }
  if (search) {
    conditions.push(
      or(
        like(users.username, `%${search}%`),
        like(users.email, `%${search}%`)
      )
    );
  }

  // Get users with pagination
  const userList = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      status: users.status,
      isBusinessOwner: users.isBusinessOwner,
      isYfStaff: users.isYfStaff,
      isYfVendor: users.isYfVendor,
      avatarUrl: users.avatarUrl,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const totalCount = countResult?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Get role counts
  const [adminCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.role, 'admin'));

  const [businessOwnerCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.isBusinessOwner, true));

  const [yfStaffCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.isYfStaff, true));

  return {
    user: locals.user,
    users: userList,
    pagination: {
      page,
      totalPages,
      totalCount,
    },
    filters: {
      role,
      search,
    },
    counts: {
      admins: adminCount?.count || 0,
      businessOwners: businessOwnerCount?.count || 0,
      yfStaff: yfStaffCount?.count || 0,
    },
  };
};
