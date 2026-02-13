/**
 * Eventbrite Scraper Service
 * Uses RapidAPI eventbrite-scraper to fetch events from Eventbrite
 */

import type { ScrapedEvent } from '../scrapers/types';
import { env } from '$env/dynamic/private';

// RapidAPI configuration - Eventbrite Scraper
const RAPIDAPI_HOST = 'eventbrite-scraper.p.rapidapi.com';

interface EventbriteEventResponse {
  massage?: string; // Note: API has typo "massage" instead of "message"
  event_url?: string;
  organizer_info?: {
    eventTitle?: string;
    displayOrganizationName?: string;
    name?: string;
    url?: string;
  };
  event?: {
    id?: string;
    name?: string;
    url?: string;
    category?: string;
    subcategory?: string;
    format?: string;
    isOnlineEvent?: boolean;
    start?: {
      timezone?: string;
      local?: string;
      utc?: string;
    };
    end?: {
      timezone?: string;
      local?: string;
      utc?: string;
    };
    venue?: {
      country?: string;
      region?: string;
    };
    ageRestriction?: string;
  };
  about?: Array<{
    text?: string;
    type?: string;
    url?: string;
  }>;
  eventMap?: {
    venueAddress?: string;
    venueName?: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
  };
  tickets?: {
    availability?: {
      isFree?: boolean;
      minimumTicketPrice?: {
        display?: string;
        value?: number;
      };
    };
  };
  error?: string;
}

interface EventbriteSearchResult {
  massage?: string;
  events?: EventbriteEventResponse[];
  total_events?: number;
  pages_scraped?: number;
  error?: string;
}

interface EventbriteConfig {
  searchUrl?: string;
  maxPages?: number;
}

/**
 * Check if Eventbrite scraper is available (API key configured)
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
 * Extract event ID from Eventbrite event URL
 * Handles: https://www.eventbrite.com/e/event-name-tickets-1234567890
 */
export function extractEventId(url: string): string | null {
  try {
    // Direct event ID (just numbers)
    if (/^\d+$/.test(url.trim())) {
      return url.trim();
    }

    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Match /e/event-name-tickets-1234567890
    const eventMatch = pathname.match(/\/e\/[^/]+-(\d+)$/);
    if (eventMatch) {
      return eventMatch[1];
    }

    // Match /e/1234567890
    const simpleMatch = pathname.match(/\/e\/(\d+)/);
    if (simpleMatch) {
      return simpleMatch[1];
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
 * Check if URL is a search/listing URL vs a single event
 */
export function isSearchUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Search URLs contain /d/ for directory listings
    return urlObj.pathname.includes('/d/');
  } catch {
    return false;
  }
}

/**
 * Scrape a single event or search results from Eventbrite
 */
export async function scrapeEventbrite(
  inputUrl: string,
  maxPages: number = 3
): Promise<EventbriteEventResponse | EventbriteSearchResult> {
  const apiKey = getApiKey();

  // The API endpoint is just the root path
  const url = `https://${RAPIDAPI_HOST}/`;

  console.log(`[Eventbrite] Scraping: ${inputUrl}`);

  const body: Record<string, unknown> = {
    input_url: inputUrl,
  };

  // Only add max_page_number for search URLs
  if (isSearchUrl(inputUrl)) {
    body.max_page_number = maxPages;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Eventbrite] API error: ${response.status} - ${errorText}`);

    if (response.status === 403) {
      throw new Error('Not subscribed to Eventbrite Scraper API. Please subscribe at RapidAPI.');
    }
    if (response.status === 404) {
      throw new Error('Eventbrite API endpoint not found. The API may have changed.');
    }
    throw new Error(`Eventbrite API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Convert Eventbrite event response to ScrapedEvent format
 */
function convertToScrapedEvent(ebEvent: EventbriteEventResponse): ScrapedEvent | null {
  const eventName = ebEvent.event?.name || ebEvent.organizer_info?.eventTitle;
  if (!eventName) {
    return null;
  }

  // Parse start time
  let startDate: Date;
  if (ebEvent.event?.start?.utc) {
    startDate = new Date(ebEvent.event.start.utc);
  } else if (ebEvent.event?.start?.local) {
    startDate = new Date(ebEvent.event.start.local);
  } else {
    console.warn(`[Eventbrite] No start time for event: ${eventName}`);
    return null;
  }

  if (isNaN(startDate.getTime())) {
    console.warn(`[Eventbrite] Invalid start time for event: ${eventName}`);
    return null;
  }

  // Parse end time
  let endDate: Date | undefined;
  if (ebEvent.event?.end?.utc) {
    endDate = new Date(ebEvent.event.end.utc);
  } else if (ebEvent.event?.end?.local) {
    endDate = new Date(ebEvent.event.end.local);
  }
  if (endDate && isNaN(endDate.getTime())) {
    endDate = undefined;
  }

  // Build description from about section
  let description: string | undefined;
  if (ebEvent.about && ebEvent.about.length > 0) {
    const textParts = ebEvent.about
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => {
        // Strip HTML tags for plain text
        return item.text?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean);
    if (textParts.length > 0) {
      description = textParts.join('\n\n');
    }
  }

  // Build location
  const location = ebEvent.eventMap?.venueName || undefined;
  const address = ebEvent.eventMap?.venueAddress || undefined;

  // Build event URL
  const eventUrl = ebEvent.event?.url || ebEvent.event_url || undefined;

  return {
    title: eventName,
    description,
    startDatetime: startDate,
    endDatetime: endDate,
    location,
    address,
    latitude: ebEvent.eventMap?.location?.latitude,
    longitude: ebEvent.eventMap?.location?.longitude,
    externalUrl: eventUrl,
    externalEventId: ebEvent.event?.id ? `eb_${ebEvent.event.id}` : undefined,
  };
}

/**
 * Scrape a single Eventbrite event by URL
 */
export async function scrapeEvent(eventUrl: string): Promise<ScrapedEvent | null> {
  const response = await scrapeEventbrite(eventUrl);
  return convertToScrapedEvent(response as EventbriteEventResponse);
}

/**
 * Search and scrape multiple Eventbrite events from a search URL
 */
export async function scrapeSearchResults(
  searchUrl: string,
  maxPages: number = 3
): Promise<ScrapedEvent[]> {
  const response = await scrapeEventbrite(searchUrl, maxPages);
  const events: ScrapedEvent[] = [];

  // If it's a search result with multiple events
  const searchResult = response as EventbriteSearchResult;
  if (searchResult.events && Array.isArray(searchResult.events)) {
    for (const ebEvent of searchResult.events) {
      const event = convertToScrapedEvent(ebEvent);
      if (event) {
        events.push(event);
      }
    }
  } else {
    // Single event response
    const event = convertToScrapedEvent(response as EventbriteEventResponse);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Test the Eventbrite scraper with a URL
 */
export async function testScraper(inputUrl: string, maxPages: number = 3): Promise<{
  success: boolean;
  isSearchUrl: boolean;
  eventsFound: number;
  events: ScrapedEvent[];
  rawResponse?: EventbriteEventResponse | EventbriteSearchResult;
  error?: string;
}> {
  if (!isAvailable()) {
    return {
      success: false,
      isSearchUrl: false,
      eventsFound: 0,
      events: [],
      error: 'RAPIDAPI_KEY not configured',
    };
  }

  try {
    const isSearch = isSearchUrl(inputUrl);
    const rawResponse = await scrapeEventbrite(inputUrl, maxPages);

    let events: ScrapedEvent[] = [];

    if (isSearch) {
      const searchResult = rawResponse as EventbriteSearchResult;
      if (searchResult.events && Array.isArray(searchResult.events)) {
        for (const ebEvent of searchResult.events) {
          const event = convertToScrapedEvent(ebEvent);
          if (event) {
            events.push(event);
          }
        }
      }
    } else {
      const event = convertToScrapedEvent(rawResponse as EventbriteEventResponse);
      if (event) {
        events.push(event);
      }
    }

    return {
      success: true,
      isSearchUrl: isSearch,
      eventsFound: events.length,
      events,
      rawResponse,
    };
  } catch (error) {
    return {
      success: false,
      isSearchUrl: isSearchUrl(inputUrl),
      eventsFound: 0,
      events: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build an Eventbrite search URL for a location
 */
export function buildSearchUrl(
  location: string,
  options: {
    category?: string;
    dateFilter?: 'today' | 'tomorrow' | 'this-week' | 'this-weekend' | 'this-month';
    page?: number;
  } = {}
): string {
  // Format: https://www.eventbrite.com/d/wa--yakima/events--today/
  const locationSlug = location.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let url = `https://www.eventbrite.com/d/${locationSlug}/`;

  const pathParts: string[] = [];

  if (options.dateFilter) {
    pathParts.push(`events--${options.dateFilter}`);
  }

  if (options.category) {
    pathParts.push(options.category);
  }

  if (pathParts.length > 0) {
    url += pathParts.join('/') + '/';
  }

  if (options.page && options.page > 1) {
    url += `?page=${options.page}`;
  }

  return url;
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
