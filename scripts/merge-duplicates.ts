/**
 * One-time cross-source duplicate merge.
 *
 * Finds upcoming events that share a start time and a matching title
 * (normalized/containment — see eventMerge.ts), merges missing fields and
 * category mappings into the most complete copy, and rejects the extras
 * so they drop off the public calendar.
 *
 * Run with: npx tsx scripts/merge-duplicates.ts [--dry-run]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { titlesMatch, pickMergeUpdates } from '../src/lib/server/services/eventMerge';

const dryRun = process.argv.includes('--dry-run');

function filledCount(e: Record<string, unknown>): number {
  return ['description', 'end_datetime', 'location', 'address', 'latitude', 'external_url']
    .filter((f) => e[f] !== null && e[f] !== undefined && e[f] !== '').length;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  const todayStart =
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles' }).format(new Date()) +
    ' 00:00:00';

  const [rows] = await conn.execute(
    `SELECT id, title, description, start_datetime, end_datetime, location, address,
            latitude, longitude, external_url, source_id, status
     FROM events
     WHERE status IN ('approved', 'pending') AND start_datetime >= ?
     ORDER BY start_datetime, id`,
    [todayStart]
  ) as any;

  console.log(`Scanning ${rows.length} upcoming events for duplicates${dryRun ? ' [DRY RUN]' : ''}`);

  // Group by exact start time
  const byStart = new Map<string, any[]>();
  for (const r of rows) {
    const key = String(r.start_datetime);
    const group = byStart.get(key);
    if (group) group.push(r);
    else byStart.set(key, [r]);
  }

  let clusters = 0;
  let merged = 0;

  for (const group of byStart.values()) {
    if (group.length < 2) continue;

    // Cluster by title similarity within the same start time
    const used = new Set<number>();
    for (let i = 0; i < group.length; i++) {
      if (used.has(group[i].id)) continue;
      const cluster = [group[i]];
      for (let j = i + 1; j < group.length; j++) {
        if (used.has(group[j].id)) continue;
        if (titlesMatch(group[i].title, group[j].title)) {
          cluster.push(group[j]);
          used.add(group[j].id);
        }
      }
      if (cluster.length < 2) continue;

      clusters++;
      // Keeper: most complete record; tie broken by approved status, then lowest id
      cluster.sort((a, b) =>
        filledCount(b) - filledCount(a) ||
        (b.status === 'approved' ? 1 : 0) - (a.status === 'approved' ? 1 : 0) ||
        a.id - b.id
      );
      const keeper = cluster[0];
      const dups = cluster.slice(1);

      console.log(`\n[${String(keeper.start_datetime).slice(0, 16)}] KEEP #${keeper.id} (src ${keeper.source_id}) "${String(keeper.title).slice(0, 60)}"`);

      for (const dup of dups) {
        const updates = pickMergeUpdates(
          { description: keeper.description, endDatetime: keeper.end_datetime, location: keeper.location,
            address: keeper.address, latitude: keeper.latitude, longitude: keeper.longitude, externalUrl: keeper.external_url },
          { description: dup.description, endDatetime: dup.end_datetime, location: dup.location,
            address: dup.address, latitude: dup.latitude, longitude: dup.longitude, externalUrl: dup.external_url }
        );
        console.log(`  merge #${dup.id} (src ${dup.source_id}) "${String(dup.title).slice(0, 60)}"${Object.keys(updates).length ? ' +' + Object.keys(updates).join(',') : ''}`);

        if (!dryRun) {
          if (Object.keys(updates).length > 0) {
            const cols = Object.keys(updates)
              .map((k) => `${k === 'endDatetime' ? 'end_datetime' : k === 'externalUrl' ? 'external_url' : k} = ?`)
              .join(', ');
            await conn.execute(`UPDATE events SET ${cols} WHERE id = ?`, [...Object.values(updates), keeper.id]);
            // refresh keeper so later dups in the cluster don't re-fill
            Object.assign(keeper, {
              description: updates.description ?? keeper.description,
              end_datetime: updates.endDatetime ?? keeper.end_datetime,
              location: updates.location ?? keeper.location,
              address: updates.address ?? keeper.address,
              latitude: updates.latitude ?? keeper.latitude,
              longitude: updates.longitude ?? keeper.longitude,
              external_url: updates.externalUrl ?? keeper.external_url,
            });
          }
          // carry over category mappings, then retire the duplicate
          await conn.execute(
            `INSERT IGNORE INTO event_category_mapping (event_id, category_id)
             SELECT ?, category_id FROM event_category_mapping WHERE event_id = ?`,
            [keeper.id, dup.id]
          );
          await conn.execute(`UPDATE events SET status='rejected' WHERE id = ?`, [dup.id]);
        }
        merged++;
      }
    }
  }

  console.log(`\n${dryRun ? 'Would merge' : 'Merged'} ${merged} duplicates across ${clusters} clusters`);
  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
