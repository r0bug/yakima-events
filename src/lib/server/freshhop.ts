import { readFile, appendFile, mkdir, writeFile, rename } from 'fs/promises';
import { resolve, dirname } from 'path';

/**
 * Fresh Hop song review page.
 *
 * Content lives in data/freshhop.json (gitignored runtime data, read per request,
 * so songs can be swapped without a rebuild). Audio is served by nginx from
 * uploads/freshhop/. Feedback is appended to data/freshhop-feedback.jsonl —
 * deliberately not a DB table, so the shared yakima_finds schema is untouched.
 */

export interface FreshHopVersion {
	/** Stable id favorites are keyed on; defaults to `${song.slug}-${n}` */
	id?: string;
	label: string;
	src: string;
}

/** Recording ids on one card, in display order. */
export function cardRecordingIds(song: FreshHopSong): string[] {
	return song.versions.map((v, i) => v.id || `${song.slug}-${i + 1}`);
}

export function recordingIds(config: FreshHopConfig): Map<string, string> {
	const ids = new Map<string, string>();
	for (const song of config.songs) {
		song.versions.forEach((v, i) => {
			ids.set(v.id || `${song.slug}-${i + 1}`, `${song.title} — ${v.label}`);
		});
	}
	return ids;
}

export interface FreshHopSong {
	slug: string;
	title: string;
	genre?: string;
	versions: FreshHopVersion[];
	lyrics: string;
}

/** Song Factory lore entries ("seed data") the lyrics were generated from. */
export interface FreshHopLore {
	slug: string;
	title: string;
	content: string;
}

export interface FreshHopConfig {
	title: string;
	intro?: string;
	songs: FreshHopSong[];
	loreIntro?: string;
	lore?: FreshHopLore[];
}

export interface FreshHopFeedback {
	at: string;
	song: string;
	section?: 'song' | 'lore';
	kind: 'request' | 'criticism' | 'general' | 'correction';
	name: string;
	message: string;
	ip?: string;
}

const CONFIG_PATH = resolve('data/freshhop.json');
const FEEDBACK_PATH = resolve('data/freshhop-feedback.jsonl');

export async function loadFreshHop(): Promise<FreshHopConfig | null> {
	try {
		return JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
	} catch {
		return null;
	}
}

export async function saveFeedback(entry: FreshHopFeedback): Promise<void> {
	await mkdir(dirname(FEEDBACK_PATH), { recursive: true });
	await appendFile(FEEDBACK_PATH, JSON.stringify(entry) + '\n', 'utf-8');
}

export async function loadFeedback(): Promise<FreshHopFeedback[]> {
	let raw: string;
	try {
		raw = await readFile(FEEDBACK_PATH, 'utf-8');
	} catch {
		return [];
	}
	const out: FreshHopFeedback[] = [];
	for (const line of raw.split('\n')) {
		if (!line.trim()) continue;
		try {
			out.push(JSON.parse(line));
		} catch {
			// a torn last line from a crash mid-append; skip it
		}
	}
	return out.reverse();
}

// ---------------------------------------------------------------------------
// Favorites: each visitor (anonymous cookie id) may pick one favorite
// recording per card. Stored as { visitorId: { songs: [recordingId...], ip, at } }
// so picks can be changed.
// ---------------------------------------------------------------------------

const FAVORITES_PATH = resolve('data/freshhop-favorites.json');

type FavoritesStore = Record<string, { songs: string[]; ip?: string; at: string }>;

async function readFavorites(): Promise<FavoritesStore> {
	try {
		return JSON.parse(await readFile(FAVORITES_PATH, 'utf-8'));
	} catch {
		return {};
	}
}

// Serialize read-modify-write so two clicks at once can't drop a vote.
let favLock: Promise<unknown> = Promise.resolve();

/**
 * Toggle a favorite. Picking a recording replaces any other pick on the same
 * card (`cardRecordings`); picking the current one again clears it.
 */
export function toggleFavorite(
	visitor: string,
	recording: string,
	cardRecordings: string[],
	ip?: string,
): Promise<string[]> {
	const run = favLock.then(async () => {
		const store = await readFavorites();
		const mine = store[visitor]?.songs ?? [];
		const others = mine.filter((r) => !cardRecordings.includes(r));
		const next = mine.includes(recording) ? others : [...others, recording];
		store[visitor] = { songs: next, ip, at: new Date().toISOString() };
		await mkdir(dirname(FAVORITES_PATH), { recursive: true });
		const tmp = `${FAVORITES_PATH}.tmp`;
		await writeFile(tmp, JSON.stringify(store), 'utf-8');
		await rename(tmp, FAVORITES_PATH);
		return next;
	});
	favLock = run.catch(() => {});
	return run;
}

export async function favoriteSummary(visitor?: string) {
	const store = await readFavorites();
	const counts: Record<string, number> = {};
	for (const v of Object.values(store)) {
		for (const s of v.songs) counts[s] = (counts[s] || 0) + 1;
	}
	const voters = Object.values(store).filter((v) => v.songs.length > 0).length;
	return { counts, voters, mine: (visitor && store[visitor]?.songs) || [] };
}
