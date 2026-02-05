import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventById, updateEvent, deleteEvent } from '$server/services/events';

/**
 * GET /api/events/[id]
 * Get a single event by ID
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return json(
        { success: false, error: 'Invalid event ID' },
        { status: 400 }
      );
    }

    const event = await getEventById(id);

    if (!event) {
      return json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Format for API response - dates are stored as Pacific time strings
    const formattedEvent = {
      ...event,
      start_datetime: event.startDatetime,
      end_datetime: event.endDatetime,
      start_datetime_formatted: event.startDatetime,
      end_datetime_formatted: event.endDatetime,
      contact_info: event.contactInfo,
      external_url: event.externalUrl,
      source_name: event.sourceName,
      source_url: event.sourceUrl,
      image_url: event.primaryImageUrl,
      is_unapproved: event.status === 'pending',
    };

    return json({
      success: true,
      event: formattedEvent,
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return json(
      { success: false, error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/events/[id]
 * Update an event
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return json(
        { success: false, error: 'Invalid event ID' },
        { status: 400 }
      );
    }

    const data = await request.json();

    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.start_datetime !== undefined) updateData.startDatetime = new Date(data.start_datetime);
    if (data.end_datetime !== undefined) updateData.endDatetime = data.end_datetime ? new Date(data.end_datetime) : null;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.contact_info !== undefined) updateData.contactInfo = data.contact_info;
    if (data.external_url !== undefined) updateData.externalUrl = data.external_url;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.featured !== undefined) updateData.featured = data.featured;

    const success = await updateEvent(id, updateData);

    if (!success) {
      return json(
        { success: false, error: 'Event not found or no changes made' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: 'Event updated successfully',
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return json(
      { success: false, error: 'Failed to update event' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/events/[id]
 * Delete an event
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return json(
        { success: false, error: 'Invalid event ID' },
        { status: 400 }
      );
    }

    const success = await deleteEvent(id);

    if (!success) {
      return json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return json(
      { success: false, error: 'Failed to delete event' },
      { status: 500 }
    );
  }
};
