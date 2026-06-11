/**
 * Re-apply keyword categorization to existing events.
 *
 * Useful after improving the rules in categorize-rules.ts: every event with
 * zero or one category mapping (i.e. auto-assigned — there was no manual
 * categorization tool before) is re-matched, and the mapping is replaced
 * when the new rules produce a different, non-'other' result.
 *
 * Run with: npx tsx scripts/rekey-categories.ts [--all] [--dry-run]
 *   --all      process full history (default: events from 30 days ago onward)
 *   --dry-run  print planned changes without writing
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { matchCategory } from '../src/lib/server/services/categorize-rules';

async function main() {
  const processAll = process.argv.includes('--all');
  const dryRun = process.argv.includes('--dry-run');

  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  const [catRows] = await conn.execute('SELECT id, slug FROM event_categories') as any;
  const slugToId: Record<string, number> = {};
  const idToSlug: Record<number, string> = {};
  for (const c of catRows) {
    slugToId[c.slug] = c.id;
    idToSlug[c.id] = c.slug;
  }

  const dateFilter = processAll ? '' : "AND e.start_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
  const [events] = await conn.execute(`
    SELECT e.id, e.title, e.location, e.description,
           COUNT(ecm.category_id) AS cat_count,
           MAX(ecm.category_id) AS only_cat
    FROM events e
    LEFT JOIN event_category_mapping ecm ON e.id = ecm.event_id
    WHERE e.status = 'approved' ${dateFilter}
    GROUP BY e.id, e.title, e.location, e.description
    HAVING cat_count <= 1
    ORDER BY e.id
  `) as any;

  console.log(`Checking ${events.length} events (${processAll ? 'full history' : 'recent/upcoming'})${dryRun ? ' [DRY RUN]' : ''}`);

  let changed = 0;
  const tally: Record<string, number> = {};

  for (const e of events) {
    const currentSlug = e.only_cat ? idToSlug[e.only_cat] : null;
    const newSlug = matchCategory(e.title || '', e.location || undefined, e.description || undefined);

    // Never downgrade an existing assignment to 'other'
    if (newSlug === currentSlug || (newSlug === 'other' && currentSlug)) continue;

    const newId = slugToId[newSlug];
    if (!newId) continue;

    console.log(`  #${e.id} ${String(e.title).slice(0, 60)} : ${currentSlug || '(none)'} -> ${newSlug}`);
    tally[`${currentSlug || '(none)'} -> ${newSlug}`] = (tally[`${currentSlug || '(none)'} -> ${newSlug}`] || 0) + 1;

    if (!dryRun) {
      if (e.only_cat) {
        await conn.execute(
          'DELETE FROM event_category_mapping WHERE event_id = ? AND category_id = ?',
          [e.id, e.only_cat]
        );
      }
      await conn.execute(
        'INSERT IGNORE INTO event_category_mapping (event_id, category_id) VALUES (?, ?)',
        [e.id, newId]
      );
    }
    changed++;
  }

  console.log(`\n${dryRun ? 'Would change' : 'Changed'} ${changed} of ${events.length} events`);
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  await conn.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
