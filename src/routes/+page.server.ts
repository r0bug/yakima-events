import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { toPacificDatetime } from '$lib/server/datetime';

export const load: PageServerLoad = async () => {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const fmt = (d: Date) => toPacificDatetime(d);
  const todayStartStr = fmt(now).slice(0, 10) + ' 00:00:00';
  const tomorrowStartStr = fmt(new Date(now.getTime() + dayMs)).slice(0, 10) + ' 00:00:00';
  const tomorrowEndStr = fmt(new Date(now.getTime() + 2 * dayMs)).slice(0, 10) + ' 00:00:00';
  const weekEndStr = fmt(new Date(now.getTime() + 7 * dayMs)).slice(0, 10) + ' 00:00:00';
  const monthEndStr = fmt(new Date(now.getTime() + 30 * dayMs)).slice(0, 10) + ' 00:00:00';

  const [counts] = await db.execute(sql`
    SELECT
      SUM(CASE WHEN start_datetime >= ${todayStartStr} AND start_datetime < ${tomorrowStartStr} THEN 1 ELSE 0 END) as today,
      SUM(CASE WHEN start_datetime >= ${tomorrowStartStr} AND start_datetime < ${tomorrowEndStr} THEN 1 ELSE 0 END) as tomorrow,
      SUM(CASE WHEN start_datetime >= ${todayStartStr} AND start_datetime < ${weekEndStr} THEN 1 ELSE 0 END) as week,
      SUM(CASE WHEN start_datetime >= ${todayStartStr} AND start_datetime < ${monthEndStr} THEN 1 ELSE 0 END) as month
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
