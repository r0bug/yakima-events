import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { sql, and, gte, lte, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEnd = new Date(todayStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

  const [counts] = await db.execute(sql`
    SELECT
      SUM(CASE WHEN start_datetime >= ${fmt(todayStart)} AND start_datetime < ${fmt(tomorrowStart)} THEN 1 ELSE 0 END) as today,
      SUM(CASE WHEN start_datetime >= ${fmt(tomorrowStart)} AND start_datetime < ${fmt(tomorrowEnd)} THEN 1 ELSE 0 END) as tomorrow,
      SUM(CASE WHEN start_datetime >= ${fmt(todayStart)} AND start_datetime < ${fmt(weekEnd)} THEN 1 ELSE 0 END) as week,
      SUM(CASE WHEN start_datetime >= ${fmt(todayStart)} AND start_datetime < ${fmt(monthEnd)} THEN 1 ELSE 0 END) as month
    FROM events
    WHERE status = 'approved'
  `);

  const row = (counts as Record<string, unknown>[])[0] || {};

  return {
    eventCounts: {
      today: Number(row.today) || 0,
      tomorrow: Number(row.tomorrow) || 0,
      week: Number(row.week) || 0,
      month: Number(row.month) || 0,
    },
  };
};
