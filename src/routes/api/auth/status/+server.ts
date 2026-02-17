/**
 * Auth Status API
 * GET /api/auth/status
 *
 * Returns current user authentication status.
 * Replaces the old PHP /api/auth/status.php endpoint.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ authenticated: false, user: null });
  }

  return json({
    authenticated: true,
    user: {
      id: locals.user.id,
      username: locals.user.username,
      email: locals.user.email,
      firstName: locals.user.firstName,
      lastName: locals.user.lastName,
      role: locals.user.role,
      avatarUrl: locals.user.avatarUrl
    }
  });
};
