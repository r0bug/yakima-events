/**
 * Logout Endpoint
 * POST /auth/logout
 *
 * Invalidates the current session and clears cookies
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { invalidateSession } from '$lib/server/auth/session';

export const POST: RequestHandler = async ({ cookies }) => {
  const sessionToken = cookies.get('session');

  if (sessionToken) {
    // Invalidate session in database
    await invalidateSession(sessionToken);
  }

  // Clear session cookie
  cookies.delete('session', { path: '/' });

  // Redirect to home
  throw redirect(302, '/');
};

// Also support GET for simple logout links
export const GET: RequestHandler = async ({ cookies }) => {
  const sessionToken = cookies.get('session');

  if (sessionToken) {
    await invalidateSession(sessionToken);
  }

  cookies.delete('session', { path: '/' });
  throw redirect(302, '/');
};
