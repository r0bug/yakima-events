import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shopStaff, localShops } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login?return=/communication/propose-event');
	}

	// Get user's shops where they can create events
	const userShops = await db
		.select({
			shopId: localShops.id,
			shopName: localShops.name,
		})
		.from(shopStaff)
		.innerJoin(localShops, eq(shopStaff.shopId, localShops.id))
		.where(
			and(
				eq(shopStaff.userId, locals.user.id),
				eq(shopStaff.canCreateEvents, true),
				isNull(shopStaff.revokedAt)
			)
		);

	if (userShops.length === 0) {
		redirect(302, '/communication');
	}

	// Get all active shops for participant selection
	const allShops = await db
		.select({ id: localShops.id, name: localShops.name })
		.from(localShops)
		.where(eq(localShops.status, 'active'));

	return {
		user: locals.user,
		userShops,
		allShops,
	};
};
