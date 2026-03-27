import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
	const conn = await mysql.createConnection({
		host: process.env.DATABASE_HOST || 'localhost',
		port: parseInt(process.env.DATABASE_PORT || '3306'),
		user: process.env.DATABASE_USER || 'yakima',
		password: process.env.DATABASE_PASSWORD || '',
		database: process.env.DATABASE_NAME || 'yakima_events',
	});

	const [pending] = await conn.execute(
		"SELECT COUNT(*) as cnt FROM events WHERE status = 'pending' AND external_event_id LIKE 'fb_%'"
	);
	console.log(`Found ${(pending as any)[0].cnt} pending Facebook events`);

	const [result] = await conn.execute(
		"UPDATE events SET status = 'approved' WHERE status = 'pending' AND external_event_id LIKE 'fb_%'"
	);
	console.log(`Approved ${(result as any).affectedRows} events`);

	await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
