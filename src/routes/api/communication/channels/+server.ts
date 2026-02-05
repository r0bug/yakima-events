import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createChannel,
  getPublicChannels,
  getUserChannels,
  searchChannels,
  type CreateChannelInput,
} from '$lib/server/services/communication';

/**
 * GET /api/communication/channels
 * List channels - public channels or user's channels if authenticated
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;
  const search = url.searchParams.get('search');
  const myChannels = url.searchParams.get('my') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    // Search channels
    if (search) {
      const channels = await searchChannels(search, limit);
      return json({ channels });
    }

    // Get user's channels if authenticated and requested
    if (user && myChannels) {
      const includeArchived = url.searchParams.get('archived') === 'true';
      const channels = await getUserChannels(user.id, includeArchived);
      return json({ channels });
    }

    // Get public channels
    const channels = await getPublicChannels(limit, offset);
    return json({ channels });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/communication/channels
 * Create a new channel (requires authentication)
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json() as CreateChannelInput;

    if (!body.name || body.name.trim().length === 0) {
      return json({ error: 'Channel name is required' }, { status: 400 });
    }

    // Validate channel type constraints
    if (body.type === 'event' && !body.eventId) {
      return json(
        { error: 'Event channels require an event ID' },
        { status: 400 }
      );
    }

    if (body.type === 'vendor' && !body.shopId) {
      return json(
        { error: 'Vendor channels require a shop ID' },
        { status: 400 }
      );
    }

    const channel = await createChannel(user.id, body);

    return json({ channel }, { status: 201 });
  } catch (error) {
    console.error('Error creating channel:', error);
    return json(
      { error: 'Failed to create channel' },
      { status: 500 }
    );
  }
};
