/**
 * Facebook Scraper Service
 * Uses RapidAPI facebook-event-scraper to fetch events from Facebook
 */

import type { ScrapedEvent } from '../scrapers/types';
import { env } from '$env/dynamic/private';

// RapidAPI configuration - Facebook Event Scraper by jerry
const RAPIDAPI_HOST = 'facebook-event-scraper.p.rapidapi.com';

interface FacebookEventResponse {
  id?: string;
  name?: string;
  description?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  formattedDate?: string;
  location?: {
    name?: string;
    description?: string;
    url?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
    countryCode?: string;
    id?: string;
    type?: string;
    address?: string;
    city?: {
      name?: string;
      id?: string;
    };
  };
  photo?: {
    url?: string;
    id?: string;
  };
  video?: unknown;
  eventUrl?: string;
  usersGoing?: number;
  usersInterested?: number;
  hosts?: Array<{
    id?: string;
    name?: string;
    url?: string;
    type?: string;
    photo?: { url?: string };
  }>;
  onlineDetails?: unknown;
  ticketUrl?: string;
  error?: string;
}

interface FacebookConfig {
  eventIds?: string[];
  maxEvents?: number;
}

/**
 * Check if Facebook scraper is available (API key configured)
 */
export function isAvailable(): boolean {
  const apiKey = env.RAPIDAPI_KEY;
  return !!apiKey;
}

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const apiKey = env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Extract event ID from Facebook event URL
 * Handles: https://www.facebook.com/events/1234567890
 *          https://facebook.com/events/1234567890/
 *          https://www.facebook.com/events/1234567890?...
 */
export function extractEventId(url: string): string | null {
  try {
    // Direct event ID (just numbers)
    if (/^\d+$/.test(url.trim())) {
      return url.trim();
    }

    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Match /events/1234567890
    const eventMatch = pathname.match(/\/events\/(\d+)/);
    if (eventMatch) {
      return eventMatch[1];
    }

    return null;
  } catch {
    // If URL parsing fails, check if it's just an event ID
    if (/^\d+$/.test(url.trim())) {
      return url.trim();
    }
    return null;
  }
}

/**
 * Fetch a single event by ID
 */
export async function getEventById(eventId: string): Promise<FacebookEventResponse> {
  const apiKey = getApiKey();

  const url = `https://${RAPIDAPI_HOST}/event?eventid=${eventId}`;

  console.log(`[Facebook] Fetching event: ${eventId}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Facebook] API error: ${response.status} - ${errorText}`);
    throw new Error(`Facebook API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data as FacebookEventResponse;
}

/**
 * Convert Facebook event response to ScrapedEvent format
 */
function convertToScrapedEvent(fbEvent: FacebookEventResponse): ScrapedEvent | null {
  if (!fbEvent.name) {
    return null;
  }

  // Parse start time
  let startDate: Date;
  if (fbEvent.startTimestamp) {
    startDate = new Date(fbEvent.startTimestamp * 1000);
  } else {
    console.warn(`[Facebook] No start time for event: ${fbEvent.name}`);
    return null;
  }

  if (isNaN(startDate.getTime())) {
    console.warn(`[Facebook] Invalid start time for event: ${fbEvent.name}`);
    return null;
  }

  // Parse end time
  let endDate: Date | undefined;
  if (fbEvent.endTimestamp) {
    endDate = new Date(fbEvent.endTimestamp * 1000);
    if (isNaN(endDate.getTime())) {
      endDate = undefined;
    }
  }

  // Build location string
  const location = fbEvent.location?.name || undefined;

  // Build address
  let address: string | undefined;
  if (fbEvent.location) {
    const loc = fbEvent.location;
    const addressParts = [
      loc.address,
      loc.city?.name,
    ].filter(Boolean);
    if (addressParts.length > 0) {
      address = addressParts.join(', ');
    }
  }

  // Build event URL
  const eventUrl = fbEvent.eventUrl || (fbEvent.id ? `https://www.facebook.com/events/${fbEvent.id}` : undefined);

  return {
    title: fbEvent.name,
    description: fbEvent.description || undefined,
    startDatetime: startDate,
    endDatetime: endDate,
    location,
    address,
    latitude: fbEvent.location?.coordinates?.latitude,
    longitude: fbEvent.location?.coordinates?.longitude,
    externalUrl: eventUrl,
    externalEventId: fbEvent.id ? `fb_${fbEvent.id}` : undefined,
  };
}

/**
 * Scrape a single Facebook event by URL or ID
 */
export async function scrapeEvent(eventUrlOrId: string): Promise<ScrapedEvent | null> {
  const eventId = extractEventId(eventUrlOrId);
  if (!eventId) {
    throw new Error(`Could not extract event ID from: ${eventUrlOrId}`);
  }

  const fbEvent = await getEventById(eventId);
  return convertToScrapedEvent(fbEvent);
}

/**
 * Scrape multiple Facebook events by URLs or IDs
 */
export async function scrapeEvents(eventUrlsOrIds: string[]): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];

  for (const urlOrId of eventUrlsOrIds) {
    try {
      const event = await scrapeEvent(urlOrId);
      if (event) {
        events.push(event);
      }
    } catch (error) {
      console.error(`[Facebook] Error scraping event ${urlOrId}:`, error);
    }
  }

  return events;
}

/**
 * Test the Facebook scraper with an event URL or ID
 */
export async function testScraper(eventUrlOrId: string): Promise<{
  success: boolean;
  eventId: string | null;
  event: ScrapedEvent | null;
  rawResponse?: FacebookEventResponse;
  error?: string;
}> {
  const eventId = extractEventId(eventUrlOrId);

  if (!eventId) {
    return {
      success: false,
      eventId: null,
      event: null,
      error: 'Could not extract event ID from URL. Use format: https://www.facebook.com/events/1234567890',
    };
  }

  if (!isAvailable()) {
    return {
      success: false,
      eventId,
      event: null,
      error: 'RAPIDAPI_KEY not configured',
    };
  }

  try {
    const rawResponse = await getEventById(eventId);
    const event = convertToScrapedEvent(rawResponse);

    return {
      success: true,
      eventId,
      event,
      rawResponse,
    };
  } catch (error) {
    return {
      success: false,
      eventId,
      event: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get service status
 */
export function getStatus(): {
  available: boolean;
  apiHost: string;
  hasApiKey: boolean;
} {
  return {
    available: isAvailable(),
    apiHost: RAPIDAPI_HOST,
    hasApiKey: !!env.RAPIDAPI_KEY,
  };
}
