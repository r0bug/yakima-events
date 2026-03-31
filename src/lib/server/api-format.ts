import type { EventWithDetails } from '$server/services/events';

/**
 * Format an EventWithDetails for public API JSON responses.
 * Maps camelCase Drizzle fields to snake_case for API consumers.
 */
export function formatEventResponse(event: EventWithDetails) {
  return {
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
    category_details: event.categoryDetails || [],
    linked_shop: event.linkedShop || null,
  };
}
