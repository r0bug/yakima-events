/**
 * Collaborative Event Proposal API
 * POST - Create a new collaborative event proposal
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proposeCollaborativeEvent } from '$lib/server/services/collaborativeEvents';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      startDatetime,
      endDatetime,
      location,
      address,
      externalUrl,
      contactInfo,
      primaryShopId,
      participantShopIds,
    } = body;

    // Validation
    if (!title || !startDatetime || !primaryShopId) {
      return json({
        error: 'Title, start datetime, and primary shop are required'
      }, { status: 400 });
    }

    const event = await proposeCollaborativeEvent(
      {
        title,
        description,
        startDatetime: new Date(startDatetime),
        endDatetime: endDatetime ? new Date(endDatetime) : undefined,
        location,
        address,
        externalUrl,
        contactInfo,
        primaryShopId,
        participantShopIds: participantShopIds || [],
      },
      locals.user.id
    );

    return json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        proposalStatus: event.proposalStatus,
        isCollaborative: event.isCollaborative,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating event proposal:', error);
    const message = error instanceof Error ? error.message : 'Failed to create event';
    return json({ error: message }, { status: 400 });
  }
};
