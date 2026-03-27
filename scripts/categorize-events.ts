/**
 * Auto-categorize events using LLM.
 *
 * Creates categories if they don't exist, then batch-classifies all uncategorized events.
 * Uses Segmind API with Kimi K2 model.
 *
 * Run with: npx tsx scripts/categorize-events.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const SEGMIND_API_KEY = process.env.SEGMIND_API_KEY;
const SEGMIND_BASE_URL = 'https://api.segmind.com/v1/';
const MODEL = 'kimi-k2-instruct-0905';

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
  { name: 'Other', slug: 'other', color: '#6b7280', icon: 'calendar' },
];

async function callLLM(prompt: string): Promise<string> {
  const response = await fetch(`${SEGMIND_BASE_URL}${MODEL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SEGMIND_API_KEY!,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You categorize events. Reply ONLY with the JSON array requested, no other text.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  const data = await response.json() as any;

  // Handle various response formats
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data.content?.[0]?.text) return data.content[0].text;
  if (data.generated_text) return data.generated_text;
  if (data.text) return data.text;
  if (data.output) return data.output;
  if (data.response) return data.response;

  console.error('Unexpected LLM response:', JSON.stringify(data).substring(0, 500));
  throw new Error('Could not parse LLM response');
}

async function main() {
  if (!SEGMIND_API_KEY) {
    console.error('SEGMIND_API_KEY not set in .env');
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

  // Step 2: Get uncategorized events
  const [events] = await conn.execute(`
    SELECT e.id, e.title, e.location, e.description
    FROM events e
    LEFT JOIN event_category_mapping ecm ON e.id = ecm.event_id
    WHERE ecm.event_id IS NULL AND e.status = 'approved'
    ORDER BY e.id
  `) as any;

  console.log(`Found ${events.length} uncategorized events`);

  if (events.length === 0) {
    console.log('Nothing to categorize!');
    await conn.end();
    return;
  }

  // Step 3: Batch categorize in chunks of 50
  const BATCH_SIZE = 50;
  let totalCategorized = 0;
  const slugList = CATEGORIES.map(c => c.slug).join(', ');

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);

    // Build a compact prompt — just ID:title pairs
    const lines = batch.map((e: any) => {
      const loc = e.location ? ` @ ${e.location}` : '';
      return `${e.id}|${(e.title || '').substring(0, 80)}${loc.substring(0, 40)}`;
    }).join('\n');

    const prompt = `Categorize each event into exactly ONE category. Categories: ${slugList}

Events (id|title):
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
        const catId = catMap[slug];
        if (!catId) {
          // Fallback to 'other'
          const otherId = catMap['other'];
          if (otherId) {
            await conn.execute(
              'INSERT IGNORE INTO event_category_mapping (event_id, category_id) VALUES (?, ?)',
              [eventId, otherId]
            );
            batchCount++;
          }
          continue;
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
