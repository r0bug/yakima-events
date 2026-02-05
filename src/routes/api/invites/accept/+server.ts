/**
 * Accept Invite API
 * POST - Accept a staff invitation
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { acceptInvite } from '$lib/server/services/shopStaff';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized - please sign in first' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return json({ error: 'Invite token is required' }, { status: 400 });
    }

    const staff = await acceptInvite(token, locals.user.id);

    return json({
      success: true,
      staff: {
        id: staff.id,
        shopId: staff.shopId,
        role: staff.role,
      }
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    const message = error instanceof Error ? error.message : 'Failed to accept invite';
    return json({ error: message }, { status: 400 });
  }
};
