/**
 * User Shops API
 * GET - Get all shops where user is a staff member
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShopsForUser } from '$lib/server/services/shopStaff';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const shops = await getShopsForUser(locals.user.id);
    return json({ success: true, shops });
  } catch (error) {
    console.error('Error fetching user shops:', error);
    return json({ error: 'Failed to fetch shops' }, { status: 500 });
  }
};
