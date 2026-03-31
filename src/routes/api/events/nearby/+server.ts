import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNearbyEvents } from '$server/services/events';
import { formatEventResponse } from '$server/api-format';

/**
 * GET /api/events/nearby
 * Get events near a location
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const latitude = url.searchParams.get('latitude');
    const longitude = url.searchParams.get('longitude');
    const radius = url.searchParams.get('radius');

    if (!latitude || !longitude) {
      return json(
        { success: false, error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusMiles = radius ? parseFloat(radius) : 10;

    if (isNaN(lat) || isNaN(lng)) {
      return json(
        { success: false, error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    const events = await getNearbyEvents(lat, lng, radiusMiles);

    return json({
      success: true,
      events: events.map(formatEventResponse),
    });
  } catch (error) {
    console.error('Error fetching nearby events:', error);
    return json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
};
