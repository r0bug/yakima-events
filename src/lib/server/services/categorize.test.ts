import { describe, it, expect, vi } from 'vitest';

// matchCategory is pure, but the module also imports the db for the
// save helpers — mock those imports so no connection is needed.
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/schema', () => ({ eventCategories: {}, eventCategoryMapping: {} }));

import { matchCategory } from './categorize';

describe('matchCategory', () => {
  describe('nightlife false positives (real misfiles from June 2026)', () => {
    it('does not file Bible study under nightlife because of "Night" in title', () => {
      expect(matchCategory('Bible Study Every Wednesday Night at 6:30PM', '11107 Wide Hollow Rd, Yakima')).toBe('community');
    });

    it('does not file a craft class under nightlife', () => {
      expect(matchCategory('Polymer Clay Jewelry Night Ages 14+ @ Happily Painted Studio', 'Selah, WA')).toBe('arts-culture');
    });

    it('does not file a baseball game under nightlife', () => {
      expect(matchCategory('Pippintines Date Night! vs Marion Berries', '1301 S. Fair Ave., Yakima')).toBe('sports-fitness');
    });

    it('still catches actual nightlife', () => {
      expect(matchCategory('Ladies Night Featuring Ricky Frezko', '214 E. Yakima Ave.')).toBe('nightlife');
      expect(matchCategory('F.R.I.E.N.D.S. TRIVIA!', '22 N Second Street')).toBe('nightlife');
      expect(matchCategory('Thursday Night Salsa Social @ Mojo Studio', 'Yakima, WA')).toBe('nightlife');
    });
  });

  describe('previously uncategorized titles now match', () => {
    it('qigong is fitness', () => {
      expect(matchCategory('Qigong with Robin', '5110 Tieton Dr.')).toBe('sports-fitness');
    });

    it('hoops is fitness', () => {
      expect(matchCategory('Wayman Chapman Hoops', 'the Boomers Hoops')).toBe('sports-fitness');
    });

    it('punk show is live music', () => {
      expect(matchCategory('Punk Rock Night at the Seasons', 'Yakima, WA')).toBe('live-music');
    });

    it('band-name-only titles stay "other" — these need the LLM pass', () => {
      expect(matchCategory("Diesel Boy With Evelyn's Casket and Take Back", 'Yakima, WA')).toBe('other');
    });

    it('run club is fitness', () => {
      expect(matchCategory('DOWNTOWN YAKIMA RUN CLUB', '26 N 1st st')).toBe('sports-fitness');
    });
  });

  describe('tiered matching', () => {
    it('title match wins over a broader description match', () => {
      // "concert" in title beats "food trucks" in description
      expect(matchCategory('Summer Concert Series', 'Franklin Park', 'Food trucks and beer garden on site')).toBe('live-music');
    });

    it('falls back to description when title and location are generic', () => {
      expect(matchCategory('Summer Bash', 'Yakima, WA', 'Join us for live music and dancing all evening')).toBe('live-music');
    });

    it('returns other when nothing matches', () => {
      expect(matchCategory('XYZ', '')).toBe('other');
    });
  });

  describe('existing rules still work', () => {
    it('estate sale is killer-pick', () => {
      expect(matchCategory('Huge Estate Sale - Everything Must Go')).toBe('killer-pick');
    });

    it('fundraiser beats community', () => {
      expect(matchCategory('Pancake Breakfast Fundraiser')).toBe('fundraiser');
    });

    it('book club is arts, not nightlife', () => {
      expect(matchCategory('Mystery Book Club')).toBe('arts-culture');
    });
  });
});
