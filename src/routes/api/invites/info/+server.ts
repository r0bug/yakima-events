/**
 * Invite Info API
 * GET - Get invite details by token (for display on accept page)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInviteByToken } from '$lib/server/services/shopStaff';

export const GET: RequestHandler = async ({ url }) => {
  const token = url.searchParams.get('token');

  if (!token) {
    return json({ error: 'Token is required' }, { status: 400 });
  }

  try {
    const inviteInfo = await getInviteByToken(token);

    if (!inviteInfo) {
      return json({ error: 'Invalid or expired invite' }, { status: 404 });
    }

    if (inviteInfo.invite.status !== 'pending') {
      return json({ error: 'This invite has already been used or cancelled' }, { status: 400 });
    }

    if (new Date(inviteInfo.invite.expiresAt) < new Date()) {
      return json({ error: 'This invite has expired' }, { status: 400 });
    }

    return json(inviteInfo);
  } catch (error) {
    console.error('Error fetching invite info:', error);
    return json({ error: 'Failed to fetch invite info' }, { status: 500 });
  }
};
