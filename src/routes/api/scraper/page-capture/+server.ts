import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const timestamp = new Date().toISOString();

		// Log what we received for analysis
		console.log(`[PageCapture] ${timestamp} - ${data.type || 'capture'} from ${data.url || 'unknown'}`);

		if (data.events && data.events.length > 0) {
			console.log(`[PageCapture] Found ${data.events.length} events:`);
			data.events.forEach((ev: any, i: number) => {
				console.log(`  ${i + 1}. ${ev.title} | ${ev.startDate || 'no date'} | ${ev.source}`);
			});
		}

		if (data.type === 'dom-report') {
			console.log(`[PageCapture] DOM report - ${data.data?.summary?.totalElements || 0} elements`);
			if (data.data?.repeatingPatterns?.length > 0) {
				console.log(`[PageCapture] Repeating patterns found:`);
				data.data.repeatingPatterns.forEach((p: any, i: number) => {
					console.log(`  ${i + 1}. ${p.childCount} x <${p.childTag}> in <${p.parentTag}> | links:${p.hasLinks} images:${p.hasImages} time:${p.hasTime}`);
					console.log(`     sample: ${p.sampleText?.substring(0, 80)}`);
				});
			}
		}

		// Store the capture for review
		// For now, write to a JSON log file we can review
		const fs = await import('fs');
		const path = await import('path');
		const logDir = path.join(process.cwd(), 'data', 'captures');

		try {
			fs.mkdirSync(logDir, { recursive: true });
		} catch (e) {
			// directory may already exist
		}

		const filename = `capture_${Date.now()}.json`;
		fs.writeFileSync(
			path.join(logDir, filename),
			JSON.stringify({ ...data, _receivedAt: timestamp }, null, 2)
		);

		// If we have detected events, return them for confirmation
		if (data.events && data.events.length > 0) {
			return json({
				success: true,
				message: `Received ${data.events.length} events from ${data.url}`,
				eventsReceived: data.events.length,
				filename: filename
			});
		}

		return json({
			success: true,
			message: `Page capture saved as ${filename}`,
			filename: filename
		});
	} catch (err) {
		console.error('[PageCapture] Error:', err);
		return json({ success: false, error: String(err) }, { status: 500 });
	}
};

// GET endpoint to list recent captures
export const GET: RequestHandler = async ({ url }) => {
	try {
		const fs = await import('fs');
		const path = await import('path');
		const logDir = path.join(process.cwd(), 'data', 'captures');

		try {
			const files = fs.readdirSync(logDir)
				.filter((f: string) => f.endsWith('.json'))
				.sort()
				.reverse()
				.slice(0, 20);

			const captures = files.map((f: string) => {
				const content = JSON.parse(fs.readFileSync(path.join(logDir, f), 'utf-8'));
				return {
					filename: f,
					url: content.url,
					title: content.title,
					type: content.type || 'capture',
					eventCount: content.eventCount || content.events?.length || 0,
					receivedAt: content._receivedAt
				};
			});

			return json({ success: true, captures });
		} catch (e) {
			return json({ success: true, captures: [] });
		}
	} catch (err) {
		return json({ success: false, error: String(err) }, { status: 500 });
	}
};
