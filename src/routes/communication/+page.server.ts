import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserChannels, getPublicChannels } from '$lib/server/services/communication';
import { db } from '$lib/server/db';
import { shopStaff, localShops, events, eventShopParticipants } from '$lib/server/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { getPendingProposalsForShop } from '$lib/server/services/collaborativeEvents';

export const load: PageServerLoad = async ({ locals }) => {
	// Require authentication for Communication Hub
	if (!locals.user) {
		redirect(302, '/login?return=/communication');
	}

	const userId = locals.user.id;
	const isYfStaff = locals.user.isYfStaff || locals.user.role === 'admin' || locals.user.role === 'moderator';

	// Check if user has shop staff membership
	const staffMemberships = await db
		.select({
			shopId: shopStaff.shopId,
			shopName: localShops.name,
			role: shopStaff.role,
		})
		.from(shopStaff)
		.innerJoin(localShops, eq(shopStaff.shopId, localShops.id))
		.where(
			and(
				eq(shopStaff.userId, userId),
				isNull(shopStaff.revokedAt)
			)
		);

	const hasForumAccess = isYfStaff || staffMemberships.length > 0;

	if (!hasForumAccess) {
		return {
			user: locals.user,
			hasForumAccess: false,
			userChannels: [],
			publicChannels: [],
			userShops: [],
			pendingProposals: [],
		};
	}

	// Get channels - filter to forum-relevant types
	const [userChannels, publicChannels] = await Promise.all([
		getUserChannels(userId, false),
		getPublicChannels(20, 0),
	]);

	// Filter out channels user is already in
	const userChannelIds = new Set(userChannels.map(c => c.id));
	const availablePublicChannels = publicChannels.filter(c => !userChannelIds.has(c.id));

	// Get pending proposals for user's shops
	const shopIds = staffMemberships.map(s => s.shopId);
	let pendingProposals: Awaited<ReturnType<typeof getPendingProposalsForShop>> = [];
	if (shopIds.length > 0) {
		const proposalPromises = shopIds.map(id => getPendingProposalsForShop(id));
		const allProposals = await Promise.all(proposalPromises);
		pendingProposals = allProposals.flat();
		// Deduplicate by event ID
		const seen = new Set<number>();
		pendingProposals = pendingProposals.filter(p => {
			if (seen.has(p.id)) return false;
			seen.add(p.id);
			return true;
		});
	}

	return {
		user: locals.user,
		hasForumAccess: true,
		userChannels,
		publicChannels: availablePublicChannels,
		userShops: staffMemberships,
		pendingProposals,
	};
};
