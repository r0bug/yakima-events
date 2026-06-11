import type { PageLoad } from './$types';

export interface SearchEvent {
	id: number;
	title: string;
	description?: string | null;
	startDatetime: string;
	endDatetime?: string | null;
	location?: string | null;
	address?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	categoryDetails?: { name: string; slug: string; color: string | null }[];
	imageUrl?: string | null;
	featured?: boolean;
}

export interface CategoryOption {
	id: number;
	name: string;
	slug: string;
	color: string | null;
}

export interface SearchFilters {
	q: string;
	categories: string[];
	region: string;
	from: string;
	to: string;
	includePast: boolean;
}

function parseFilters(url: URL): SearchFilters {
	return {
		q: url.searchParams.get('q') || '',
		categories: (url.searchParams.get('categories') || '').split(',').filter(Boolean),
		region: url.searchParams.get('region') || '',
		from: url.searchParams.get('from') || '',
		to: url.searchParams.get('to') || '',
		includePast: url.searchParams.get('include_past') === '1',
	};
}

function todayPacific(): string {
	// Returns YYYY-MM-DD in America/Los_Angeles regardless of where this runs.
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});
	return fmt.format(new Date());
}

export const load: PageLoad = async ({ url, fetch }) => {
	const filters = parseFilters(url);

	// Effective lower bound for the API:
	// - User-supplied `from` takes precedence (they explicitly chose a date).
	// - Otherwise, default to today (filter out past events) unless includePast is on.
	const todayStr = todayPacific();
	const effectiveFrom = filters.from || (filters.includePast ? '' : todayStr);
	const pastFilterActive = !filters.includePast && !filters.from;

	// Build API params
	const params = new URLSearchParams();
	if (filters.q) params.set('search', filters.q);
	if (filters.categories.length > 0) params.set('include_categories', filters.categories.join(','));
	if (effectiveFrom) params.set('start_date', effectiveFrom);
	if (filters.to) {
		// API uses lte on start_datetime; pad to end-of-day
		params.set('end_date', `${filters.to}T23:59:59`);
	}
	params.set('limit', '100');

	// Has any user-set filter? (the implicit today floor doesn't count)
	const hasActiveFilters = !!(filters.q || filters.categories.length > 0 || filters.region || filters.from || filters.to);

	let events: SearchEvent[] = [];
	let total = 0;
	if (hasActiveFilters) {
		try {
			const res = await fetch(`/api/events?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				events = (data.events || []).map((e: any) => ({
					id: e.id,
					title: e.title,
					description: e.description,
					startDatetime: e.start_datetime || e.startDatetime,
					endDatetime: e.end_datetime || e.endDatetime,
					location: e.location,
					address: e.address,
					latitude: e.latitude ? Number(e.latitude) : null,
					longitude: e.longitude ? Number(e.longitude) : null,
					categoryDetails: e.category_details || e.categoryDetails || [],
					imageUrl: e.image_url || e.primaryImageUrl,
					featured: e.featured,
				}));
				total = data.total || events.length;
			}
		} catch {
			events = [];
			total = 0;
		}
	}

	// Client-side region filtering (region is derived from address, not a DB column)
	if (filters.region && events.length > 0) {
		const { getYakimaRegion } = await import('$lib/utils/geo');
		events = events.filter(e => getYakimaRegion(e.address || '') === filters.region);
		total = events.length;
	}

	// Load categories for the filter UI
	let categories: CategoryOption[] = [];
	try {
		const res = await fetch('/api/events/categories');
		if (res.ok) {
			const data = await res.json();
			categories = data.categories || data || [];
		}
	} catch {
		categories = [];
	}

	return {
		filters,
		events,
		total,
		categories,
		hasActiveFilters,
		pastFilterActive,
		todayStr,
	};
};
