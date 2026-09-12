import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { Resvg } from '@resvg/resvg-js';
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

/** Break a title onto at most `maxLines` lines of roughly `perLine` characters. */
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
		const last = lines[maxLines - 1];
		const consumed = lines.join(' ').length;
		if (consumed < text.length) {
			lines[maxLines - 1] = last.slice(0, Math.max(0, perLine - 1)).trimEnd() + '…';
		}
	}
	return lines;
}

/**
 * GET /events/[id]/og.png
 * 1200x630 Open Graph card for a single event, used when the event has no photo
 * of its own so shared links still arrive with something readable.
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

	const dateLine = event.startDatetime
		? `${formatDayHeadline(String(event.startDatetime).slice(0, 10))} · ${formatEventTime(String(event.startDatetime))}`
		: 'Yakima Valley';

	const titleLines = wrap(event.title || 'Yakima Valley event', 26, 3);
	const venue = (event.location || event.address || 'Yakima, WA').split(',')[0];

	const titleSvg = titleLines
		.map(
			(line, i) =>
				`<text x="80" y="${268 + i * 68}" font-family="DejaVu Sans" font-weight="bold" font-size="58" fill="#1c1917">${escapeXml(line)}</text>`
		)
		.join('\n\t');

	const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
	<rect width="${WIDTH}" height="${HEIGHT}" fill="#fffbeb"/>
	<rect width="${WIDTH}" height="120" fill="#d97706"/>
	<rect y="120" width="${WIDTH}" height="6" fill="#92400e"/>
	<text x="80" y="76" font-family="DejaVu Sans" font-weight="bold" font-size="32" fill="#ffffff">YAKIMA VALLEY EVENTS</text>
	<text x="80" y="196" font-family="DejaVu Sans" font-weight="bold" font-size="30" fill="#b45309">${escapeXml(dateLine)}</text>
	${titleSvg}
	<text x="80" y="${HEIGHT - 130}" font-family="DejaVu Sans" font-size="30" fill="#78716c">${escapeXml(venue)}</text>
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
