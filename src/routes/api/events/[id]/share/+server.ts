import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventShareData } from '$lib/server/services/social';

/**
 * GET /api/events/[id]/share
 * Get share links and metadata for an event
 */
export const GET: RequestHandler = async ({ params }) => {
  const eventId = parseInt(params.id);

  if (isNaN(eventId)) {
    return json({ error: 'Invalid event ID' }, { status: 400 });
  }

  try {
    const shareData = await getEventShareData(eventId);

    if (!shareData) {
      return json({ error: 'Event not found' }, { status: 404 });
    }

    return json(shareData);
  } catch (error) {
    console.error('Error getting event share data:', error);
    return json({ error: 'Failed to get share data' }, { status: 500 });
  }
};
