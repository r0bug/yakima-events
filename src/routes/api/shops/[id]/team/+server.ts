/**
 * Shop Team API
 * GET - Get all staff members
 * POST - Invite a new staff member
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getShopStaff,
  inviteStaffMember,
  isUserShopStaff,
  canUserManageStaff,
  type StaffPermissions
} from '$lib/server/services/shopStaff';

export const GET: RequestHandler = async ({ params, locals }) => {
  const shopId = parseInt(params.id);

  if (isNaN(shopId)) {
    return json({ error: 'Invalid shop ID' }, { status: 400 });
  }

  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Must be a staff member to view team
  const isStaff = await isUserShopStaff(shopId, locals.user.id);
  if (!isStaff) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const staff = await getShopStaff(shopId);
    return json({ success: true, staff });
  } catch (error) {
    console.error('Error fetching shop staff:', error);
    return json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
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
    const body = await request.json();
    const { email, role, permissions, message } = body;

    if (!email || !role) {
      return json({ error: 'Email and role are required' }, { status: 400 });
    }

    if (!['admin', 'staff'].includes(role)) {
      return json({ error: 'Role must be admin or staff' }, { status: 400 });
    }

    const staffPermissions: StaffPermissions = {
      canEditShop: permissions?.canEditShop ?? (role === 'admin'),
      canCreateEvents: permissions?.canCreateEvents ?? true,
      canPostDiscussions: permissions?.canPostDiscussions ?? true,
      canManageStaff: permissions?.canManageStaff ?? (role === 'admin'),
    };

    const { invite, token } = await inviteStaffMember(
      shopId,
      email,
      role,
      staffPermissions,
      locals.user.id,
      message
    );

    // TODO: Send email with invite link
    const inviteUrl = `/invites/accept?token=${token}`;

    return json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      inviteUrl, // In production, send this via email instead
    }, { status: 201 });
  } catch (error) {
    console.error('Error inviting staff member:', error);
    const message = error instanceof Error ? error.message : 'Failed to invite staff member';
    return json({ error: message }, { status: 400 });
  }
};
