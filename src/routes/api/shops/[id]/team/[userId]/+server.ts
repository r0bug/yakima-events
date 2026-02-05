/**
 * Shop Staff Member API
 * PUT - Update staff member permissions
 * DELETE - Remove staff member
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  removeStaffMember,
  updateStaffPermissions,
  canUserManageStaff,
  type StaffPermissions
} from '$lib/server/services/shopStaff';

export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const shopId = parseInt(params.id);
  const targetUserId = parseInt(params.userId);

  if (isNaN(shopId) || isNaN(targetUserId)) {
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
    const body = await request.json();
    const { role, permissions } = body;

    if (!role || !['admin', 'staff'].includes(role)) {
      return json({ error: 'Valid role is required (admin or staff)' }, { status: 400 });
    }

    const staffPermissions: StaffPermissions = {
      canEditShop: permissions?.canEditShop ?? (role === 'admin'),
      canCreateEvents: permissions?.canCreateEvents ?? true,
      canPostDiscussions: permissions?.canPostDiscussions ?? true,
      canManageStaff: permissions?.canManageStaff ?? (role === 'admin'),
    };

    await updateStaffPermissions(shopId, targetUserId, role, staffPermissions);

    return json({ success: true });
  } catch (error) {
    console.error('Error updating staff permissions:', error);
    const message = error instanceof Error ? error.message : 'Failed to update permissions';
    return json({ error: message }, { status: 400 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const shopId = parseInt(params.id);
  const targetUserId = parseInt(params.userId);

  if (isNaN(shopId) || isNaN(targetUserId)) {
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
    await removeStaffMember(shopId, targetUserId, locals.user.id);
    return json({ success: true });
  } catch (error) {
    console.error('Error removing staff member:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove staff member';
    return json({ error: message }, { status: 400 });
  }
};
