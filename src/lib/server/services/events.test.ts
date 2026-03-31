import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toPacificDatetime, pacificToday } from '$server/datetime';

/**
 * These tests verify the date logic used by the events service
 * WITHOUT requiring a database connection. They test the same
 * code paths that getEvents() and getTodaysEvents() use.
 *
 * For full integration tests against a live database, see
 * the TODOS.md notes on setting up a test database.
 */

describe('event date filter construction', () => {
  it('getEvents date filter produces Pacific time strings, not UTC', () => {
    // Simulate what getEvents does with a startDate filter
    // This is the bug: toISOString() returns UTC, but DB stores Pacific
    const utcMidnight = new Date('2026-03-15T00:00:00Z');

    // OLD (buggy): would produce "2026-03-15 00:00:00" (UTC)
    const buggyResult = utcMidnight.toISOString().slice(0, 19).replace('T', ' ');
    expect(buggyResult).toBe('2026-03-15 00:00:00'); // UTC midnight

    // NEW (fixed): produces Pacific time
    const fixedResult = toPacificDatetime(utcMidnight);
    expect(fixedResult).toBe('2026-03-14 17:00:00'); // 5pm Pacific previous day

    // The difference matters: searching for "March 15 events" at UTC midnight
    // should look for March 14 5pm in Pacific-stored data
    expect(buggyResult).not.toBe(fixedResult);
  });

  it('getTodaysEvents boundaries span a full Pacific day', () => {
    const { start, end } = pacificToday();

    // Should be midnight to 23:59:59 on the same Pacific date
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2} 23:59:59$/);
    expect(start.slice(0, 10)).toBe(end.slice(0, 10));
  });

  it('late night UTC query still returns correct Pacific date', () => {
    // 3am UTC = 8pm Pacific previous day (during PDT)
    // This is the exact scenario where the old code broke
    const lateUtc = new Date('2026-07-15T03:00:00Z');

    const pacificStr = toPacificDatetime(lateUtc);
    expect(pacificStr).toBe('2026-07-14 20:00:00');
    // The date portion should be July 14, not July 15
    expect(pacificStr.slice(0, 10)).toBe('2026-07-14');
  });

  it('early morning UTC query returns correct Pacific date', () => {
    // 10am UTC = 3am Pacific (during PDT)
    const earlyUtc = new Date('2026-07-15T10:00:00Z');

    const pacificStr = toPacificDatetime(earlyUtc);
    expect(pacificStr).toBe('2026-07-15 03:00:00');
    expect(pacificStr.slice(0, 10)).toBe('2026-07-15');
  });
});

describe('Haversine distance calculation', () => {
  // The Haversine formula is in raw SQL, so we test the math directly
  function haversineDistanceKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const toRad = (deg: number) => deg * Math.PI / 180;
    return R * Math.acos(
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.cos(toRad(lon2) - toRad(lon1)) +
      Math.sin(toRad(lat1)) * Math.sin(toRad(lat2))
    );
  }

  it('calculates distance between two Yakima points correctly', () => {
    // Downtown Yakima to Union Gap (~5km)
    const dist = haversineDistanceKm(46.6021, -120.5059, 46.5571, -120.4823);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(6);
  });

  it('same point returns zero distance', () => {
    const dist = haversineDistanceKm(46.6021, -120.5059, 46.6021, -120.5059);
    expect(dist).toBeCloseTo(0, 5);
  });

  it('converts miles to km correctly for radius filter', () => {
    const radiusMiles = 10;
    const radiusKm = radiusMiles * 1.60934;
    expect(radiusKm).toBeCloseTo(16.0934, 2);
  });
});
