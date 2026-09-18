import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { db } from '$lib/server/db';
import { eventImages } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getEventById } from '$lib/server/services/events';
import { formatDayHeadline, formatEventTime } from '$lib/dayShare';

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Break text onto at most `maxLines` lines of roughly `perLine` characters. */
function wrap(text: string, perLine: number, maxLines: number): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let line = '';
	for (const w of words) {
		const candidate = line ? `${line} ${w}` : w;
		if (candidate.length > perLine && line) {
			lines.push(line);
			line = w;
			if (lines.length === maxLines) break;
		} else {
			line = candidate;
		}
	}
	if (lines.length < maxLines && line) lines.push(line);
	if (lines.length === maxLines) {
		const consumed = lines.join(' ').length;
		if (consumed < text.length) {
			lines[maxLines - 1] =
				lines[maxLines - 1].slice(0, Math.max(0, perLine - 1)).trimEnd() + '…';
		}
	}
	return lines;
}

const MIME: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
};

/**
 * Load the event's primary image as a data URI so it can be drawn into the card.
 * Returns null when there is no image, the type is unsupported, or it is too big
 * to embed comfortably.
 */
async function loadArtwork(eventId: number): Promise<string | null> {
	const rows = await db
		.select({ filename: eventImages.filename })
		.from(eventImages)
		.where(and(eq(eventImages.eventId, eventId), eq(eventImages.isPrimary, true)))
		.limit(1);

	const filename = rows[0]?.filename;
	if (!filename) return null;

	// Never let a stored filename walk out of uploads/
	if (filename.includes('..')) return null;

	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	const mime = MIME[ext];
	if (!mime) return null;

	try {
		const buf = await readFile(resolve('uploads', filename));
		if (buf.length > 4_000_000) return null;
		return `data:${mime};base64,${buf.toString('base64')}`;
	} catch {
		return null;
	}
}

/**
 * GET /events/[id]/og.png
 * 1200x630 Open Graph card for one event. When the event has artwork (a poster or
 * flyer), it is drawn whole alongside the details — a portrait flyer used directly
 * as og:image would be cropped to a middle slice by Facebook.
 */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		error(404, 'Not found');
	}

	const event = await getEventById(id);
	if (!event) {
		error(404, 'Not found');
	}

	const artwork = await loadArtwork(id);

	const dateLine = event.startDatetime
		? `${formatDayHeadline(String(event.startDatetime).slice(0, 10))} · ${formatEventTime(String(event.startDatetime))}`
		: 'Yakima Valley';

	const venue = (event.location || event.address || 'Yakima, WA').split(',')[0];

	// First sentence of the description, so the card carries a real detail.
	const summary = (event.description || '')
		.replace(/\s+/g, ' ')
		.trim()
		.split(/(?<=[.!?])\s/)[0] || '';

	const textX = artwork ? 470 : 80;
	const perLine = artwork ? 22 : 26;
	const titleSize = artwork ? 48 : 58;
	const titleLines = wrap(event.title || 'Yakima Valley event', perLine, 3);

	const artworkSvg = artwork
		? `<rect x="48" y="150" width="372" height="410" rx="6" fill="#ffffff" stroke="#e7e5e4" stroke-width="2"/>
	<image x="60" y="162" width="348" height="386" preserveAspectRatio="xMidYMid meet" href="${artwork}" xlink:href="${artwork}"/>`
		: '';

	const titleSvg = titleLines
		.map(
			(line, i) =>
				`<text x="${textX}" y="${250 + i * (titleSize + 10)}" font-family="DejaVu Sans" font-weight="bold" font-size="${titleSize}" fill="#1c1917">${escapeXml(line)}</text>`
		)
		.join('\n\t');

	const venueY = 250 + titleLines.length * (titleSize + 10) + 16;
	const summarySvg = summary
		? wrap(summary, artwork ? 34 : 60, 2)
				.map(
					(line, i) =>
						`<text x="${textX}" y="${venueY + 48 + i * 30}" font-family="DejaVu Sans" font-size="24" fill="#57534e">${escapeXml(line)}</text>`
				)
				.join('\n\t')
		: '';

	const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
	<rect width="${WIDTH}" height="${HEIGHT}" fill="#fffbeb"/>
	<rect width="${WIDTH}" height="120" fill="#d97706"/>
	<rect y="120" width="${WIDTH}" height="6" fill="#92400e"/>
	<text x="80" y="76" font-family="DejaVu Sans" font-weight="bold" font-size="32" fill="#ffffff">YAKIMA VALLEY EVENTS</text>
	${artworkSvg}
	<text x="${textX}" y="196" font-family="DejaVu Sans" font-weight="bold" font-size="28" fill="#b45309">${escapeXml(dateLine)}</text>
	${titleSvg}
	<text x="${textX}" y="${venueY}" font-family="DejaVu Sans" font-size="26" fill="#78716c">${escapeXml(venue)}</text>
	${summarySvg}
	<rect y="${HEIGHT - 70}" width="${WIDTH}" height="70" fill="#1c1917"/>
	<text x="80" y="${HEIGHT - 26}" font-family="DejaVu Sans" font-weight="bold" font-size="26" fill="#fbbf24">yfevents.yakimafinds.com</text>
	<text x="${WIDTH - 80}" y="${HEIGHT - 26}" text-anchor="end" font-family="DejaVu Sans" font-size="22" fill="#e7e5e4">Your local community calendar</text>
</svg>`;

	const png = new Resvg(svg, {
		fitTo: { mode: 'width', value: WIDTH },
		font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
	})
		.render()
		.asPng();

	return new Response(new Uint8Array(png), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=1800',
		},
	});
};
