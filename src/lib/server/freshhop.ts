import { readFile, appendFile, mkdir } from 'fs/promises';
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
	label: string;
	src: string;
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
