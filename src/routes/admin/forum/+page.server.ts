import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	communicationChannels,
	communicationMessages,
	communicationParticipants,
	shopStaff,
	localShops,
	users,
} from '$lib/server/db/schema';
import { desc, eq, sql, and, isNull } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(302, '/login?return=/admin/forum');
	}

	const tab = url.searchParams.get('tab') || 'stats';

	// Stats
	const [[channelCount], [messageCount], [memberCount], [activeToday]] = await Promise.all([
		db.select({ count: sql<number>`COUNT(*)` }).from(communicationChannels),
		db.select({ count: sql<number>`COUNT(*)` }).from(communicationMessages).where(eq(communicationMessages.isDeleted, false)),
		db.select({ count: sql<number>`COUNT(DISTINCT ${communicationParticipants.userId})` }).from(communicationParticipants),
		db.select({ count: sql<number>`COUNT(DISTINCT ${communicationMessages.userId})` })
			.from(communicationMessages)
			.where(sql`${communicationMessages.createdAt} >= CURDATE()`),
	]);

	const stats = {
		channels: channelCount?.count || 0,
		messages: messageCount?.count || 0,
		members: memberCount?.count || 0,
		activeToday: activeToday?.count || 0,
	};

	// Members list
	const members = await db
		.select({
			userId: shopStaff.userId,
			username: users.username,
			email: users.email,
			firstName: users.firstName,
			lastName: users.lastName,
			avatarUrl: users.avatarUrl,
			userStatus: users.status,
			shopId: shopStaff.shopId,
			shopName: localShops.name,
			shopRole: shopStaff.role,
			joinedAt: shopStaff.createdAt,
		})
		.from(shopStaff)
		.innerJoin(users, eq(shopStaff.userId, users.id))
		.innerJoin(localShops, eq(shopStaff.shopId, localShops.id))
		.where(isNull(shopStaff.revokedAt))
		.orderBy(desc(shopStaff.createdAt))
		.limit(50);

	// Recent messages across all channels
	const recentMessages = await db
		.select({
			id: communicationMessages.id,
			content: communicationMessages.content,
			createdAt: communicationMessages.createdAt,
			isPinned: communicationMessages.isPinned,
			isDeleted: communicationMessages.isDeleted,
			channelId: communicationMessages.channelId,
			channelName: communicationChannels.name,
			userId: communicationMessages.userId,
			username: users.username,
		})
		.from(communicationMessages)
		.innerJoin(communicationChannels, eq(communicationMessages.channelId, communicationChannels.id))
		.innerJoin(users, eq(communicationMessages.userId, users.id))
		.where(eq(communicationMessages.isDeleted, false))
		.orderBy(desc(communicationMessages.createdAt))
		.limit(50);

	// Channels with stats
	const channels = await db
		.select({
			id: communicationChannels.id,
			name: communicationChannels.name,
			type: communicationChannels.type,
			isArchived: communicationChannels.isArchived,
			messageCount: communicationChannels.messageCount,
			participantCount: communicationChannels.participantCount,
			lastActivityAt: communicationChannels.lastActivityAt,
			createdAt: communicationChannels.createdAt,
		})
		.from(communicationChannels)
		.orderBy(desc(communicationChannels.lastActivityAt));

	return {
		user: locals.user,
		tab,
		stats,
		members,
		recentMessages,
		channels,
	};
};
