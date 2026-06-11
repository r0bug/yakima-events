import { describe, it, expect } from 'vitest';
import { normalizeTitle, titlesMatch, pickMergeUpdates } from './eventMerge';

describe('titlesMatch', () => {
  it('matches identical titles with different punctuation/case', () => {
    expect(titlesMatch("Father's Day 3.2k and Pancake Feed", 'Father’s Day 3.2k and Pancake Feed')).toBe(true);
  });

  it('matches glued venue-name variants (real cross-source pairs)', () => {
    expect(titlesMatch('Echoes of Ashes', 'Echoes of Ashes @ HOOPSHoops')).toBe(true);
    expect(titlesMatch('Kelowna Falcons', 'Kelowna Falcons at Yakima Valley Pippins')).toBe(true);
    expect(titlesMatch('Community Flea Fest', 'Community FLEA FESTLower Naches Community Park')).toBe(true);
  });

  it('does not match short generic titles by containment', () => {
    // "open mic" is contained in many titles but too short to be a match
    expect(titlesMatch('Open Mic', 'Open Mic Comedy Showdown Finals')).toBe(false);
  });

  it('does not match different events', () => {
    expect(titlesMatch('Basic Yoga with Megan', 'Basic Yoga with James')).toBe(false);
  });

  it('normalizeTitle strips punctuation and entities', () => {
    expect(normalizeTitle('Rock &amp; Roll — Night!')).toBe('rock roll night');
  });
});

describe('pickMergeUpdates', () => {
  it('fills only missing fields, never overwrites', () => {
    const updates = pickMergeUpdates(
      { description: 'has one', location: null, address: '', externalUrl: null },
      { description: 'other desc', location: 'The Seasons', address: '101 N Naches Ave', externalUrl: 'https://x.com/e' }
    );
    expect(updates).toEqual({
      location: 'The Seasons',
      address: '101 N Naches Ave',
      externalUrl: 'https://x.com/e',
    });
  });

  it('copies lat/lng together as strings', () => {
    const updates = pickMergeUpdates({ latitude: null }, { latitude: 46.6, longitude: -120.5 });
    expect(updates).toEqual({ latitude: '46.6', longitude: '-120.5' });
  });

  it('returns empty object when nothing to merge', () => {
    expect(pickMergeUpdates({ description: 'a' }, { description: 'b' })).toEqual({});
  });
});
