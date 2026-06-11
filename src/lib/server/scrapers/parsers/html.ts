/**
 * HTML Parser
 * Parses HTML pages into events. Tries schema.org Event JSON-LD first
 * (many event sites embed it and it's far more reliable), then falls
 * back to configured CSS selectors.
 */

import type { ScrapedEvent, ScrapeConfig } from '../types';
import { JSDOM } from 'jsdom';

/**
 * Parse HTML content: JSON-LD first, then configured selectors
 */
export function parseHtmlContent(
  content: string,
  config: ScrapeConfig,
  sourceUrl: string
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  let document: Document;
  try {
    const dom = new JSDOM(content);
    document = dom.window.document;
  } catch (error) {
    console.error('[HTML Parser] Error parsing HTML:', error);
    return events;
  }

  // Structured data beats CSS selectors when present
  const jsonLdEvents = parseJsonLdEvents(document, sourceUrl);
  if (jsonLdEvents.length > 0) {
    console.log(`[HTML Parser] Extracted ${jsonLdEvents.length} events from JSON-LD`);
    return jsonLdEvents;
  }

  const selectors = config.selectors;
  if (!selectors?.eventContainer) {
    console.error('[HTML Parser] No JSON-LD events and no event container selector configured');
    return events;
  }

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

  return events;
}

/**
 * Extract schema.org Event objects from JSON-LD script tags.
 * Handles top-level arrays, @graph wrappers, and ItemList wrappers.
 */
export function parseJsonLdEvents(document: Document, sourceUrl: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  scripts.forEach((script) => {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent || '');
    } catch {
      return; // malformed JSON-LD block — skip
    }

    for (const node of collectJsonLdNodes(data)) {
      const event = jsonLdNodeToEvent(node, sourceUrl);
      if (event && event.externalEventId && !seen.has(event.externalEventId)) {
        seen.add(event.externalEventId);
        events.push(event);
      }
    }
  });

  return events;
}

type JsonLdNode = Record<string, unknown>;

function isEventType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (t) => typeof t === 'string' && (t.endsWith('Event') || t === 'Festival')
  );
}

/**
 * Flatten a parsed JSON-LD document into candidate Event nodes
 */
function collectJsonLdNodes(data: unknown, depth = 0): JsonLdNode[] {
  if (depth > 4 || !data) return [];

  if (Array.isArray(data)) {
    return data.flatMap((item) => collectJsonLdNodes(item, depth + 1));
  }

  if (typeof data !== 'object') return [];
  const node = data as JsonLdNode;

  if (isEventType(node['@type'])) {
    return [node];
  }

  const nested: JsonLdNode[] = [];
  if (node['@graph']) {
    nested.push(...collectJsonLdNodes(node['@graph'], depth + 1));
  }
  if (Array.isArray(node.itemListElement)) {
    for (const li of node.itemListElement) {
      const item = (li as JsonLdNode)?.item ?? li;
      nested.push(...collectJsonLdNodes(item, depth + 1));
    }
  }
  if (node.event) {
    nested.push(...collectJsonLdNodes(node.event, depth + 1));
  }
  return nested;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonLdNodeToEvent(node: JsonLdNode, sourceUrl: string): ScrapedEvent | null {
  const title = typeof node.name === 'string' ? stripHtml(node.name) : '';
  if (!title) return null;

  const startDatetime = node.startDate ? new Date(String(node.startDate)) : null;
  if (!startDatetime || isNaN(startDatetime.getTime())) return null;

  const event: Partial<ScrapedEvent> = { title, startDatetime };

  if (node.endDate) {
    const end = new Date(String(node.endDate));
    if (!isNaN(end.getTime())) event.endDatetime = end;
  }

  if (typeof node.description === 'string') {
    event.description = stripHtml(node.description);
  }

  // location: string | Place | Place[]
  const loc = Array.isArray(node.location) ? node.location[0] : node.location;
  if (typeof loc === 'string') {
    event.location = stripHtml(loc);
  } else if (loc && typeof loc === 'object') {
    const place = loc as JsonLdNode;
    if (typeof place.name === 'string') event.location = stripHtml(place.name);
    const addr = place.address;
    if (typeof addr === 'string') {
      event.address = stripHtml(addr);
    } else if (addr && typeof addr === 'object') {
      const a = addr as JsonLdNode;
      event.address = [a.streetAddress, a.addressLocality, a.addressRegion]
        .filter((part) => typeof part === 'string' && part)
        .join(', ');
    }
    const geo = place.geo as JsonLdNode | undefined;
    if (geo && typeof geo === 'object') {
      const lat = Number(geo.latitude);
      const lng = Number(geo.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        event.latitude = lat;
        event.longitude = lng;
      }
    }
  }

  if (typeof node.url === 'string' && node.url) {
    event.externalUrl = makeAbsoluteUrl(node.url, sourceUrl);
  }

  event.externalEventId = event.externalUrl
    ? hashString(event.externalUrl)
    : hashString(title + startDatetime.toISOString());

  return event as ScrapedEvent;
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
