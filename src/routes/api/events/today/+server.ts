import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTodaysEvents } from '$server/services/events';

/**
 * GET /api/events/today
 * Get today's events
 */
export const GET: RequestHandler = async () => {
  try {
    const events = await getTodaysEvents();

    const processedEvents = events.map(event => ({
      ...event,
      start_datetime: event.startDatetime,
      end_datetime: event.endDatetime,
      start_datetime_formatted: event.startDatetime,
      contact_info: event.contactInfo,
      external_url: event.externalUrl,
      source_name: event.sourceName,
      image_url: event.primaryImageUrl,
    }));

    return json({
      success: true,
      events: processedEvents,
    });
  } catch (error) {
    console.error('Error fetching today\'s events:', error);
    return json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
};
