/**
 * RSS Parser
 * Parses RSS/Atom feeds into events
 */

import type { ScrapedEvent } from '../types';
import { JSDOM } from 'jsdom';

/**
 * Parse RSS/Atom feed content into events
 */
export function parseRssContent(content: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  try {
    const dom = new JSDOM(content, { contentType: 'text/xml' });
    const document = dom.window.document;

    // Try RSS 2.0 format first
    const rssItems = document.querySelectorAll('item');
    if (rssItems.length > 0) {
      rssItems.forEach((item) => {
        const event = parseRssItem(item);
        if (event) events.push(event);
      });
      return events;
    }

    // Try Atom format
    const atomEntries = document.querySelectorAll('entry');
    if (atomEntries.length > 0) {
      atomEntries.forEach((entry) => {
        const event = parseAtomEntry(entry);
        if (event) events.push(event);
      });
      return events;
    }

    console.warn('[RSS Parser] No items or entries found in feed');
  } catch (error) {
    console.error('[RSS Parser] Error parsing feed:', error);
  }

  return events;
}

/**
 * Parse RSS 2.0 item into event
 */
function parseRssItem(item: Element): ScrapedEvent | null {
  const title = item.querySelector('title')?.textContent?.trim();
  if (!title) return null;

  const event: ScrapedEvent = {
    title,
    startDatetime: new Date(),
  };

  // Description
  const description =
    item.querySelector('description')?.textContent?.trim() ||
    item.querySelector('content\\:encoded')?.textContent?.trim();
  if (description) {
    // Strip HTML tags from description
    event.description = description.replace(/<[^>]*>/g, '').trim();
  }

  // Publication date (use as event date)
  const pubDate = item.querySelector('pubDate')?.textContent?.trim();
  if (pubDate) {
    const parsed = new Date(pubDate);
    if (!isNaN(parsed.getTime())) {
      event.startDatetime = parsed;
    }
  }

  // Link
  const link = item.querySelector('link')?.textContent?.trim();
  if (link) {
    event.externalUrl = link;
    event.externalEventId = hashString(link);
  }

  // Try to extract location from custom elements or description
  const location =
    item.querySelector('geo\\:lat, georss\\:point, location')?.textContent?.trim();
  if (location) {
    event.location = location;
  }

  // Categories
  const categories = item.querySelectorAll('category');
  if (categories.length > 0) {
    event.categories = Array.from(categories).map(
      (cat) => cat.textContent?.trim() || ''
    ).filter(Boolean);
  }

  return event;
}

/**
 * Parse Atom entry into event
 */
function parseAtomEntry(entry: Element): ScrapedEvent | null {
  const title = entry.querySelector('title')?.textContent?.trim();
  if (!title) return null;

  const event: ScrapedEvent = {
    title,
    startDatetime: new Date(),
  };

  // Content/Summary
  const content =
    entry.querySelector('content')?.textContent?.trim() ||
    entry.querySelector('summary')?.textContent?.trim();
  if (content) {
    event.description = content.replace(/<[^>]*>/g, '').trim();
  }

  // Published/Updated date
  const published =
    entry.querySelector('published')?.textContent?.trim() ||
    entry.querySelector('updated')?.textContent?.trim();
  if (published) {
    const parsed = new Date(published);
    if (!isNaN(parsed.getTime())) {
      event.startDatetime = parsed;
    }
  }

  // Link (prefer alternate link)
  const links = entry.querySelectorAll('link');
  for (const link of Array.from(links)) {
    const rel = link.getAttribute('rel');
    const href = link.getAttribute('href');
    if (href && (!rel || rel === 'alternate')) {
      event.externalUrl = href;
      event.externalEventId = hashString(href);
      break;
    }
  }

  // ID as fallback for externalEventId
  if (!event.externalEventId) {
    const id = entry.querySelector('id')?.textContent?.trim();
    if (id) {
      event.externalEventId = hashString(id);
    }
  }

  // Categories
  const categories = entry.querySelectorAll('category');
  if (categories.length > 0) {
    event.categories = Array.from(categories).map(
      (cat) => cat.getAttribute('term') || cat.textContent?.trim() || ''
    ).filter(Boolean);
  }

  return event;
}

/**
 * Simple string hash for generating IDs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
