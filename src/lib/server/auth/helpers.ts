/**
 * Auth helpers for route protection
 */

import { redirect, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { isAdminUser } from '$lib/server/api-utils';

/**
 * Require authenticated user
 * Throws redirect to login if not authenticated
 */
export function requireAuth(event: RequestEvent): { id: number; username: string; email: string } {
  if (!event.locals.user) {
    const returnUrl = encodeURIComponent(event.url.pathname + event.url.search);
    redirect(302, `/login?return=${returnUrl}`);
  }
  return event.locals.user;
}

/**
 * Require authenticated user for API routes
 * Returns 401 error if not authenticated
 */
export function requireAuthApi(event: RequestEvent): { id: number; username: string; email: string } {
  if (!event.locals.user) {
    error(401, 'Unauthorized - please sign in');
  }
  return event.locals.user;
}

/**
 * Check if user is admin (role `admin` or `moderator`)
 */
export async function isAdmin(user: { id: number; role?: string | null } | null): Promise<boolean> {
  return isAdminUser(user);
}

/**
 * Require admin role
 * Throws redirect to home if not admin
 */
export async function requireAdmin(event: RequestEvent): Promise<{ id: number; username: string; email: string }> {
  const user = requireAuth(event);
  const admin = await isAdmin(user);

  if (!admin) {
    error(403, 'Forbidden - admin access required');
  }

  return user;
}

/**
 * Require admin role for API routes
 * Returns 403 error if not admin
 */
export async function requireAdminApi(event: RequestEvent): Promise<{ id: number; username: string; email: string }> {
  const user = requireAuthApi(event);
  const admin = await isAdmin(user);

  if (!admin) {
    error(403, 'Forbidden - admin access required');
  }

  return user;
}
