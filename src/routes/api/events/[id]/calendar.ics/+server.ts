import type { RequestHandler } from './$types';
import { getEventById } from '$lib/server/services/events';

function escapeIcs(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\n/g, '\\n');
}

function formatIcsDate(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		return new Response('Invalid event ID', { status: 400 });
	}

	const event = await getEventById(id);
	if (!event) {
		return new Response('Event not found', { status: 404 });
	}

	const startDate = formatIcsDate(event.startDatetime);

	// Default to 2 hour duration if no end time
	const endDateStr = event.endDatetime
		? formatIcsDate(event.endDatetime)
		: formatIcsDate(new Date(new Date(event.startDatetime).getTime() + 2 * 60 * 60 * 1000).toISOString());

	const now = formatIcsDate(new Date().toISOString());
	const uid = `event-${event.id}@yfevents.yakimafinds.com`;
	const url = `https://yfevents.yakimafinds.com/events/${event.id}`;

	const location = [event.location, event.address].filter(Boolean).join(', ');

	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Yakima Events//yfevents.yakimafinds.com//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${now}`,
		`DTSTART:${startDate}`,
		`DTEND:${endDateStr}`,
		`SUMMARY:${escapeIcs(event.title)}`,
	];

	if (event.description) {
		lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
	}
	if (location) {
		lines.push(`LOCATION:${escapeIcs(location)}`);
	}
	if (event.latitude && event.longitude) {
		lines.push(`GEO:${event.latitude};${event.longitude}`);
	}
	lines.push(`URL:${url}`);
	lines.push('END:VEVENT');
	lines.push('END:VCALENDAR');

	const icsContent = lines.join('\r\n') + '\r\n';

	const safeTitle = event.title
		.replace(/[^a-zA-Z0-9-_ ]/g, '')
		.replace(/\s+/g, '-')
		.substring(0, 50);

	return new Response(icsContent, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="event-${safeTitle}.ics"`,
		},
	});
};
