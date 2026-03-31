import { describe, it, expect } from 'vitest';
import { toPacificDatetime, pacificToday, toPacificDate } from './datetime';

describe('toPacificDatetime', () => {
  it('formats a known UTC date as Pacific time', () => {
    // 2026-03-15 20:00:00 UTC = 2026-03-15 13:00:00 PDT (March = DST)
    const date = new Date('2026-03-15T20:00:00Z');
    expect(toPacificDatetime(date)).toBe('2026-03-15 13:00:00');
  });

  it('handles UTC midnight correctly (still previous day in Pacific)', () => {
    // 2026-03-15 00:00:00 UTC = 2026-03-14 17:00:00 PDT
    const date = new Date('2026-03-15T00:00:00Z');
    expect(toPacificDatetime(date)).toBe('2026-03-14 17:00:00');
  });

  it('handles PST (winter) correctly', () => {
    // 2026-01-15 20:00:00 UTC = 2026-01-15 12:00:00 PST (January = no DST)
    const date = new Date('2026-01-15T20:00:00Z');
    expect(toPacificDatetime(date)).toBe('2026-01-15 12:00:00');
  });

  it('handles PDT (summer) correctly', () => {
    // 2026-07-15 20:00:00 UTC = 2026-07-15 13:00:00 PDT
    const date = new Date('2026-07-15T20:00:00Z');
    expect(toPacificDatetime(date)).toBe('2026-07-15 13:00:00');
  });

  it('handles DST spring-forward boundary', () => {
    // 2026 DST starts March 8 at 2am Pacific
    // March 8 2026, 10:30 UTC = 2:30am PST, but clocks spring forward, so it's 3:30am PDT
    const date = new Date('2026-03-08T10:30:00Z');
    expect(toPacificDatetime(date)).toBe('2026-03-08 03:30:00');
  });

  it('handles DST fall-back boundary', () => {
    // 2026 DST ends November 1 at 2am Pacific
    // November 1 2026, 08:30 UTC = 1:30am PDT (before fallback) or 0:30am PST (after)
    // At 08:30 UTC on Nov 1, DST has NOT ended yet (ends at 09:00 UTC / 2am PDT)
    const date = new Date('2026-11-01T08:30:00Z');
    expect(toPacificDatetime(date)).toBe('2026-11-01 01:30:00');
  });
});

describe('pacificToday', () => {
  it('returns start and end of today in Pacific time', () => {
    const { start, end } = pacificToday();
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2} 23:59:59$/);
    // start and end should be the same date
    expect(start.slice(0, 10)).toBe(end.slice(0, 10));
  });
});

describe('toPacificDate', () => {
  it('returns just the date portion', () => {
    const date = new Date('2026-03-15T20:00:00Z');
    expect(toPacificDate(date)).toBe('2026-03-15');
  });

  it('returns previous day when UTC is past midnight but Pacific is not', () => {
    const date = new Date('2026-03-15T05:00:00Z');
    // 5am UTC = 10pm PDT on March 14
    expect(toPacificDate(date)).toBe('2026-03-14');
  });
});
