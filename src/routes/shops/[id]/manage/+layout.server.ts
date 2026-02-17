/**
 * Shop manage layout server - protects all shop management routes
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		const returnUrl = encodeURIComponent(url.pathname + url.search);
		redirect(302, `/login?return=${returnUrl}`);
	}

	return {
		user: locals.user,
	};
};
