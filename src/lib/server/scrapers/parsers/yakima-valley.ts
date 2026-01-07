/**
 * Yakima Valley Event Parser
 * Specialized parser for visityakima.com and yakimavalley.org event pages
 */

import type { ScrapedEvent, ScrapeConfig } from '../types';

interface YakimaValleyEvent {
  title: string;
  description?: string;
  startDatetime?: string;
  endDatetime?: string;
  location?: string;
  fullLocation?: string;
  address?: string;
  externalUrl?: string;
  categories?: string[];
}

/**
 * Parse events from Yakima Valley website HTML
 */
export function parseYakimaValleyContent(
  content: string,
  config: ScrapeConfig,
  sourceUrl: string
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const baseUrl = config.baseUrl || new URL(sourceUrl).origin;
  const currentYear = config.year || new Date().getFullYear();

  // Create a simple DOM-like parsing using regex patterns
  // This is a simplified version - the PHP version uses DOMDocument

  // Pattern 1: Look for event cards/containers
  const eventPatterns = [
    // Pattern for typical event listing
    /<div[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    // Pattern for article elements
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    // Pattern for list items with event data
    /<li[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
  ];

  // Try to find structured event data first (JSON-LD)
  const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdPattern.exec(content)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      const ldEvents = extractFromJsonLd(jsonData, baseUrl);
      events.push(...ldEvents);
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  // If we found events from JSON-LD, return those
  if (events.length > 0) {
    return events;
  }

  // Otherwise, try HTML parsing
  // Look for common event patterns in the HTML

  // Pattern: Date headers followed by event info
  const dateHeaderPattern = /(?:<h[2-4][^>]*>|<div[^>]*class="[^"]*date[^"]*"[^>]*>)([\w\s,]+\d{1,2}[^<]*?)(?:<\/h[2-4]>|<\/div>)/gi;
  const dateMatches: { date: string; position: number }[] = [];

  while ((match = dateHeaderPattern.exec(content)) !== null) {
    const dateStr = match[1].trim();
    if (isValidDateString(dateStr)) {
      dateMatches.push({ date: dateStr, position: match.index });
    }
  }

  // Look for event titles and details
  const eventTitlePattern = /<(?:h[1-6]|a|strong|b)[^>]*(?:class="[^"]*(?:title|name|event)[^"]*")?[^>]*>([^<]{3,100})<\/(?:h[1-6]|a|strong|b)>/gi;
  const locationPattern = /(?:at|location|venue|where)[:.\s]+([^<\n]{3,100})/gi;
  const timePattern = /(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?(?:\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?)?)/gi;

  // Extract event blocks based on common patterns
  const eventBlockPattern = /<(?:div|article|section)[^>]*class="[^"]*(?:event|listing|item)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|section)>/gi;

  while ((match = eventBlockPattern.exec(content)) !== null) {
    const block = match[1];
    const event = extractEventFromBlock(block, baseUrl, currentYear);
    if (event && event.title) {
      events.push(event);
    }
  }

  // If still no events, try a more lenient approach
  if (events.length === 0) {
    const genericEvents = extractGenericEvents(content, baseUrl, currentYear);
    events.push(...genericEvents);
  }

  return events;
}

/**
 * Extract events from JSON-LD structured data
 */
function extractFromJsonLd(jsonData: unknown, baseUrl: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  if (!jsonData) return events;

  // Handle array of events
  if (Array.isArray(jsonData)) {
    for (const item of jsonData) {
      const extracted = extractSingleJsonLdEvent(item, baseUrl);
      if (extracted) events.push(extracted);
    }
    return events;
  }

  // Handle single event or @graph
  const data = jsonData as Record<string, unknown>;

  if (data['@graph'] && Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const extracted = extractSingleJsonLdEvent(item, baseUrl);
      if (extracted) events.push(extracted);
    }
    return events;
  }

  // Check if this is an event type
  const type = data['@type'];
  if (type === 'Event' || (Array.isArray(type) && type.includes('Event'))) {
    const extracted = extractSingleJsonLdEvent(data, baseUrl);
    if (extracted) events.push(extracted);
  }

  return events;
}

/**
 * Extract single event from JSON-LD object
 */
function extractSingleJsonLdEvent(
  data: unknown,
  baseUrl: string
): ScrapedEvent | null {
  if (!data || typeof data !== 'object') return null;

  const event = data as Record<string, unknown>;
  const type = event['@type'];

  if (type !== 'Event' && !(Array.isArray(type) && type.includes('Event'))) {
    return null;
  }

  const title = String(event.name || event.headline || '');
  if (!title) return null;

  let startDatetime: Date | undefined;
  let endDatetime: Date | undefined;

  if (event.startDate) {
    startDatetime = new Date(String(event.startDate));
  }
  if (event.endDate) {
    endDatetime = new Date(String(event.endDate));
  }

  if (!startDatetime || isNaN(startDatetime.getTime())) {
    return null;
  }

  let location = '';
  let address = '';

  if (event.location && typeof event.location === 'object') {
    const loc = event.location as Record<string, unknown>;
    location = String(loc.name || '');

    if (loc.address && typeof loc.address === 'object') {
      const addr = loc.address as Record<string, unknown>;
      address = [
        addr.streetAddress,
        addr.addressLocality,
        addr.addressRegion,
        addr.postalCode,
      ]
        .filter(Boolean)
        .join(', ');
    } else if (typeof loc.address === 'string') {
      address = loc.address;
    }
  } else if (typeof event.location === 'string') {
    location = event.location;
  }

  let externalUrl = '';
  if (event.url) {
    externalUrl = String(event.url);
    if (!externalUrl.startsWith('http')) {
      externalUrl = baseUrl + (externalUrl.startsWith('/') ? '' : '/') + externalUrl;
    }
  }

  return {
    title,
    description: event.description ? String(event.description) : undefined,
    startDatetime,
    endDatetime,
    location,
    address,
    externalUrl,
    externalEventId: event['@id'] ? String(event['@id']) : undefined,
  };
}

/**
 * Extract event from HTML block
 */
function extractEventFromBlock(
  block: string,
  baseUrl: string,
  currentYear: number
): ScrapedEvent | null {
  // Extract title
  const titleMatch = block.match(/<(?:h[1-6]|a|strong)[^>]*>([^<]{3,100})<\/(?:h[1-6]|a|strong)>/i);
  if (!titleMatch) return null;

  const title = decodeHtmlEntities(titleMatch[1].trim());
  if (!title || title.length < 3) return null;

  // Extract date/time
  const dateTimeMatch = block.match(/(\w+\s+\d{1,2}(?:,?\s*\d{4})?(?:\s+at\s+\d{1,2}:\d{2}\s*(?:am|pm)?)?)/i);
  let startDatetime: Date | undefined;

  if (dateTimeMatch) {
    const dateStr = dateTimeMatch[1];
    startDatetime = parseFlexibleDate(dateStr, currentYear);
  }

  if (!startDatetime) {
    // Try to find any date pattern
    const anyDateMatch = block.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);
    if (anyDateMatch) {
      startDatetime = new Date(anyDateMatch[1]);
    }
  }

  if (!startDatetime || isNaN(startDatetime.getTime())) {
    return null;
  }

  // Extract location
  const locationMatch = block.match(/(?:at|location|venue|@)\s*:?\s*([^<\n]{3,100})/i);
  const location = locationMatch ? decodeHtmlEntities(locationMatch[1].trim()) : undefined;

  // Extract URL
  const urlMatch = block.match(/href="([^"]+)"/i);
  let externalUrl = '';
  if (urlMatch) {
    externalUrl = urlMatch[1];
    if (!externalUrl.startsWith('http')) {
      externalUrl = baseUrl + (externalUrl.startsWith('/') ? '' : '/') + externalUrl;
    }
  }

  // Extract description
  const descMatch = block.match(/<p[^>]*>([^<]{10,500})<\/p>/i);
  const description = descMatch ? decodeHtmlEntities(descMatch[1].trim()) : undefined;

  return {
    title,
    description,
    startDatetime,
    location,
    externalUrl,
  };
}

/**
 * Generic event extraction for less structured pages
 */
function extractGenericEvents(
  content: string,
  baseUrl: string,
  currentYear: number
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  // Look for patterns like "Event Name - Date"
  const simplePattern = /(?:<a[^>]*href="([^"]*)"[^>]*>)?([A-Z][^<]{5,80})(?:<\/a>)?\s*[-–]\s*(\w+\s+\d{1,2}(?:,?\s*\d{4})?)/gi;
  let match;

  while ((match = simplePattern.exec(content)) !== null) {
    const [, url, title, dateStr] = match;
    const startDatetime = parseFlexibleDate(dateStr, currentYear);

    if (startDatetime && !isNaN(startDatetime.getTime())) {
      let externalUrl = url || '';
      if (externalUrl && !externalUrl.startsWith('http')) {
        externalUrl = baseUrl + (externalUrl.startsWith('/') ? '' : '/') + externalUrl;
      }

      events.push({
        title: decodeHtmlEntities(title.trim()),
        startDatetime,
        externalUrl,
      });
    }
  }

  return events;
}

/**
 * Parse flexible date formats
 */
function parseFlexibleDate(dateStr: string, defaultYear: number): Date | undefined {
  // Clean up the string
  dateStr = dateStr.trim().replace(/\s+/g, ' ');

  // Try native parsing first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    // If no year was in the string and date is in the past, assume next year
    if (!dateStr.match(/\d{4}/) && date < new Date()) {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date;
  }

  // Try adding year if missing
  if (!dateStr.match(/\d{4}/)) {
    date = new Date(`${dateStr} ${defaultYear}`);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try common formats
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const monthAbbr = monthNames.map((m) => m.substring(0, 3));

  const monthDayMatch = dateStr.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i);
  if (monthDayMatch) {
    const [, month, day, year] = monthDayMatch;
    const monthLower = month.toLowerCase();
    let monthIndex = monthNames.indexOf(monthLower);
    if (monthIndex === -1) {
      monthIndex = monthAbbr.indexOf(monthLower);
    }

    if (monthIndex !== -1) {
      const parsedYear = year ? parseInt(year) : defaultYear;
      return new Date(parsedYear, monthIndex, parseInt(day));
    }
  }

  return undefined;
}

/**
 * Check if string looks like a valid date
 */
function isValidDateString(str: string): boolean {
  const datePatterns = [
    /\w+\s+\d{1,2}/i, // "January 15" or "Jan 15"
    /\d{1,2}\/\d{1,2}/i, // "1/15" or "01/15"
    /\d{4}-\d{2}-\d{2}/, // "2024-01-15"
  ];

  return datePatterns.some((pattern) => pattern.test(str));
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export default {
  parseYakimaValleyContent,
};
