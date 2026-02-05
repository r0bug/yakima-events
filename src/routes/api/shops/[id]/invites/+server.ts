/**
 * Shop Invites API
 * GET - Get pending invites
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getPendingInvites,
  canUserManageStaff,
} from '$lib/server/services/shopStaff';

export const GET: RequestHandler = async ({ params, locals }) => {
  const shopId = parseInt(params.id);

  if (isNaN(shopId)) {
    return json({ error: 'Invalid shop ID' }, { status: 400 });
  }

  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Must have manage_staff permission
  const canManage = await canUserManageStaff(shopId, locals.user.id);
  if (!canManage) {
    return json({ error: 'Forbidden - requires manage_staff permission' }, { status: 403 });
  }

  try {
    const invites = await getPendingInvites(shopId);
    return json({ success: true, invites });
  } catch (error) {
    console.error('Error fetching pending invites:', error);
    return json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
};
