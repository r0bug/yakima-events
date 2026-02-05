/**
 * Shop Events API
 * GET - Get all events for a shop
 * POST - Create a new event for the shop
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getEventsForShop,
  getPendingProposalsForShop,
  createShopEvent,
} from '$lib/server/services/collaborativeEvents';
import { isUserShopStaff, canUserCreateEvents } from '$lib/server/services/shopStaff';

export const GET: RequestHandler = async ({ params, locals, url }) => {
  const shopId = parseInt(params.id);

  if (isNaN(shopId)) {
    return json({ error: 'Invalid shop ID' }, { status: 400 });
  }

  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Must be staff to view shop events
  const isStaff = await isUserShopStaff(shopId, locals.user.id);
  if (!isStaff) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const includePending = url.searchParams.get('pending') === 'true';

    const events = await getEventsForShop(shopId);

    let pending: Awaited<ReturnType<typeof getPendingProposalsForShop>> = [];
    if (includePending) {
      pending = await getPendingProposalsForShop(shopId);
    }

    return json({
      success: true,
      events,
      pending,
    });
  } catch (error) {
    console.error('Error fetching shop events:', error);
    return json({ error: 'Failed to fetch events' }, { status: 500 });
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

  // Must have create events permission
  const canCreate = await canUserCreateEvents(shopId, locals.user.id);
  if (!canCreate) {
    return json({ error: 'Forbidden - requires create events permission' }, { status: 403 });
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
    } = body;

    // Validation
    if (!title || !startDatetime) {
      return json({
        error: 'Title and start datetime are required'
      }, { status: 400 });
    }

    const event = await createShopEvent(shopId, locals.user.id, {
      title,
      description,
      startDatetime: new Date(startDatetime),
      endDatetime: endDatetime ? new Date(endDatetime) : undefined,
      location,
      address,
      externalUrl,
      contactInfo,
    });

    return json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shop event:', error);
    const message = error instanceof Error ? error.message : 'Failed to create event';
    return json({ error: message }, { status: 400 });
  }
};
