import { describe, it, expect } from 'vitest';
import { toPacificDatetime } from '$server/datetime';

/**
 * Tests for the "tonight" date boundary logic used by getTonightEvents().
 * We test the boundary computation directly since the DB query can't be
 * unit-tested without a live database.
 */

function computeTonightBounds(nowUtc: Date) {
  const nowPacific = toPacificDatetime(nowUtc);
  const todayDate = nowPacific.slice(0, 10);
  const hour = parseInt(nowPacific.slice(11, 13), 10);

  const startStr = hour >= 5 ? nowPacific : `${todayDate} 00:00:00`;
  const endStr = `${todayDate} 23:59:59`;

  return { startStr, endStr, hour, todayDate };
}

describe('tonight date boundaries', () => {
  it('at 8pm Pacific, "tonight" starts from now', () => {
    // 8pm PDT = 3am UTC next day
    const now = new Date('2026-07-15T03:00:00Z');
    const { startStr, endStr, todayDate } = computeTonightBounds(now);

    expect(todayDate).toBe('2026-07-14');
    expect(startStr).toBe('2026-07-14 20:00:00');
    expect(endStr).toBe('2026-07-14 23:59:59');
  });

  it('at 2pm Pacific, "tonight" starts from now', () => {
    // 2pm PDT = 9pm UTC same day
    const now = new Date('2026-07-14T21:00:00Z');
    const { startStr, endStr } = computeTonightBounds(now);

    expect(startStr).toBe('2026-07-14 14:00:00');
    expect(endStr).toBe('2026-07-14 23:59:59');
  });

  it('at 3am Pacific (late night), "tonight" starts from midnight', () => {
    // 3am PDT = 10am UTC
    const now = new Date('2026-07-15T10:00:00Z');
    const { startStr, endStr, todayDate } = computeTonightBounds(now);

    expect(todayDate).toBe('2026-07-15');
    expect(startStr).toBe('2026-07-15 00:00:00');
    expect(endStr).toBe('2026-07-15 23:59:59');
  });

  it('at 4:59am Pacific (late night), uses midnight start', () => {
    // 4:59am PDT = 11:59am UTC
    const now = new Date('2026-07-15T11:59:00Z');
    const { startStr, hour } = computeTonightBounds(now);

    expect(hour).toBe(4);
    expect(startStr).toMatch(/00:00:00$/);
  });

  it('at 5:00am Pacific, starts from now (not midnight)', () => {
    // 5:00am PDT = 12:00pm UTC
    const now = new Date('2026-07-15T12:00:00Z');
    const { startStr, hour } = computeTonightBounds(now);

    expect(hour).toBe(5);
    expect(startStr).toBe('2026-07-15 05:00:00');
  });

  it('handles PST (winter) correctly', () => {
    // 8pm PST = 4am UTC next day (UTC-8 in winter)
    const now = new Date('2026-01-16T04:00:00Z');
    const { startStr, endStr, todayDate } = computeTonightBounds(now);

    expect(todayDate).toBe('2026-01-15');
    expect(startStr).toBe('2026-01-15 20:00:00');
    expect(endStr).toBe('2026-01-15 23:59:59');
  });
});
