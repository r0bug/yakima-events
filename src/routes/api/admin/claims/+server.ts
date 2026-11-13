/**
 * Admin Claims API
 * GET - Get all claims (with optional status filter)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAdminUser } from '$lib/server/api-utils';
import { getAllClaims } from '$lib/server/services/shopClaim';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Claims carry applicants' contact details and approving one grants shop
  // ownership, so this is admin/moderator only (also enforced in hooks.server.ts)
  if (!isAdminUser(locals.user)) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const status = url.searchParams.get('status') || undefined;
    const claims = await getAllClaims(status);

    return json({
      success: true,
      claims,
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    return json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
};
