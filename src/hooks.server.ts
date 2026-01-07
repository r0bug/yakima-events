/**
 * Server Hooks
 *
 * Runs on every request to validate sessions and populate locals
 */

import type { Handle } from '@sveltejs/kit';
import { validateSession, type SessionUser } from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
  // Get session token from cookie
  const sessionToken = event.cookies.get('session');

  // Default to no user
  event.locals.user = null;

  if (sessionToken) {
    // Validate session and get user
    const user = await validateSession(sessionToken);

    if (user) {
      event.locals.user = user;
    } else {
      // Invalid or expired session - clear the cookie
      event.cookies.delete('session', { path: '/' });
    }
  }

  // Continue with request
  const response = await resolve(event);

  return response;
};
