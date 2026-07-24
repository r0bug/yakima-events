import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { Resvg } from '@resvg/resvg-js';
import { getEvents } from '$lib/server/services/events';
import { formatDayHeadline, formatEventTime, isValidDateParam } from '$lib/dayShare';

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_ROWS = 7;

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function truncate(s: string, max: number): string {
	return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/**
 * GET /day/[date]/og.png
 * 1200x630 Open Graph card listing the day's events, for rich link previews.
 */
export const GET: RequestHandler = async ({ params }) => {
	const date = params.date;
	if (!isValidDateParam(date)) {
		error(404, 'Not found');
	}

	const events = await getEvents({
		startDate: `${date} 00:00:00`,
		endDate: `${date} 23:59:59`,
		status: 'approved',
	});

	const headline = formatDayHeadline(date);
	const rows = events.slice(0, MAX_ROWS);
	const overflow = events.length - rows.length;

	const rowsSvg = rows
		.map((e, i) => {
			const y = 218 + i * 46;
			const time = escapeXml(formatEventTime(e.startDatetime));
			const title = escapeXml(truncate(e.title, 58));
			const venue = e.location ? escapeXml(truncate(` — ${e.location.split(',')[0]}`, 34)) : '';
			return `
	<text x="80" y="${y}" font-family="DejaVu Sans" font-weight="bold" font-size="24" fill="#d97706">${time}</text>
	<text x="240" y="${y}" font-family="DejaVu Sans" font-size="24" fill="#1c1917">${title}<tspan fill="#78716c" font-size="20">${venue}</tspan></text>`;
		})
		.join('');

	const overflowSvg =
		overflow > 0
			? `<text x="240" y="${218 + rows.length * 46}" font-family="DejaVu Sans" font-style="italic" font-size="22" fill="#78716c">…and ${overflow} more</text>`
			: '';

	const emptySvg =
		rows.length === 0
			? `<text x="80" y="300" font-family="DejaVu Sans" font-size="30" fill="#78716c">Check the calendar for upcoming events</text>`
			: '';

	const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
	<rect width="${WIDTH}" height="${HEIGHT}" fill="#fffbeb"/>
	<rect width="${WIDTH}" height="130" fill="#d97706"/>
	<rect y="130" width="${WIDTH}" height="6" fill="#92400e"/>
	<text x="80" y="62" font-family="DejaVu Sans" font-weight="bold" font-size="30" fill="#fef3c7">YAKIMA VALLEY EVENTS</text>
	<text x="80" y="108" font-family="DejaVu Sans" font-weight="bold" font-size="40" fill="#ffffff">${escapeXml(headline)}</text>
	<text x="${WIDTH - 80}" y="108" text-anchor="end" font-family="DejaVu Sans" font-weight="bold" font-size="34" fill="#fef3c7">${events.length} event${events.length === 1 ? '' : 's'}</text>
	${rowsSvg}
	${overflowSvg}
	${emptySvg}
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
