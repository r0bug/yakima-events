/**
 * Shop Invite Management API
 * DELETE - Cancel a pending invite
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  cancelInvite,
  canUserManageStaff,
} from '$lib/server/services/shopStaff';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const shopId = parseInt(params.id);
  const inviteId = parseInt(params.inviteId);

  if (isNaN(shopId) || isNaN(inviteId)) {
    return json({ error: 'Invalid ID' }, { status: 400 });
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
    await cancelInvite(inviteId, shopId);
    return json({ success: true });
  } catch (error) {
    console.error('Error cancelling invite:', error);
    return json({ error: 'Failed to cancel invite' }, { status: 500 });
  }
};
