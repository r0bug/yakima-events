<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { debounce } from '$lib/utils';
	import { recentSearches } from '$lib/stores/recentSearches';

	interface Suggestion {
		id: number;
		title: string;
		startDatetime: string;
		location?: string | null;
		categoryDetails?: { name: string; slug: string; color: string | null }[];
	}

	export let placeholder = 'Search events…';
	export let autofocus = false;

	let query = '';
	let inputEl: HTMLInputElement;
	let containerEl: HTMLDivElement;
	let suggestions: Suggestion[] = [];
	let loading = false;
	let isOpen = false;
	let activeIndex = -1; // -1 = no item selected (input itself)

	$: combinedItems = buildCombinedItems(query, suggestions, $recentSearches);

	function buildCombinedItems(q: string, sug: Suggestion[], recents: string[]) {
		const items: Array<{ kind: 'recent'; value: string } | { kind: 'event'; value: Suggestion }> = [];
		if (q.trim().length < 2 && recents.length > 0) {
			for (const r of recents) items.push({ kind: 'recent', value: r });
		}
		for (const s of sug) items.push({ kind: 'event', value: s });
		return items;
	}

	const fetchSuggestions = debounce(async (q: string) => {
		if (q.trim().length < 2) {
			suggestions = [];
			loading = false;
			return;
		}
		try {
			const res = await fetch(`/api/events?search=${encodeURIComponent(q)}&limit=5`);
			if (!res.ok) {
				suggestions = [];
				return;
			}
			const data = await res.json();
			const list = Array.isArray(data) ? data : data.events || [];
			suggestions = list.map((e: any) => ({
				id: e.id,
				title: e.title,
				startDatetime: e.startDatetime || e.start_datetime,
				location: e.location,
				categoryDetails: e.categoryDetails || e.category_details,
			}));
		} catch {
			suggestions = [];
		} finally {
			loading = false;
		}
	}, 200);

	function onInput() {
		activeIndex = -1;
		if (query.trim().length < 2) {
			suggestions = [];
			loading = false;
		} else {
			loading = true;
		}
		fetchSuggestions(query);
	}

	function onFocus() {
		isOpen = true;
	}

	function onBlur(e: FocusEvent) {
		// Delay so click on suggestion can register
		setTimeout(() => {
			if (containerEl && !containerEl.contains(document.activeElement)) {
				isOpen = false;
			}
		}, 150);
	}

	function submitQuery(q: string) {
		const trimmed = q.trim();
		if (!trimmed) return;
		recentSearches.add(trimmed);
		isOpen = false;
		inputEl?.blur();
		goto(`/search?q=${encodeURIComponent(trimmed)}`);
	}

	function selectEvent(s: Suggestion) {
		isOpen = false;
		inputEl?.blur();
		goto(`/events/${s.id}`);
	}

	function selectRecent(q: string) {
		query = q;
		submitQuery(q);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (isOpen) {
				e.preventDefault();
				isOpen = false;
				inputEl?.blur();
			}
			return;
		}
		if (!isOpen) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, combinedItems.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, -1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (activeIndex >= 0 && combinedItems[activeIndex]) {
				const item = combinedItems[activeIndex];
				if (item.kind === 'recent') selectRecent(item.value);
				else selectEvent(item.value);
			} else {
				submitQuery(query);
			}
		}
	}

	function formatEventTime(iso: string): string {
		try {
			const d = new Date(iso.replace(' ', 'T'));
			return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
		} catch {
			return '';
		}
	}

	// Global keyboard shortcut: "/" to focus search
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
		e.preventDefault();
		inputEl?.focus();
	}

	onMount(() => {
		if (autofocus) inputEl?.focus();
		if (browser) window.addEventListener('keydown', onWindowKeydown);
	});

	onDestroy(() => {
		if (browser) window.removeEventListener('keydown', onWindowKeydown);
	});
</script>

<div class="relative w-full" bind:this={containerEl}>
	<div class="relative">
		<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
		</svg>
		<input
			bind:this={inputEl}
			bind:value={query}
			on:input={onInput}
			on:focus={onFocus}
			on:blur={onBlur}
			on:keydown={onKeydown}
			type="search"
			autocomplete="off"
			spellcheck="false"
			{placeholder}
			class="w-full pl-9 pr-12 py-2 text-sm rounded-lg bg-white/10 border border-white/15 text-white placeholder:text-stone-400 focus:bg-white focus:text-stone-900 focus:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
		/>
		<kbd class="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-stone-400 bg-white/10 border border-white/15 rounded pointer-events-none">/</kbd>
	</div>

	{#if isOpen && (combinedItems.length > 0 || loading || query.trim().length >= 2)}
		<div class="absolute left-0 right-0 mt-2 bg-white text-stone-900 rounded-lg shadow-xl border border-stone-200 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
			{#if loading && suggestions.length === 0}
				<div class="px-4 py-3 text-sm text-stone-500">Searching…</div>
			{:else if combinedItems.length === 0}
				<div class="px-4 py-3 text-sm text-stone-500">
					No matches.
					{#if query.trim()}
						<button class="text-amber-700 hover:underline ml-1" on:mousedown|preventDefault={() => submitQuery(query)}>
							Search "{query.trim()}" anyway →
						</button>
					{/if}
				</div>
			{:else}
				{#each combinedItems as item, i}
					{#if item.kind === 'recent'}
						<button
							type="button"
							class="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-stone-50 {activeIndex === i ? 'bg-stone-100' : ''}"
							on:mousedown|preventDefault={() => selectRecent(item.value)}
							on:mouseenter={() => activeIndex = i}
						>
							<svg class="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-sm text-stone-700 flex-1 truncate">{item.value}</span>
							<svg class="w-3 h-3 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
							</svg>
						</button>
					{:else}
						{@const ev = item.value}
						{@const cat = ev.categoryDetails?.[0]}
						<button
							type="button"
							class="w-full flex items-start gap-3 px-4 py-2 text-left hover:bg-stone-50 {activeIndex === i ? 'bg-stone-100' : ''}"
							on:mousedown|preventDefault={() => selectEvent(ev)}
							on:mouseenter={() => activeIndex = i}
						>
							<div class="w-2 h-2 rounded-full mt-2 flex-shrink-0" style="background: {cat?.color || '#9ca3af'};"></div>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium text-stone-900 truncate">{ev.title}</div>
								<div class="text-xs text-stone-500 truncate">
									{formatEventTime(ev.startDatetime)}
									{#if ev.location}· {ev.location}{/if}
								</div>
							</div>
						</button>
					{/if}
				{/each}

				{#if query.trim().length >= 2 && suggestions.length > 0}
					<button
						type="button"
						class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border-t border-stone-200"
						on:mousedown|preventDefault={() => submitQuery(query)}
					>
						See all results for "{query.trim()}"
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
						</svg>
					</button>
				{/if}
			{/if}
		</div>
	{/if}
</div>
