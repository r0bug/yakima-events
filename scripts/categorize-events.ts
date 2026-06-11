/**
 * Auto-categorize events using LLM.
 *
 * Creates categories if they don't exist, then batch-classifies:
 *  - all uncategorized events
 *  - events whose only category is 'other' (keyword matcher gave up) — the
 *    LLM gets a second look and the 'other' mapping is replaced if it finds
 *    a better fit
 *
 * By default only events starting within the last 30 days or in the future
 * are processed. Pass --all to re-process the entire history.
 *
 * Run with: npx tsx scripts/categorize-events.ts [--all]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/anthropic/v1/messages';
const MODEL = 'deepseek-v4-flash';

// Categories with colors that match our warm design system
const CATEGORIES = [
  { name: 'Live Music', slug: 'live-music', color: '#7c3aed', icon: 'music' },
  { name: 'Arts & Culture', slug: 'arts-culture', color: '#db2777', icon: 'palette' },
  { name: 'Food & Drink', slug: 'food-drink', color: '#ea580c', icon: 'utensils' },
  { name: 'Sports & Fitness', slug: 'sports-fitness', color: '#2563eb', icon: 'trophy' },
  { name: 'Community', slug: 'community', color: '#059669', icon: 'users' },
  { name: 'Markets & Sales', slug: 'markets-sales', color: '#ca8a04', icon: 'shopping-bag' },
  { name: 'Family & Kids', slug: 'family-kids', color: '#0d9488', icon: 'heart' },
  { name: 'Education', slug: 'education', color: '#4f46e5', icon: 'book' },
  { name: 'Nightlife', slug: 'nightlife', color: '#c2410c', icon: 'moon' },
  { name: 'Outdoors', slug: 'outdoors', color: '#16a34a', icon: 'tree' },
  { name: 'Holiday', slug: 'holiday', color: '#dc2626', icon: 'star' },
  { name: 'Killer Pick', slug: 'killer-pick', color: '#b45309', icon: 'gem' },
  { name: 'Fundraiser', slug: 'fundraiser', color: '#e11d48', icon: 'gift' },
  { name: 'Other', slug: 'other', color: '#6b7280', icon: 'calendar' },
];

async function callLLM(prompt: string): Promise<string> {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': DEEPSEEK_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      system: 'You categorize events. Reply ONLY with the JSON array requested, no other text.',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.1,
    }),
  });

  const data = await response.json() as any;

  // Anthropic format: text block (after an optional thinking block)
  if (Array.isArray(data.content)) {
    const textBlock = data.content.find((b: any) => b.type === 'text' && b.text);
    if (textBlock) return textBlock.text;
  }
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;

  console.error('Unexpected LLM response:', JSON.stringify(data).substring(0, 500));
  throw new Error('Could not parse LLM response');
}

async function main() {
  if (!DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY not set in .env');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  console.log('Connected to database');

  // Step 1: Create categories if they don't exist
  const [existingCats] = await conn.execute('SELECT COUNT(*) as cnt FROM event_categories') as any;
  if (existingCats[0].cnt === 0) {
    console.log('Creating categories...');
    for (const cat of CATEGORIES) {
      await conn.execute(
        'INSERT INTO event_categories (name, slug, color, icon, active) VALUES (?, ?, ?, ?, 1)',
        [cat.name, cat.slug, cat.color, cat.icon]
      );
    }
    console.log(`Created ${CATEGORIES.length} categories`);
  }

  // Get category IDs
  const [catRows] = await conn.execute('SELECT id, slug FROM event_categories') as any;
  const catMap: Record<string, number> = {};
  catRows.forEach((c: any) => { catMap[c.slug] = c.id; });

  const otherId = catMap['other'];
  const processAll = process.argv.includes('--all');

  // Step 2: Get events needing categorization — never categorized, or
  // parked in 'other' by the keyword matcher (single mapping only, so we
  // don't disturb manually multi-categorized events)
  const dateFilter = processAll ? '' : "AND e.start_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
  const [events] = await conn.execute(`
    SELECT e.id, e.title, e.location, e.description,
           COUNT(ecm.category_id) AS cat_count,
           MAX(ecm.category_id) AS only_cat
    FROM events e
    LEFT JOIN event_category_mapping ecm ON e.id = ecm.event_id
    WHERE e.status = 'approved' ${dateFilter}
    GROUP BY e.id, e.title, e.location, e.description
    HAVING cat_count = 0 OR (cat_count = 1 AND only_cat = ?)
    ORDER BY e.id
  `, [otherId]) as any;

  console.log(`Found ${events.length} events to categorize (uncategorized or 'other'${processAll ? ', full history' : ', recent/upcoming only'})`);

  if (events.length === 0) {
    console.log('Nothing to categorize!');
    await conn.end();
    return;
  }

  // Step 3: Batch categorize in chunks of 50
  const BATCH_SIZE = 50;
  let totalCategorized = 0;
  const slugList = CATEGORIES.map(c => c.slug).join(', ');

  // Events that currently sit in 'other' — their mapping gets replaced
  const hadOther = new Set<number>(
    events.filter((e: any) => Number(e.cat_count) === 1).map((e: any) => e.id)
  );

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);

    // Compact prompt: id|title @ location | description snippet
    const lines = batch.map((e: any) => {
      const loc = e.location ? ` @ ${e.location}` : '';
      const desc = e.description ? ` | ${String(e.description).replace(/\s+/g, ' ').substring(0, 100)}` : '';
      return `${e.id}|${(e.title || '').substring(0, 80)}${loc.substring(0, 40)}${desc}`;
    }).join('\n');

    const prompt = `Categorize each event into exactly ONE category. Categories: ${slugList}

Notes: killer-pick = estate/yard/rummage sales, thrift, antiques. fundraiser = benefit/charity events. Use other ONLY if nothing fits.

Events (id|title @ location | description):
${lines}

Reply with a JSON array of [id, "slug"] pairs. Example: [[123,"live-music"],[456,"food-drink"]]
Only output the JSON array, nothing else.`;

    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(events.length / BATCH_SIZE)} (${batch.length} events)...`);

    try {
      const response = await callLLM(prompt);

      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('  No JSON found in response:', response.substring(0, 200));
        continue;
      }

      const pairs: [number, string][] = JSON.parse(jsonMatch[0]);

      let batchCount = 0;
      for (const [eventId, slug] of pairs) {
        const catId = catMap[slug] || otherId;
        if (!catId) continue;

        // If the event was parked in 'other' and the LLM found a real
        // category, swap the mapping instead of adding a second one
        if (hadOther.has(eventId) && catId !== otherId) {
          await conn.execute(
            'DELETE FROM event_category_mapping WHERE event_id = ? AND category_id = ?',
            [eventId, otherId]
          );
        }
        await conn.execute(
          'INSERT IGNORE INTO event_category_mapping (event_id, category_id) VALUES (?, ?)',
          [eventId, catId]
        );
        batchCount++;
      }

      totalCategorized += batchCount;
      console.log(`  Categorized ${batchCount} events`);

      // Small delay between batches to be nice to the API
      if (i + BATCH_SIZE < events.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`  Batch error:`, err);
    }
  }

  console.log(`\nDone! Categorized ${totalCategorized} of ${events.length} events`);
  await conn.end();
}

main().catch(console.error);
