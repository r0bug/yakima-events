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

  // TODO: Add admin role check when user roles are fully implemented
  // For now, any authenticated user can access admin routes
  // In production, check for admin role:
  // if (!locals.user.isAdmin) {
  //   redirect(302, '/');
  // }

  return {
    user: locals.user,
  };
};
