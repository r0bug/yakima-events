/**
 * Admin Claim Management API
 * POST - Approve or reject a claim
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAdminUser } from '$lib/server/api-utils';
import { approveClaim, rejectClaim } from '$lib/server/services/shopClaim';

export const POST: RequestHandler = async ({ params, locals, request }) => {
  const claimId = parseInt(params.id);

  if (isNaN(claimId)) {
    return json({ error: 'Invalid claim ID' }, { status: 400 });
  }

  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Claims carry applicants' contact details and approving one grants shop
  // ownership, so this is admin/moderator only (also enforced in hooks.server.ts)
  if (!isAdminUser(locals.user)) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, notes, reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return json({ error: 'Valid action (approve/reject) is required' }, { status: 400 });
    }

    if (action === 'approve') {
      await approveClaim(claimId, locals.user.username, notes);
      return json({
        success: true,
        message: 'Claim approved. User has been added as shop admin.',
      });
    } else {
      if (!reason) {
        return json({ error: 'Reason is required for rejection' }, { status: 400 });
      }
      await rejectClaim(claimId, locals.user.username, reason);
      return json({
        success: true,
        message: 'Claim rejected.',
      });
    }
  } catch (error) {
    console.error('Error processing claim:', error);
    const message = error instanceof Error ? error.message : 'Failed to process claim';
    return json({ error: message }, { status: 400 });
  }
};
