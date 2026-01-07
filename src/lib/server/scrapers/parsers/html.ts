/**
 * HTML Parser
 * Parses HTML pages into events using CSS selectors
 */

import type { ScrapedEvent, ScrapeConfig } from '../types';
import { JSDOM } from 'jsdom';

/**
 * Parse HTML content using configured selectors
 */
export function parseHtmlContent(
  content: string,
  config: ScrapeConfig,
  sourceUrl: string
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const selectors = config.selectors;

  if (!selectors?.eventContainer) {
    console.error('[HTML Parser] No event container selector configured');
    return events;
  }

  try {
    const dom = new JSDOM(content);
    const document = dom.window.document;

    // Find all event containers
    const eventNodes = document.querySelectorAll(selectors.eventContainer);
    console.log(`[HTML Parser] Found ${eventNodes.length} event containers`);

    eventNodes.forEach((node, index) => {
      try {
        const event = extractEventFromNode(node, selectors, sourceUrl, config);
        if (event && event.title) {
          events.push(event);
        }
      } catch (error) {
        console.error(`[HTML Parser] Error extracting event ${index}:`, error);
      }
    });
  } catch (error) {
    console.error('[HTML Parser] Error parsing HTML:', error);
  }

  return events;
}

/**
 * Extract event data from a DOM node
 */
function extractEventFromNode(
  node: Element,
  selectors: NonNullable<ScrapeConfig['selectors']>,
  sourceUrl: string,
  config: ScrapeConfig
): ScrapedEvent | null {
  const event: Partial<ScrapedEvent> = {};

  // Extract title
  if (selectors.title) {
    const titleEl = node.querySelector(selectors.title);
    if (titleEl) {
      // Try alt attribute first (for images), then text content
      event.title = titleEl.getAttribute('alt') || titleEl.textContent?.trim() || '';
    }
  }

  if (!event.title) return null;

  // Extract description
  if (selectors.description) {
    const descEl = node.querySelector(selectors.description);
    event.description = descEl?.textContent?.trim();
  }

  // Extract datetime
  if (selectors.datetime) {
    const dateEl = node.querySelector(selectors.datetime);
    const dateText = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime');
    if (dateText) {
      const parsed = parseDateTime(dateText, config.year);
      if (parsed) {
        event.startDatetime = parsed;
      }
    }
  }

  // If no datetime found, skip this event
  if (!event.startDatetime) {
    event.startDatetime = new Date(); // Default to now if not found
  }

  // Extract location
  if (selectors.location) {
    const locationEl = node.querySelector(selectors.location);
    event.location = locationEl?.textContent?.trim();
  }

  // Extract URL
  if (selectors.url) {
    const urlEl = node.querySelector(selectors.url);
    if (urlEl) {
      let href = urlEl.getAttribute('href');
      if (href) {
        // Convert relative URLs to absolute
        event.externalUrl = makeAbsoluteUrl(href, sourceUrl, config.baseUrl);
      }
    }
  }

  // Generate external event ID from URL or title
  event.externalEventId = event.externalUrl
    ? hashString(event.externalUrl)
    : hashString(event.title + (event.startDatetime?.toISOString() || ''));

  return event as ScrapedEvent;
}

/**
 * Parse various datetime formats
 */
function parseDateTime(dateString: string, defaultYear?: number): Date | null {
  if (!dateString) return null;

  // Clean up the string
  dateString = dateString.trim();

  // Try standard Date parsing first
  let parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Try common patterns
  const patterns = [
    // "January 15, 2025 7:00 PM"
    /^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})?\s*(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)?$/i,
    // "Jan 15 at 7:00 PM"
    /^([A-Za-z]+)\s+(\d{1,2})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)?$/i,
    // "15 Jan 2025"
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/,
    // "2025-01-15"
    /^(\d{4})-(\d{2})-(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = dateString.match(pattern);
    if (match) {
      try {
        // Use the year from config or current year as default
        const year = defaultYear || new Date().getFullYear();
        parsed = new Date(`${match[0]} ${year}`);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
  }

  // Last resort: try to extract any date-like components
  const timestamp = Date.parse(dateString);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }

  return null;
}

/**
 * Convert relative URL to absolute
 */
function makeAbsoluteUrl(href: string, sourceUrl: string, baseUrl?: string): string {
  if (!href) return '';

  // Already absolute
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  try {
    const base = baseUrl || sourceUrl;
    const url = new URL(href, base);
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Simple string hash for generating IDs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}
