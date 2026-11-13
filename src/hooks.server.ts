/**
 * Server Hooks
 *
 * Runs on every request to validate sessions and populate locals, and is the
 * single choke point that keeps non-admins out of everything under /admin and
 * /api/admin.
 */

import { json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth/session';
import { isAdminUser } from '$lib/server/api-utils';

/**
 * Which area of the admin surface a request belongs to, if any.
 *
 * Layout `load` functions do NOT protect a page's own `+page.server.ts` load,
 * its form actions, its `__data.json`, or any `+server.ts` - each runs
 * independently. So admin access is decided here, before any of them run.
 * Both the matched route id and the raw path are checked, so a request can
 * not dodge the guard through `__data.json`, a trailing slash or odd casing.
 */
export function adminArea(routeId: string | null, pathname: string): 'api' | 'page' | null {
  const candidates = [routeId || '', pathname.toLowerCase()];
  let area: 'api' | 'page' | null = null;
  for (const p of candidates) {
    if (p === '/api/admin' || p.startsWith('/api/admin/')) return 'api';
    if (p === '/admin' || p.startsWith('/admin/')) area = 'page';
  }
  return area;
}

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

  // Central admin guard: pages, __data.json, form actions and endpoints
  const area = adminArea(event.route.id, event.url.pathname);
  if (area && !isAdminUser(event.locals.user)) {
    if (area === 'api') {
      return event.locals.user
        ? json({ success: false, error: 'Forbidden' }, { status: 403 })
        : json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const wantsHtml = event.request.method === 'GET' || event.isDataRequest;
    if (!event.locals.user) {
      if (wantsHtml) {
        const returnUrl = encodeURIComponent(event.url.pathname + event.url.search);
        redirect(302, `/login?return=${returnUrl}`);
      }
      return json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    // Signed in, but not an admin/moderator
    if (wantsHtml) redirect(302, '/');
    return json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Continue with request
  const response = await resolve(event);

  return response;
};
