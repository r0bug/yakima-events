import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEvents, createEvent, getEventCategories } from '$server/services/events';

/**
 * GET /api/events
 * Get events with optional filtering
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const startDate = url.searchParams.get('start_date') || undefined;
    const endDate = url.searchParams.get('end_date') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const featured = url.searchParams.get('featured');
    const search = url.searchParams.get('search') || undefined;
    const latitude = url.searchParams.get('latitude');
    const longitude = url.searchParams.get('longitude');
    const radius = url.searchParams.get('radius');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    const includeUnapproved = url.searchParams.get('include_unapproved') === 'true';

    const filters = {
      startDate,
      endDate,
      category,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      search,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      radius: radius ? parseFloat(radius) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      includeUnapproved,
    };

    const events = await getEvents(filters);

    // Process events for API response
    const processedEvents = events.map(event => ({
      ...event,
      start_datetime: event.startDatetime?.toISOString(),
      end_datetime: event.endDatetime?.toISOString(),
      start_datetime_formatted: event.startDatetime?.toISOString(),
      end_datetime_formatted: event.endDatetime?.toISOString(),
      contact_info: event.contactInfo,
      external_url: event.externalUrl,
      source_name: event.sourceName,
      source_url: event.sourceUrl,
      image_url: event.primaryImageUrl,
      is_unapproved: event.status === 'pending',
    }));

    return json({
      success: true,
      events: processedEvents,
      total: processedEvents.length,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/events
 * Create a new event
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.title || !data.start_datetime) {
      return json(
        { success: false, error: 'Title and start_datetime are required' },
        { status: 400 }
      );
    }

    const eventData = {
      title: data.title,
      description: data.description || null,
      startDatetime: new Date(data.start_datetime),
      endDatetime: data.end_datetime ? new Date(data.end_datetime) : null,
      location: data.location || null,
      address: data.address || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      contactInfo: data.contact_info || null,
      externalUrl: data.external_url || null,
      status: 'pending' as const, // Public submissions require approval
    };

    const eventId = await createEvent(eventData);

    return json({
      success: true,
      message: 'Event submitted successfully and is pending approval',
      event_id: eventId,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return json(
      { success: false, error: 'Failed to create event' },
      { status: 500 }
    );
  }
};
