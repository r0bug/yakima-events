import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { communicationChannels, communicationMessages, users } from '$lib/server/db/schema';
import { desc, eq, sql, and, like } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    redirect(302, '/login?return=/admin/communication');
  }

  const page = parseInt(url.searchParams.get('page') || '1');
  const type = url.searchParams.get('type') || 'all';
  const search = url.searchParams.get('search') || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [];
  if (type !== 'all') {
    conditions.push(eq(communicationChannels.type, type as 'public' | 'private' | 'event' | 'vendor' | 'announcement'));
  }
  if (search) {
    conditions.push(like(communicationChannels.name, `%${search}%`));
  }

  // Get channels with pagination
  const channels = await db
    .select({
      channel: communicationChannels,
      createdBy: {
        id: users.id,
        username: users.username,
      },
    })
    .from(communicationChannels)
    .leftJoin(users, eq(communicationChannels.createdByUserId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(communicationChannels.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(communicationChannels)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const totalCount = countResult?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Get type counts
  const [publicCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(communicationChannels)
    .where(eq(communicationChannels.type, 'public'));

  const [privateCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(communicationChannels)
    .where(eq(communicationChannels.type, 'private'));

  // Get total messages count
  const [messageCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(communicationMessages);

  return {
    user: locals.user,
    channels: channels.map(c => ({
      ...c.channel,
      createdBy: c.createdBy,
    })),
    pagination: {
      page,
      totalPages,
      totalCount,
    },
    filters: {
      type,
      search,
    },
    counts: {
      public: publicCount?.count || 0,
      private: privateCount?.count || 0,
      totalMessages: messageCount?.count || 0,
    },
  };
};
