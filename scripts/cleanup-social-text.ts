/**
 * One-time cleanup script: Remove Facebook social context text from event titles, locations, addresses.
 * Run with: npx tsx scripts/cleanup-social-text.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

function cleanFacebookSocialText(text: string | null): string | null {
  if (!text) return text;
  const original = text;

  // "12 interested · 3 going", "1 going", "2 interested"
  text = text.replace(/\d+\s+interested(?:\s*·\s*\d+\s+going)?.*$/i, '').trim();
  text = text.replace(/\d+\s+going.*$/i, '').trim();

  // "Breaunna is interested", "Heather and Kevin are interested"
  text = text.replace(/[A-Z][a-z]+(?:(?:,\s*[A-Z][a-z]+)*\s+and\s+(?:[A-Z][a-z]+|\d+\s+friends?))\s+(?:is|are)\s+interested.*$/i, '').trim();
  text = text.replace(/[A-Z][a-z]+\s+is\s+interested.*$/i, '').trim();
  text = text.replace(/[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+are\s+interested.*$/i, '').trim();
  text = text.replace(/[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*\s+and\s+\d+\s+friends?\s+interested.*$/i, '').trim();

  // Clean trailing commas/spaces
  text = text.replace(/[,\s]+$/, '').trim();

  return text !== original ? text : null; // null means no change needed
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  console.log('Connected to database');

  const [rows] = await conn.execute('SELECT id, title, location, address FROM events WHERE source_id = (SELECT id FROM calendar_sources WHERE name = "Facebook Browser Extension" LIMIT 1)') as any;

  console.log(`Found ${rows.length} Facebook events to check`);

  let fixed = 0;
  for (const row of rows) {
    const titleFix = cleanFacebookSocialText(row.title);
    const locFix = cleanFacebookSocialText(row.location);
    const addrFix = cleanFacebookSocialText(row.address);

    if (titleFix !== null || locFix !== null || addrFix !== null) {
      const sets: string[] = [];
      const vals: any[] = [];

      if (titleFix !== null) { sets.push('title = ?'); vals.push(titleFix); }
      if (locFix !== null) { sets.push('location = ?'); vals.push(locFix); }
      if (addrFix !== null) { sets.push('address = ?'); vals.push(addrFix); }
      vals.push(row.id);

      await conn.execute(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, vals);
      fixed++;

      if (fixed <= 5) {
        console.log(`  Fixed #${row.id}: "${(row.title || '').substring(0, 50)}" -> "${(titleFix || row.title || '').substring(0, 50)}"`);
      }
    }
  }

  console.log(`\nCleaned ${fixed} events`);
  await conn.end();
}

main().catch(console.error);
