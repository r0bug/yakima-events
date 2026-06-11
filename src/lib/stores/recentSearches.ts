import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'yfe.recentSearches';
const MAX_ITEMS = 8;

function loadInitial(): string[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
	} catch {
		return [];
	}
}

function persist(values: string[]) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
	} catch {
		// quota exceeded or storage disabled — ignore
	}
}

function createRecentSearchesStore() {
	const { subscribe, set, update } = writable<string[]>(loadInitial());

	return {
		subscribe,
		add(query: string) {
			const trimmed = query.trim();
			if (!trimmed) return;
			update(items => {
				const lower = trimmed.toLowerCase();
				const filtered = items.filter(q => q.toLowerCase() !== lower);
				const next = [trimmed, ...filtered].slice(0, MAX_ITEMS);
				persist(next);
				return next;
			});
		},
		remove(query: string) {
			update(items => {
				const next = items.filter(q => q !== query);
				persist(next);
				return next;
			});
		},
		clear() {
			persist([]);
			set([]);
		},
	};
}

export const recentSearches = createRecentSearchesStore();
