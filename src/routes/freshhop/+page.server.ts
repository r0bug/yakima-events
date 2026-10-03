import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import type { Cookies } from '@sveltejs/kit';
import {
	loadFreshHop,
	saveFeedback,
	toggleFavorite,
	favoriteSummary,
	MAX_FAVORITES,
} from '$lib/server/freshhop';

const VISITOR_COOKIE = 'fh_vid';

function visitorId(cookies: Cookies): string {
	let id = cookies.get(VISITOR_COOKIE);
	if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
		id = randomUUID();
		cookies.set(VISITOR_COOKIE, id, {
			path: '/freshhop',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			maxAge: 60 * 60 * 24 * 365,
		});
	}
	return id;
}

const KINDS = ['request', 'criticism', 'general', 'correction'] as const;
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

export const load: PageServerLoad = async ({ cookies }) => {
	const config = await loadFreshHop();
	if (!config) error(404, 'Not found');
	const favorites = await favoriteSummary(visitorId(cookies));
	return { config, favorites, maxFavorites: MAX_FAVORITES };
};

export const actions: Actions = {
	favorite: async ({ request, cookies, getClientAddress }) => {
		const form = await request.formData();
		const song = String(form.get('song') || '');
		const config = await loadFreshHop();
		if (!config?.songs.some((s) => s.slug === song)) {
			return fail(400, { favSong: song, favError: 'Unknown song.' });
		}
		const ip = request.headers.get('x-real-ip') || getClientAddress();
		const picks = await toggleFavorite(visitorId(cookies), song, ip);
		if (!picks) {
			return fail(400, {
				favSong: song,
				favError: `You can pick up to ${MAX_FAVORITES} favorites. Un-pick one first.`,
			});
		}
		return { favSong: song };
	},

	feedback: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const song = String(form.get('song') || '');

		// Honeypot: humans never see this field
		if (form.get('website')) return { success: true, song };

		const config = await loadFreshHop();
		const songMatch = config?.songs.find((s) => s.slug === song);
		const loreMatch = config?.lore?.find((l) => l.slug === song);
		const match = songMatch || loreMatch;
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

		// Behind nginx getClientAddress() is always 127.0.0.1; nginx sets X-Real-IP
		// to the real client, so prefer it or the throttle would be site-wide.
		const ip = request.headers.get('x-real-ip') || getClientAddress();
		if (throttled(ip)) {
			return fail(429, { song, error: 'Too many comments in a short time. Please try again later.' });
		}

		await saveFeedback({
			at: new Date().toISOString(),
			song: match.title,
			section: songMatch ? 'song' : 'lore',
			kind,
			name,
			message,
			ip,
		});
		return { success: true, song };
	},
};
