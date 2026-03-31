import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTodaysEvents } from '$server/services/events';
import { formatEventResponse } from '$server/api-format';

/**
 * GET /api/events/today
 * Get today's events
 */
export const GET: RequestHandler = async () => {
  try {
    const events = await getTodaysEvents();

    return json({
      success: true,
      events: events.map(formatEventResponse),
    });
  } catch (error) {
    console.error('Error fetching today\'s events:', error);
    return json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
};
