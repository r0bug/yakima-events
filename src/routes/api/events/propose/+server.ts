/**
 * Collaborative Event Proposal API
 * POST - Create a new collaborative event proposal
 */

import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { proposeCollaborativeEvent } from '$lib/server/services/collaborativeEvents';

const proposalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(10000).nullable().optional(),
  startDatetime: z.string().min(1, 'Start datetime is required'),
  endDatetime: z.string().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  externalUrl: z.string().url().max(2000).nullable().optional(),
  contactInfo: z.record(z.unknown()).nullable().optional(),
  primaryShopId: z.number().int().positive('Primary shop is required'),
  participantShopIds: z.array(z.number().int().positive()).default([]),
});

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = proposalSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return json({ error: errors }, { status: 400 });
    }

    const data = parsed.data;
    const event = await proposeCollaborativeEvent(
      {
        title: data.title,
        description: data.description,
        startDatetime: new Date(data.startDatetime),
        endDatetime: data.endDatetime ? new Date(data.endDatetime) : undefined,
        location: data.location,
        address: data.address,
        externalUrl: data.externalUrl,
        contactInfo: data.contactInfo,
        primaryShopId: data.primaryShopId,
        participantShopIds: data.participantShopIds,
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
