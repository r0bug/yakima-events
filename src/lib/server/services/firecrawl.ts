/**
 * Firecrawl Service
 * Web scraping API integration for enhanced content extraction
 */

import { FIRECRAWL_API_KEY } from '$env/static/private';

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';

interface FirecrawlScrapeOptions {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
}

interface FirecrawlExtractSchema {
  type: string;
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    links?: string[];
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
    };
    extract?: Record<string, unknown>;
  };
  error?: string;
}

interface ScrapedEventData {
  title: string;
  description?: string;
  date?: string;
  time?: string;
  startDatetime?: string;
  endDatetime?: string;
  location?: string;
  address?: string;
  externalUrl?: string;
}

/**
 * Scrape a URL with Firecrawl
 */
export async function scrape(
  url: string,
  options: FirecrawlScrapeOptions = {}
): Promise<FirecrawlResponse | null> {
  if (!FIRECRAWL_API_KEY) {
    console.warn('[Firecrawl] API key not configured');
    return null;
  }

  const defaultOptions: FirecrawlScrapeOptions = {
    formats: ['markdown'],
    onlyMainContent: true,
    excludeTags: ['nav', 'footer', 'header', 'script', 'style', 'aside'],
  };

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        ...defaultOptions,
        ...options,
      }),
    });

    if (!response.ok) {
      console.error(`[Firecrawl] HTTP ${response.status} for ${url}`);
      return null;
    }

    return (await response.json()) as FirecrawlResponse;
  } catch (error) {
    console.error('[Firecrawl] Scrape error:', error);
    return null;
  }
}

/**
 * Extract structured data from a URL
 */
export async function extract(
  url: string,
  schema: FirecrawlExtractSchema
): Promise<FirecrawlResponse | null> {
  if (!FIRECRAWL_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: { schema },
      }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as FirecrawlResponse;
  } catch (error) {
    console.error('[Firecrawl] Extract error:', error);
    return null;
  }
}

/**
 * Search for content using Firecrawl
 */
export async function search(
  query: string,
  options: { limit?: number; location?: boolean } = {}
): Promise<FirecrawlResponse | null> {
  if (!FIRECRAWL_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        limit: options.limit || 10,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as FirecrawlResponse;
  } catch (error) {
    console.error('[Firecrawl] Search error:', error);
    return null;
  }
}

/**
 * Get event extraction schema
 */
export function getEventExtractionSchema(): FirecrawlExtractSchema {
  return {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        description: 'List of events found on the page',
      },
    },
    required: ['events'],
  };
}

/**
 * Parse events from Firecrawl response
 */
export function parseEventsFromResponse(
  response: FirecrawlResponse,
  sourceUrl: string
): ScrapedEventData[] {
  const events: ScrapedEventData[] = [];

  if (!response.success || !response.data) {
    return events;
  }

  // If structured data was extracted
  if (response.data.extract && Array.isArray(response.data.extract.events)) {
    for (const event of response.data.extract.events as Record<string, unknown>[]) {
      events.push(normalizeEventData(event, sourceUrl));
    }
    return events;
  }

  // If markdown content is available, try to parse events from it
  if (response.data.markdown) {
    const parsedEvents = parseEventsFromMarkdown(response.data.markdown, sourceUrl);
    events.push(...parsedEvents);
  }

  return events;
}

/**
 * Parse events from markdown content
 */
function parseEventsFromMarkdown(
  markdown: string,
  sourceUrl: string
): ScrapedEventData[] {
  const events: ScrapedEventData[] = [];

  // Look for common event patterns in markdown
  // Pattern: ## Event Title followed by date/time/location info
  const eventPattern = /^##\s+(.+?)(?:\n|\r\n)(?:.*?(?:date|when|time).*?:?\s*(.+?))?(?:\n|\r\n)?(?:.*?(?:location|where|venue).*?:?\s*(.+?))?/gim;

  let match;
  while ((match = eventPattern.exec(markdown)) !== null) {
    const [, title, dateTime, location] = match;

    if (title && title.trim()) {
      events.push({
        title: title.trim(),
        date: dateTime?.trim(),
        location: location?.trim(),
        externalUrl: sourceUrl,
      });
    }
  }

  // Also look for list-based events
  // Pattern: - **Event Title** - Date - Location
  const listPattern = /^[-*]\s+\*\*(.+?)\*\*(?:\s*[-–—]\s*(.+?))?(?:\s*[-–—]\s*(.+?))?$/gm;

  while ((match = listPattern.exec(markdown)) !== null) {
    const [, title, dateOrLocation, maybeLocation] = match;

    if (title && title.trim()) {
      events.push({
        title: title.trim(),
        date: dateOrLocation?.trim(),
        location: maybeLocation?.trim(),
        externalUrl: sourceUrl,
      });
    }
  }

  return events;
}

/**
 * Normalize event data from various formats
 */
function normalizeEventData(
  data: Record<string, unknown>,
  sourceUrl: string
): ScrapedEventData {
  return {
    title: String(data.title || data.name || 'Untitled Event'),
    description: data.description ? String(data.description) : undefined,
    date: data.date ? String(data.date) : undefined,
    time: data.time ? String(data.time) : undefined,
    startDatetime: data.start_datetime || data.startDatetime
      ? String(data.start_datetime || data.startDatetime)
      : undefined,
    endDatetime: data.end_datetime || data.endDatetime
      ? String(data.end_datetime || data.endDatetime)
      : undefined,
    location: data.location || data.venue
      ? String(data.location || data.venue)
      : undefined,
    address: data.address ? String(data.address) : undefined,
    externalUrl: data.url || data.link
      ? String(data.url || data.link)
      : sourceUrl,
  };
}

/**
 * Check if Firecrawl service is available
 */
export function isAvailable(): boolean {
  return !!FIRECRAWL_API_KEY;
}
