/**
 * Event Participants API
 * GET - Get event participants and approval status
 * POST - Approve or reject participation for a shop
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getEventApprovalStatus,
  approveShopParticipation,
  rejectShopParticipation,
} from '$lib/server/services/collaborativeEvents';

export const GET: RequestHandler = async ({ params }) => {
  const eventId = parseInt(params.id);

  if (isNaN(eventId)) {
    return json({ error: 'Invalid event ID' }, { status: 400 });
  }

  try {
    const status = await getEventApprovalStatus(eventId);

    return json({
      success: true,
      event: {
        id: status.event.id,
        title: status.event.title,
        status: status.event.status,
        proposalStatus: status.event.proposalStatus,
        isCollaborative: status.event.isCollaborative,
      },
      participants: status.participants,
      allApproved: status.allApproved,
      anyRejected: status.anyRejected,
    });
  } catch (error) {
    console.error('Error fetching event participants:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch participants';
    return json({ error: message }, { status: 400 });
  }
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
  const eventId = parseInt(params.id);

  if (isNaN(eventId)) {
    return json({ error: 'Invalid event ID' }, { status: 400 });
  }

  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { shopId, action } = body;

    if (!shopId || !action || !['approve', 'reject'].includes(action)) {
      return json({
        error: 'Shop ID and valid action (approve/reject) are required'
      }, { status: 400 });
    }

    if (action === 'approve') {
      await approveShopParticipation(eventId, shopId, locals.user.id);
    } else {
      await rejectShopParticipation(eventId, shopId, locals.user.id);
    }

    // Get updated status
    const status = await getEventApprovalStatus(eventId);

    return json({
      success: true,
      message: action === 'approve' ? 'Participation approved' : 'Participation rejected',
      allApproved: status.allApproved,
      eventPublished: status.allApproved && status.event.status === 'approved',
    });
  } catch (error) {
    console.error('Error processing participation:', error);
    const message = error instanceof Error ? error.message : 'Failed to process participation';
    return json({ error: message }, { status: 400 });
  }
};
