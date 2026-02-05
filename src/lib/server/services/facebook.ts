/**
 * Facebook Scraper Service
 * Uses RapidAPI facebook-scraper3 to fetch events from Facebook pages
 */

import type { ScrapedEvent } from '../scrapers/types';
import { env } from '$env/dynamic/private';

// RapidAPI configuration
const RAPIDAPI_HOST = 'facebook-scraper3.p.rapidapi.com';

interface FacebookEvent {
  id?: string;
  name?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  place?: {
    name?: string;
    location?: {
      city?: string;
      street?: string;
      state?: string;
      zip?: string;
      latitude?: number;
      longitude?: number;
    };
  };
  cover?: {
    source?: string;
  };
  event_url?: string;
}

interface FacebookPageEventsResponse {
  events?: FacebookEvent[];
  data?: FacebookEvent[];
  paging?: {
    cursors?: {
      after?: string;
    };
  };
  error?: string;
}

interface FacebookConfig {
  pageId?: string;
  pageUrl?: string;
  includePastEvents?: boolean;
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
 * Extract page ID from various URL formats
 */
export function extractPageId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Handle various Facebook URL formats:
    // https://www.facebook.com/PageName
    // https://www.facebook.com/PageName/events
    // https://www.facebook.com/profile.php?id=123456789
    // https://facebook.com/pages/PageName/123456789

    // Check for profile.php format
    const idParam = urlObj.searchParams.get('id');
    if (idParam) {
      return idParam;
    }

    // Check for /pages/Name/ID format
    const pagesMatch = pathname.match(/\/pages\/[^/]+\/(\d+)/);
    if (pagesMatch) {
      return pagesMatch[1];
    }

    // Standard page name format
    const parts = pathname.split('/').filter(p => p && p !== 'events');
    if (parts.length > 0) {
      return parts[0];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch future events from a Facebook page
 */
export async function getPageEventsFuture(
  pageId: string,
  cursor?: string
): Promise<FacebookPageEventsResponse> {
  const apiKey = getApiKey();

  const url = new URL(`https://${RAPIDAPI_HOST}/page/events/future`);
  url.searchParams.set('page_id', pageId);
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  console.log(`[Facebook] Fetching future events for page: ${pageId}`);

  const response = await fetch(url.toString(), {
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
  return data as FacebookPageEventsResponse;
}

/**
 * Fetch past events from a Facebook page
 */
export async function getPageEventsPast(
  pageId: string,
  cursor?: string
): Promise<FacebookPageEventsResponse> {
  const apiKey = getApiKey();

  const url = new URL(`https://${RAPIDAPI_HOST}/page/events/past`);
  url.searchParams.set('page_id', pageId);
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  console.log(`[Facebook] Fetching past events for page: ${pageId}`);

  const response = await fetch(url.toString(), {
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
  return data as FacebookPageEventsResponse;
}

/**
 * Convert Facebook event to ScrapedEvent format
 */
function convertToScrapedEvent(fbEvent: FacebookEvent, pageUrl: string): ScrapedEvent | null {
  if (!fbEvent.name || !fbEvent.start_time) {
    return null;
  }

  const startDate = new Date(fbEvent.start_time);
  if (isNaN(startDate.getTime())) {
    console.warn(`[Facebook] Invalid start time for event: ${fbEvent.name}`);
    return null;
  }

  let endDate: Date | undefined;
  if (fbEvent.end_time) {
    endDate = new Date(fbEvent.end_time);
    if (isNaN(endDate.getTime())) {
      endDate = undefined;
    }
  }

  // Build location string
  let location = fbEvent.place?.name || undefined;
  let address: string | undefined;

  if (fbEvent.place?.location) {
    const loc = fbEvent.place.location;
    const addressParts = [loc.street, loc.city, loc.state, loc.zip].filter(Boolean);
    if (addressParts.length > 0) {
      address = addressParts.join(', ');
    }
  }

  // Build event URL
  let eventUrl = fbEvent.event_url;
  if (!eventUrl && fbEvent.id) {
    eventUrl = `https://www.facebook.com/events/${fbEvent.id}`;
  }

  return {
    title: fbEvent.name,
    description: fbEvent.description || undefined,
    startDatetime: startDate,
    endDatetime: endDate,
    location,
    address,
    latitude: fbEvent.place?.location?.latitude,
    longitude: fbEvent.place?.location?.longitude,
    externalUrl: eventUrl,
    externalEventId: fbEvent.id ? `fb_${fbEvent.id}` : undefined,
  };
}

/**
 * Scrape events from a Facebook page
 */
export async function scrapePageEvents(
  pageUrl: string,
  config?: FacebookConfig
): Promise<ScrapedEvent[]> {
  const pageId = config?.pageId || extractPageId(pageUrl);
  if (!pageId) {
    throw new Error(`Could not extract page ID from URL: ${pageUrl}`);
  }

  const events: ScrapedEvent[] = [];
  const maxEvents = config?.maxEvents || 50;
  const includePast = config?.includePastEvents || false;

  try {
    // Fetch future events
    console.log(`[Facebook] Scraping future events from page: ${pageId}`);
    let futureResponse = await getPageEventsFuture(pageId);
    let fbEvents = futureResponse.events || futureResponse.data || [];

    for (const fbEvent of fbEvents) {
      const scraped = convertToScrapedEvent(fbEvent, pageUrl);
      if (scraped) {
        events.push(scraped);
      }
      if (events.length >= maxEvents) break;
    }

    // Fetch more pages if available and under limit
    let cursor = futureResponse.paging?.cursors?.after;
    while (cursor && events.length < maxEvents) {
      futureResponse = await getPageEventsFuture(pageId, cursor);
      fbEvents = futureResponse.events || futureResponse.data || [];

      for (const fbEvent of fbEvents) {
        const scraped = convertToScrapedEvent(fbEvent, pageUrl);
        if (scraped) {
          events.push(scraped);
        }
        if (events.length >= maxEvents) break;
      }

      cursor = futureResponse.paging?.cursors?.after;
    }

    // Optionally include past events
    if (includePast && events.length < maxEvents) {
      console.log(`[Facebook] Scraping past events from page: ${pageId}`);
      const pastResponse = await getPageEventsPast(pageId);
      const pastEvents = pastResponse.events || pastResponse.data || [];

      for (const fbEvent of pastEvents) {
        const scraped = convertToScrapedEvent(fbEvent, pageUrl);
        if (scraped) {
          events.push(scraped);
        }
        if (events.length >= maxEvents) break;
      }
    }

    console.log(`[Facebook] Found ${events.length} events from page: ${pageId}`);
    return events;
  } catch (error) {
    console.error(`[Facebook] Error scraping page ${pageId}:`, error);
    throw error;
  }
}

/**
 * Test the Facebook scraper with a page URL
 */
export async function testScraper(pageUrl: string): Promise<{
  success: boolean;
  pageId: string | null;
  eventsFound: number;
  events: ScrapedEvent[];
  error?: string;
}> {
  const pageId = extractPageId(pageUrl);

  if (!pageId) {
    return {
      success: false,
      pageId: null,
      eventsFound: 0,
      events: [],
      error: 'Could not extract page ID from URL',
    };
  }

  if (!isAvailable()) {
    return {
      success: false,
      pageId,
      eventsFound: 0,
      events: [],
      error: 'RAPIDAPI_KEY not configured',
    };
  }

  try {
    const events = await scrapePageEvents(pageUrl, { maxEvents: 10 });
    return {
      success: true,
      pageId,
      eventsFound: events.length,
      events,
    };
  } catch (error) {
    return {
      success: false,
      pageId,
      eventsFound: 0,
      events: [],
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
