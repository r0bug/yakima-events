import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { events, eventCategories } from '$lib/server/db/schema';
import { desc, eq, sql, and, like } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    redirect(302, '/login?return=/admin/events');
  }

  const page = parseInt(url.searchParams.get('page') || '1');
  const status = url.searchParams.get('status') || 'all';
  const search = url.searchParams.get('search') || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [];
  if (status !== 'all') {
    conditions.push(eq(events.status, status as 'pending' | 'approved' | 'rejected'));
  }
  if (search) {
    conditions.push(like(events.title, `%${search}%`));
  }

  // Get events with pagination
  const eventList = await db
    .select()
    .from(events)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(events.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(events)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const totalCount = countResult?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Get status counts
  const [pendingCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(events)
    .where(eq(events.status, 'pending'));

  const [approvedCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(events)
    .where(eq(events.status, 'approved'));

  // Get categories
  const categories = await db.select().from(eventCategories);

  return {
    user: locals.user,
    events: eventList,
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
      pending: pendingCount?.count || 0,
      approved: approvedCount?.count || 0,
    },
  };
};
