/**
 * iCal Parser
 * Parses iCal/ICS calendar files into events
 */

import type { ScrapedEvent } from '../types';

interface ICalEvent {
  SUMMARY?: string;
  DESCRIPTION?: string;
  DTSTART?: string;
  DTEND?: string;
  LOCATION?: string;
  URL?: string;
  UID?: string;
  GEO?: string;
}

/**
 * Parse iCal content into events
 */
export function parseICalContent(content: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const lines = content.split(/\r?\n/);
  let currentEvent: ICalEvent | null = null;
  let currentKey = '';
  let currentValue = '';

  for (const line of lines) {
    // Handle line folding (lines starting with space/tab are continuations)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += line.slice(1);
      continue;
    }

    // Process previous key-value pair
    if (currentKey && currentEvent) {
      (currentEvent as Record<string, string>)[currentKey] = currentValue;
    }

    const trimmedLine = line.trim();

    if (trimmedLine === 'BEGIN:VEVENT') {
      currentEvent = {};
      currentKey = '';
      currentValue = '';
      continue;
    }

    if (trimmedLine === 'END:VEVENT' && currentEvent) {
      const event = processICalEvent(currentEvent);
      if (event) {
        events.push(event);
      }
      currentEvent = null;
      currentKey = '';
      currentValue = '';
      continue;
    }

    if (currentEvent !== null && trimmedLine.includes(':')) {
      const colonIndex = trimmedLine.indexOf(':');
      let key = trimmedLine.slice(0, colonIndex);
      const value = trimmedLine.slice(colonIndex + 1);

      // Handle property parameters (e.g., DTSTART;TZID=America/Los_Angeles:...)
      if (key.includes(';')) {
        key = key.split(';')[0];
      }

      currentKey = key;
      currentValue = value;
    }
  }

  return events;
}

/**
 * Process individual iCal event into our format
 */
function processICalEvent(icalEvent: ICalEvent): ScrapedEvent | null {
  const title = cleanICalValue(icalEvent.SUMMARY || '');
  if (!title) return null;

  const startDatetime = parseICalDateTime(icalEvent.DTSTART);
  if (!startDatetime) return null;

  const event: ScrapedEvent = {
    title,
    startDatetime,
  };

  if (icalEvent.DESCRIPTION) {
    event.description = cleanICalValue(icalEvent.DESCRIPTION);
  }

  if (icalEvent.DTEND) {
    event.endDatetime = parseICalDateTime(icalEvent.DTEND) || undefined;
  }

  if (icalEvent.LOCATION) {
    event.location = cleanICalValue(icalEvent.LOCATION);
  }

  if (icalEvent.URL) {
    event.externalUrl = cleanICalValue(icalEvent.URL);
  }

  if (icalEvent.UID) {
    event.externalEventId = cleanICalValue(icalEvent.UID);
  }

  // Parse GEO property (lat;lng format)
  if (icalEvent.GEO) {
    const [lat, lng] = icalEvent.GEO.split(';').map(parseFloat);
    if (!isNaN(lat) && !isNaN(lng)) {
      event.latitude = lat;
      event.longitude = lng;
    }
  }

  return event;
}

/**
 * Clean iCal value (remove escape characters)
 */
function cleanICalValue(value: string): string {
  return value
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/gi, '\n')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Parse iCal datetime format
 * Supports: YYYYMMDD, YYYYMMDDTHHMMSS, YYYYMMDDTHHMMSSZ
 */
function parseICalDateTime(datetime?: string): Date | null {
  if (!datetime) return null;

  // Remove timezone parameter prefix if present
  datetime = datetime.replace(/^.*:/, '');

  // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ format
  const match = datetime.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/);

  if (match) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );

    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try standard date parsing as fallback
  const parsed = new Date(datetime);
  return isNaN(parsed.getTime()) ? null : parsed;
}
