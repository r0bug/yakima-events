import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { loadFreshHop, saveFeedback } from '$lib/server/freshhop';

const KINDS = ['request', 'criticism', 'general'] as const;
const MAX_MESSAGE = 4000;

// Light per-IP throttle: the form is public and unauthenticated.
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;

function throttled(ip: string): boolean {
	const now = Date.now();
	const hits = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
	hits.push(now);
	recent.set(ip, hits);
	return hits.length > MAX_PER_WINDOW;
}

export const load: PageServerLoad = async () => {
	const config = await loadFreshHop();
	if (!config) error(404, 'Not found');
	return { config };
};

export const actions: Actions = {
	feedback: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const song = String(form.get('song') || '');

		// Honeypot: humans never see this field
		if (form.get('website')) return { success: true, song };

		const config = await loadFreshHop();
		const match = config?.songs.find((s) => s.slug === song);
		if (!match) return fail(400, { song, error: 'Unknown song.' });

		const kindRaw = String(form.get('kind') || 'general');
		const kind = (KINDS as readonly string[]).includes(kindRaw)
			? (kindRaw as (typeof KINDS)[number])
			: 'general';
		const name = String(form.get('name') || '').trim().slice(0, 100);
		const message = String(form.get('message') || '').trim();

		if (!message) return fail(400, { song, error: 'Please enter a comment.' });
		if (message.length > MAX_MESSAGE) {
			return fail(400, { song, error: `Please keep comments under ${MAX_MESSAGE} characters.` });
		}

		const ip = getClientAddress();
		if (throttled(ip)) {
			return fail(429, { song, error: 'Too many comments in a short time. Please try again later.' });
		}

		await saveFeedback({
			at: new Date().toISOString(),
			song: match.title,
			kind,
			name,
			message,
			ip,
		});
		return { success: true, song };
	},
};
