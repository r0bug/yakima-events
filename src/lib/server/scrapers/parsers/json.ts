/**
 * JSON Parser
 * Parses JSON API responses into events
 */

import type { ScrapedEvent, ScrapeConfig } from '../types';

/**
 * Parse JSON content using configured field mappings
 */
export function parseJsonContent(
  data: unknown,
  config: ScrapeConfig
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  // Navigate to events array using path (e.g., "data.events" or "results")
  const eventsPath = config.eventsPath || 'events';
  const eventsData = getNestedValue(data, eventsPath);

  if (!Array.isArray(eventsData)) {
    console.error(`[JSON Parser] Events not found at path: ${eventsPath}`);
    return events;
  }

  const mapping = config.fieldMapping || getDefaultMapping();

  for (const item of eventsData) {
    try {
      const event = mapEventFields(item, mapping);
      if (event && event.title && event.startDatetime) {
        events.push(event);
      }
    } catch (error) {
      console.error('[JSON Parser] Error mapping event:', error);
    }
  }

  return events;
}

/**
 * Map JSON fields to event using configured mapping
 */
function mapEventFields(
  data: Record<string, unknown>,
  mapping: Record<string, string>
): ScrapedEvent | null {
  const event: Partial<ScrapedEvent> = {};

  // Map title
  const title = getNestedValue(data, mapping.title || 'title');
  if (!title || typeof title !== 'string') return null;
  event.title = title;

  // Map start datetime
  const startValue = getNestedValue(data, mapping.startDatetime || 'start_datetime');
  if (startValue) {
    const parsed = parseDateTime(startValue);
    if (parsed) {
      event.startDatetime = parsed;
    }
  }

  if (!event.startDatetime) return null;

  // Map optional fields
  if (mapping.description) {
    const desc = getNestedValue(data, mapping.description);
    if (typeof desc === 'string') event.description = desc;
  }

  if (mapping.endDatetime) {
    const end = getNestedValue(data, mapping.endDatetime);
    if (end) {
      const parsed = parseDateTime(end);
      if (parsed) event.endDatetime = parsed;
    }
  }

  if (mapping.location) {
    const loc = getNestedValue(data, mapping.location);
    if (typeof loc === 'string') event.location = loc;
  }

  if (mapping.address) {
    const addr = getNestedValue(data, mapping.address);
    if (typeof addr === 'string') event.address = addr;
  }

  if (mapping.latitude) {
    const lat = getNestedValue(data, mapping.latitude);
    if (typeof lat === 'number') event.latitude = lat;
    else if (typeof lat === 'string') event.latitude = parseFloat(lat);
  }

  if (mapping.longitude) {
    const lng = getNestedValue(data, mapping.longitude);
    if (typeof lng === 'number') event.longitude = lng;
    else if (typeof lng === 'string') event.longitude = parseFloat(lng);
  }

  if (mapping.externalUrl) {
    const url = getNestedValue(data, mapping.externalUrl);
    if (typeof url === 'string') event.externalUrl = url;
  }

  if (mapping.externalEventId) {
    const id = getNestedValue(data, mapping.externalEventId);
    if (id) event.externalEventId = String(id);
  }

  if (mapping.categories) {
    const cats = getNestedValue(data, mapping.categories);
    if (Array.isArray(cats)) {
      event.categories = cats.map(String);
    } else if (typeof cats === 'string') {
      event.categories = [cats];
    }
  }

  return event as ScrapedEvent;
}

/**
 * Get nested value from object using dot notation
 * e.g., "data.events.0.title" -> data.events[0].title
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || !path) return undefined;

  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (value === null || value === undefined) return undefined;

    if (typeof value === 'object') {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Default field mapping for common JSON structures
 */
function getDefaultMapping(): Record<string, string> {
  return {
    title: 'title',
    description: 'description',
    startDatetime: 'start_datetime',
    endDatetime: 'end_datetime',
    location: 'location',
    address: 'address',
    latitude: 'latitude',
    longitude: 'longitude',
    externalUrl: 'url',
    externalEventId: 'id',
  };
}

/**
 * Parse datetime from various formats
 */
function parseDateTime(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    // Unix timestamp (seconds or milliseconds)
    const timestamp = value > 1e12 ? value : value * 1000;
    return new Date(timestamp);
  }

  if (typeof value === 'string') {
    // ISO 8601 or other string format
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}
