import { describe, it, expect } from 'vitest';
import { extractVenueName } from './venueExtract';

describe('extractVenueName', () => {
  it('extracts venue from "Venue Name, Yakima" format', () => {
    expect(extractVenueName('The Capitol Theatre, Yakima')).toBe('The Capitol Theatre');
  });

  it('extracts venue from "Venue, City, WA Zip" format', () => {
    expect(extractVenueName('Single Hill Brewing Company, Yakima, WA 98901')).toBe('Single Hill Brewing Company');
  });

  it('strips trailing zip codes', () => {
    expect(extractVenueName('Gilbert Cellars 98901')).toBe('Gilbert Cellars');
  });

  it('strips social media junk text', () => {
    expect(extractVenueName('The Seasons 42 interested')).toBe('The Seasons');
    expect(extractVenueName('Boxx Gallery John is interested in this')).toBe('Boxx Gallery');
  });

  it('returns null for generic city names', () => {
    expect(extractVenueName('Yakima')).toBeNull();
    expect(extractVenueName('Selah')).toBeNull();
    expect(extractVenueName('Online')).toBeNull();
    expect(extractVenueName('TBD')).toBeNull();
    expect(extractVenueName('Virtual')).toBeNull();
  });

  it('returns null for pure addresses', () => {
    expect(extractVenueName('123 N Main St')).toBeNull();
    expect(extractVenueName('456 E Yakima Ave')).toBeNull();
  });

  it('returns null for empty/short strings', () => {
    expect(extractVenueName('')).toBeNull();
    expect(extractVenueName('WA')).toBeNull();
    expect(extractVenueName('abc')).toBeNull();
  });

  it('keeps long addresses that might be venue names', () => {
    // Addresses over 60 chars might contain venue info
    const longAddr = '123 N Main St Very Long Name Building Complex Conference Center';
    expect(extractVenueName(longAddr)).not.toBeNull();
  });

  it('handles various Yakima Valley cities', () => {
    expect(extractVenueName('Bale Breaker, Prosser')).toBe('Bale Breaker');
    expect(extractVenueName('Wine Country, Sunnyside, WA')).toBe('Wine Country');
    expect(extractVenueName('Desert Hills, Zillah')).toBe('Desert Hills');
  });
});
