import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireScraperAuth } from '$lib/server/auth/scraper-guard';

/** Keep at most this many capture files; oldest are pruned on write */
const MAX_CAPTURE_FILES = 200;

/**
 * POST /api/scraper/page-capture
 * Debug capture from the extension ("Capture Page Content" / "Explore DOM").
 * Writes a file under data/captures, so it is never open to anonymous callers,
 * not even with the legacy extension switch on: admin session or scraper secret.
 */
export const POST: RequestHandler = async (event) => {
	const auth = requireScraperAuth(event);
	if (!auth.ok) return auth.response;
	const { request } = event;

	try {
		const data = await request.json();
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
		}
		const timestamp = new Date().toISOString();

		// Log what we received for analysis
		console.log(`[PageCapture] ${timestamp} - ${data.type || 'capture'} from ${data.url || 'unknown'}`);

		if (Array.isArray(data.events) && data.events.length > 0) {
			console.log(`[PageCapture] Found ${data.events.length} events:`);
			data.events.slice(0, 500).forEach((ev: any, i: number) => {
				console.log(`  ${i + 1}. ${ev?.title} | ${ev?.startDate || 'no date'} | ${ev?.source}`);
			});
		}

		if (data.type === 'dom-report') {
			console.log(`[PageCapture] DOM report - ${data.data?.summary?.totalElements || 0} elements`);
			if (Array.isArray(data.data?.repeatingPatterns) && data.data.repeatingPatterns.length > 0) {
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

		// Bound disk use: drop the oldest captures beyond the cap
		try {
			const old = fs.readdirSync(logDir)
				.filter((f: string) => /^capture_\d+\.json$/.test(f))
				.sort()
				.reverse()
				.slice(MAX_CAPTURE_FILES);
			for (const f of old) fs.unlinkSync(path.join(logDir, f));
		} catch (e) {
			// pruning is best-effort
		}

		// If we have detected events, return them for confirmation
		if (Array.isArray(data.events) && data.events.length > 0) {
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
		return json({ success: false, error: 'Failed to save capture' }, { status: 500 });
	}
};

// GET endpoint to list recent captures (admin session or scraper secret)
export const GET: RequestHandler = async (event) => {
	const auth = requireScraperAuth(event);
	if (!auth.ok) return auth.response;

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
