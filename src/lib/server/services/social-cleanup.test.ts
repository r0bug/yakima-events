import { describe, it, expect } from 'vitest';

/**
 * Test the Facebook social text cleanup logic.
 * This mirrors cleanFacebookSocialText from page-capture/import/+server.ts
 *
 * IMPORTANT: Do NOT use the /i flag on patterns that start with [A-Z][a-z]+
 * because /i makes [a-z] match uppercase too, turning a "proper name" pattern
 * into a "any word" pattern (e.g. "LocationAmber" becomes one match).
 */
function cleanFacebookSocialText(text: string): string {
  if (!text) return text;

  // Pattern 1: "N interested" / "N going" (safe to use /i since starts with \d)
  text = text.replace(/\d+\s+interested(?:\s*·\s*\d+\s+going)?.*$/i, '').trim();
  text = text.replace(/\d+\s+going.*$/i, '').trim();

  // Pattern 2: Names glued without space boundary first (e.g. "WAErik, Connor and 10 friends")
  // This must run before name patterns since the boundary detection splits the text
  text = text.replace(/([a-z.,])([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:\s+and\s+(?:[A-Z][a-z]+|\d+\s+friends?))?(?:\s+(?:is|are)\s+(?:interested|going))?\s*$)/, '$1').trim();

  // Pattern 3: "Name is interested/going" (NO /i flag — must start with proper name)
  text = text.replace(/[A-Z][a-z]+(?:(?:,\s*[A-Z][a-z]+)*\s+and\s+(?:[A-Z][a-z]+|\d+\s+friends?))\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();
  text = text.replace(/[A-Z][a-z]+\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();
  text = text.replace(/[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();

  // Pattern 4: "Name, Name and N friends [interested]" (with or without action word)
  text = text.replace(/[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*\s+and\s+\d+\s+friends?(?:\s+interested)?.*$/, '').trim();

  // Pattern 5: Clean up any trailing punctuation artifacts
  text = text.replace(/[,\s]+$/, '').trim();

  return text;
}

describe('cleanFacebookSocialText', () => {
  it('removes "N interested" pattern', () => {
    expect(cleanFacebookSocialText('Some Event12 interested')).toBe('Some Event');
    expect(cleanFacebookSocialText('Some Event12 interested · 3 going')).toBe('Some Event');
  });

  it('removes "Name is interested" pattern', () => {
    expect(cleanFacebookSocialText('Yakima, WABreaunna is interested')).toBe('Yakima, WA');
  });

  it('removes "Name, Name and N friends" without action word', () => {
    expect(cleanFacebookSocialText('Yakima, YakimaTraci, Connor and 5 friends')).toBe('Yakima, Yakima');
  });

  it('removes names glued without space', () => {
    expect(cleanFacebookSocialText('509 W. Yakima Ave, Yakima, WAErik, Connor and 10 friends')).toBe('509 W. Yakima Ave, Yakima, WA');
  });

  it('removes "Name is going" pattern', () => {
    expect(cleanFacebookSocialText('Some LocationAmber is going')).toBe('Some Location');
  });

  it('removes "Name and Name are going" pattern', () => {
    expect(cleanFacebookSocialText('Some PlaceKelly and Rob are going')).toBe('Some Place');
  });

  it('leaves clean text unchanged', () => {
    expect(cleanFacebookSocialText('Capitol Theatre, Yakima, WA')).toBe('Capitol Theatre, Yakima, WA');
    expect(cleanFacebookSocialText('509 W Yakima Ave')).toBe('509 W Yakima Ave');
  });

  it('handles the exact bad data from event 707', () => {
    const input = 'Yakima, YakimaTraci, Connor and 5 friends';
    const cleaned = cleanFacebookSocialText(input);
    expect(cleaned).not.toContain('Traci');
    expect(cleaned).not.toContain('Connor');
    expect(cleaned).not.toContain('friends');
  });

  it('handles the exact bad data from event 726', () => {
    const input = '509 W. Yakima Ave, Yakima, WAErik, Connor and 10 friends';
    const cleaned = cleanFacebookSocialText(input);
    expect(cleaned).toBe('509 W. Yakima Ave, Yakima, WA');
  });
});
