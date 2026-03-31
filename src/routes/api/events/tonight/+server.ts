import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTonightEvents } from '$server/services/events';

/**
 * GET /api/events/tonight
 *
 * "What's happening tonight in Yakima" — the core product query.
 *
 * Query params:
 *   lat, lng     — optional, enables proximity sorting (Haversine)
 *   radius       — optional, miles, default 50
 *   limit        — optional, default 20
 *   category     — optional, filter by category slug
 *
 * "Tonight" in Pacific time:
 *   After 5am:  now through 23:59 today
 *   Before 5am: 00:00 through 23:59 today
 *
 * Returns: JSON array sorted by distance (if lat/lng) or start_time ASC.
 * Empty array for no results. 400 for invalid params.
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const latParam = url.searchParams.get('lat');
    const lngParam = url.searchParams.get('lng');
    const radiusParam = url.searchParams.get('radius');
    const limitParam = url.searchParams.get('limit');
    const category = url.searchParams.get('category') || undefined;

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (latParam || lngParam) {
      latitude = parseFloat(latParam || '');
      longitude = parseFloat(lngParam || '');
      if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return json({ error: 'invalid lat/lng' }, { status: 400 });
      }
    }

    const radius = radiusParam ? parseFloat(radiusParam) : undefined;
    if (radius != null && (isNaN(radius) || radius <= 0 || radius > 500)) {
      return json({ error: 'invalid radius (must be 1-500 miles)' }, { status: 400 });
    }

    const limit = limitParam ? parseInt(limitParam) : undefined;
    if (limit != null && (isNaN(limit) || limit < 1 || limit > 100)) {
      return json({ error: 'invalid limit (must be 1-100)' }, { status: 400 });
    }

    const events = await getTonightEvents({ latitude, longitude, radius, limit, category });

    const response = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      start_time: event.startDatetime,
      end_time: event.endDatetime,
      location: event.location,
      address: event.address,
      lat: event.latitude ? parseFloat(String(event.latitude)) : null,
      lng: event.longitude ? parseFloat(String(event.longitude)) : null,
      ...(latitude != null && event.distance != null
        ? { distance_miles: Math.round(event.distance * 0.621371 * 10) / 10 }
        : {}),
      source: event.sourceName || null,
      external_url: event.externalUrl || null,
      categories: event.categoryDetails?.map(c => c.name) || [],
      ...(event.latitude && event.longitude
        ? { map_url: `https://maps.google.com/?q=${event.latitude},${event.longitude}` }
        : {}),
    }));

    return json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 min cache
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error fetching tonight events:', error);
    return json({ error: 'internal server error' }, { status: 500 });
  }
};
