/**
 * Clean up titles where venue names got concatenated.
 * e.g. "Basic Yoga with MeganGlenwood Square" -> "Basic Yoga with Megan"
 * Run with: npx tsx scripts/cleanup-titles.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

// Known venue names that get stuck to titles
const KNOWN_VENUES = [
  'Glenwood Square',
  'North Town Coffee House',
  'Downtown',
  'Mojo Studio',
  'Capitol Theatre',
  'Warehouse Theatre',
  'Valley Mall',
  'Yakima Valley Pippins',
  'Yakima Valley Museum',
  'Yakima Convention Center',
  'Yakima Convention & Event Center',
  'Wellness House',
  'Emil Kissel Park',
  'Stone Church',
  'Seasons Performance Hall',
  'The Loft',
  'Yakima Athletic Club',
  'West Valley High School',
  'Central Washington',
  'Tin Shed',
];

// Generic pattern: camelCase boundary where venue starts
// "MeganGlenwood" -> split at "Glenwood"
function cleanTitle(title: string): { cleaned: string; venue: string | null } | null {
  // Try known venues first
  for (const venue of KNOWN_VENUES) {
    const idx = title.indexOf(venue);
    if (idx > 0) {
      // Make sure the character before isn't a space (i.e., it's concatenated)
      const charBefore = title[idx - 1];
      if (charBefore !== ' ' && charBefore !== ',' && charBefore !== '-') {
        return {
          cleaned: title.substring(0, idx).trim(),
          venue: venue,
        };
      }
    }
  }

  // Generic: detect lowercase followed by uppercase that starts a multi-word venue
  // But only if the uppercase part looks like a venue name (2+ words, common venue words)
  const match = title.match(/^(.+?[a-z])([A-Z][a-z]+(?:\s+(?:Square|Center|Park|Church|Studio|House|Club|Hall|Museum|Cafe|Bar|Grill|Theatre|Theater|Gallery|Lodge|Inn|Hotel|Brewery|Winery|Room|Lounge|Arena|Field|Court|College|School|Library|Mall|Plaza|Building|Complex|Pavilion).*))$/);
  if (match) {
    return { cleaned: match[1].trim(), venue: match[2].trim() };
  }

  return null;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  const [rows] = await conn.execute('SELECT id, title, location FROM events WHERE status = "approved"') as any;
  console.log(`Checking ${rows.length} events...`);

  let fixed = 0;
  for (const row of rows) {
    const result = cleanTitle(row.title);
    if (result) {
      // Update title, and set location to venue if location is missing or generic
      const updates: string[] = ['title = ?'];
      const values: any[] = [result.cleaned];

      // If location is empty or very generic, set it to the extracted venue
      if (!row.location || row.location.length < 5) {
        updates.push('location = ?');
        values.push(result.venue);
      }

      values.push(row.id);
      await conn.execute(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`, values);

      if (fixed < 10) {
        console.log(`  "${row.title}" -> "${result.cleaned}" (venue: ${result.venue})`);
      }
      fixed++;
    }
  }

  console.log(`\nFixed ${fixed} titles`);
  await conn.end();
}

main().catch(console.error);
