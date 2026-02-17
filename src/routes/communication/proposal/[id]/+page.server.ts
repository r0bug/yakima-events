import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getEventApprovalStatus } from '$lib/server/services/collaborativeEvents';
import { db } from '$lib/server/db';
import { shopStaff } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		redirect(302, `/login?return=/communication/proposal/${params.id}`);
	}

	const eventId = parseInt(params.id);
	if (isNaN(eventId)) {
		error(404, 'Proposal not found');
	}

	try {
		const status = await getEventApprovalStatus(eventId);

		// Get user's shop IDs to determine if they can approve
		const userStaff = await db
			.select({ shopId: shopStaff.shopId })
			.from(shopStaff)
			.where(
				and(
					eq(shopStaff.userId, locals.user.id),
					eq(shopStaff.canCreateEvents, true),
					isNull(shopStaff.revokedAt)
				)
			);

		const userShopIds = new Set(userStaff.map(s => s.shopId));
		const pendingForUser = status.participants.filter(
			p => p.status === 'pending' && userShopIds.has(p.shopId)
		);

		return {
			user: locals.user,
			event: status.event,
			participants: status.participants,
			allApproved: status.allApproved,
			anyRejected: status.anyRejected,
			pendingForUser,
			userShopIds: Array.from(userShopIds),
		};
	} catch (e) {
		error(404, 'Proposal not found');
	}
};
