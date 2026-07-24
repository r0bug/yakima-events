import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getEvents } from '$lib/server/services/events';
import { formatDayHeadline, isValidDateParam } from '$lib/dayShare';

export const load: PageServerLoad = async ({ params }) => {
	const date = params.date;
	if (!isValidDateParam(date)) {
		error(404, 'Not found');
	}

	const events = await getEvents({
		startDate: `${date} 00:00:00`,
		endDate: `${date} 23:59:59`,
		status: 'approved',
	});

	const siteUrl = 'https://yfevents.yakimafinds.com';
	const dayUrl = `${siteUrl}/day/${date}`;
	const headline = formatDayHeadline(date);

	const count = events.length;
	const title = count > 0
		? `${count} thing${count === 1 ? '' : 's'} to do in the Yakima Valley — ${headline}`
		: `Yakima Valley events — ${headline}`;

	const topTitles = events.slice(0, 5).map((e) => e.title);
	const description = count > 0
		? `${topTitles.join(' • ')}${count > topTitles.length ? ` and ${count - topTitles.length} more…` : ''}`
		: 'Concerts, markets, classes, and community events across the Yakima Valley.';

	return {
		date,
		headline,
		events,
		seo: {
			title,
			description,
			url: dayUrl,
			image: `${siteUrl}/day/${date}/og.png`,
		},
		shareLinks: {
			facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(dayUrl)}`,
		},
	};
};
