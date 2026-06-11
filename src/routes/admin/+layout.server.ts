/**
 * Admin layout server - protects all admin routes
 */

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Require authentication for all admin routes
  if (!locals.user) {
    const returnUrl = encodeURIComponent(url.pathname + url.search);
    redirect(302, `/login?return=${returnUrl}`);
  }

  // Only admins and moderators may use the admin panel
  if (locals.user.role !== 'admin' && locals.user.role !== 'moderator') {
    redirect(302, '/');
  }

  return {
    user: locals.user,
  };
};
