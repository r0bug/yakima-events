<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { recentSearches } from '$lib/stores/recentSearches';
	import { REGION_LABELS } from '$lib/utils/geo';
	import type { PageData } from './$types';

	export let data: PageData;

	$: filters = data.filters;
	$: events = data.events;
	$: total = data.total;
	$: categories = data.categories;
	$: hasActiveFilters = data.hasActiveFilters;

	// Local form state — initialize from data, then sync on URL changes
	let q = data.filters.q;
	let from = data.filters.from;
	let to = data.filters.to;
	let region = data.filters.region;
	let includePast = data.filters.includePast;
	let selectedCategories = new Set(data.filters.categories);

	$: if (data?.filters) {
		q = data.filters.q;
		from = data.filters.from;
		to = data.filters.to;
		region = data.filters.region;
		includePast = data.filters.includePast;
		selectedCategories = new Set(data.filters.categories);
	}

	function buildUrl(overrides: Partial<{ q: string; from: string; to: string; region: string; categories: string[]; includePast: boolean }> = {}): string {
		const params = new URLSearchParams();
		const newQ = overrides.q ?? q;
		const newFrom = overrides.from ?? from;
		const newTo = overrides.to ?? to;
		const newRegion = overrides.region ?? region;
		const newCats = overrides.categories ?? [...selectedCategories];
		const newIncludePast = overrides.includePast ?? includePast;

		if (newQ) params.set('q', newQ);
		if (newCats.length > 0) params.set('categories', newCats.join(','));
		if (newRegion) params.set('region', newRegion);
		if (newFrom) params.set('from', newFrom);
		if (newTo) params.set('to', newTo);
		if (newIncludePast) params.set('include_past', '1');

		const qs = params.toString();
		return qs ? `/search?${qs}` : '/search';
	}

	function applyFilters() {
		goto(buildUrl(), { keepFocus: true, noScroll: true });
	}

	function onSubmitSearch(e: Event) {
		e.preventDefault();
		const trimmed = q.trim();
		if (trimmed) recentSearches.add(trimmed);
		applyFilters();
	}

	function toggleCategory(slug: string) {
		const next = new Set(selectedCategories);
		if (next.has(slug)) next.delete(slug);
		else next.add(slug);
		selectedCategories = next;
		goto(buildUrl({ categories: [...next] }), { keepFocus: true, noScroll: true });
	}

	function setRegion(r: string) {
		region = region === r ? '' : r;
		goto(buildUrl({ region }), { keepFocus: true, noScroll: true });
	}

	function setQuickRange(days: number, fromToday = true) {
		const today = new Date();
		const start = fromToday ? today : new Date(today);
		const end = new Date(today);
		end.setDate(end.getDate() + days);

		const fmt = (d: Date) => d.toISOString().slice(0, 10);
		from = fmt(start);
		to = fmt(end);
		goto(buildUrl({ from, to }), { keepFocus: true, noScroll: true });
	}

	function clearAll() {
		q = '';
		from = '';
		to = '';
		region = '';
		includePast = false;
		selectedCategories = new Set();
		goto('/search', { keepFocus: true, noScroll: true });
	}

	function toggleIncludePast() {
		includePast = !includePast;
		goto(buildUrl({ includePast }), { keepFocus: true, noScroll: true });
	}

	// Group events by date
	function formatGroupDate(iso: string): string {
		try {
			const d = new Date(iso.replace(' ', 'T'));
			return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
		} catch {
			return iso.slice(0, 10);
		}
	}

	function dateKey(iso: string): string {
		return (iso || '').slice(0, 10);
	}

	function formatTime(iso: string): string {
		try {
			const d = new Date(iso.replace(' ', 'T'));
			return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
		} catch {
			return '';
		}
	}

	$: groupedEvents = (() => {
		const groups = new Map<string, typeof events>();
		for (const ev of events) {
			const key = dateKey(ev.startDatetime);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(ev);
		}
		return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	})();

	// Active regions: only show regions that actually appear in current results
	$: activeFiltersCount = [
		filters.q,
		filters.region,
		filters.from,
		filters.to,
	].filter(Boolean).length + filters.categories.length;
</script>

<svelte:head>
	<title>{filters.q ? `"${filters.q}" - Search` : 'Search Events'} | Yakima Events</title>
	<meta name="description" content="Search events in Yakima Valley by name, location, category, region, or date." />
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
	<!-- Heading -->
	<div class="mb-6">
		<h1 class="text-3xl font-display font-bold text-stone-900 mb-1">Search Events</h1>
		<p class="text-sm text-stone-600">Find what's happening in the Yakima Valley.</p>
	</div>

	<!-- Search form -->
	<form on:submit={onSubmitSearch} class="mb-4">
		<div class="relative">
			<svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
			</svg>
			<input
				bind:value={q}
				type="search"
				placeholder="Search by name, venue, address, or description…"
				class="w-full pl-12 pr-32 py-3.5 text-base rounded-xl border-2 border-stone-200 bg-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all"
				autocomplete="off"
			/>
			<button
				type="submit"
				class="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
			>
				Search
			</button>
		</div>
	</form>

	<!-- Quick date chips -->
	<div class="flex flex-wrap items-center gap-2 mb-4">
		<button type="button" on:click={() => setQuickRange(0)}
			class="px-3 py-1.5 text-xs font-medium rounded-full border border-stone-300 hover:bg-stone-100 text-stone-700">
			Today
		</button>
		<button type="button" on:click={() => setQuickRange(1)}
			class="px-3 py-1.5 text-xs font-medium rounded-full border border-stone-300 hover:bg-stone-100 text-stone-700">
			Next 2 days
		</button>
		<button type="button" on:click={() => setQuickRange(7)}
			class="px-3 py-1.5 text-xs font-medium rounded-full border border-stone-300 hover:bg-stone-100 text-stone-700">
			Next 7 days
		</button>
		<button type="button" on:click={() => setQuickRange(30)}
			class="px-3 py-1.5 text-xs font-medium rounded-full border border-stone-300 hover:bg-stone-100 text-stone-700">
			Next 30 days
		</button>
		{#if activeFiltersCount > 0}
			<button type="button" on:click={clearAll}
				class="ml-auto px-3 py-1.5 text-xs font-medium rounded-full text-rose-600 hover:bg-rose-50">
				Clear all filters ({activeFiltersCount})
			</button>
		{/if}
	</div>

	<!-- Date range + include past toggle -->
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm">
		<label class="flex items-center gap-2 text-stone-600">
			From
			<input
				type="date"
				bind:value={from}
				on:change={() => goto(buildUrl({ from }), { keepFocus: true, noScroll: true })}
				class="px-2 py-1 border border-stone-300 rounded text-stone-900 bg-white"
			/>
		</label>
		<label class="flex items-center gap-2 text-stone-600">
			to
			<input
				type="date"
				bind:value={to}
				on:change={() => goto(buildUrl({ to }), { keepFocus: true, noScroll: true })}
				class="px-2 py-1 border border-stone-300 rounded text-stone-900 bg-white"
			/>
		</label>
		<label class="flex items-center gap-2 text-stone-700 cursor-pointer select-none">
			<input
				type="checkbox"
				checked={includePast}
				on:change={toggleIncludePast}
				class="w-4 h-4 rounded border-stone-300 text-amber-500 focus:ring-amber-400"
			/>
			Include past events
		</label>
	</div>

	{#if data.pastFilterActive}
		<div class="flex items-center gap-2 mb-4 px-3 py-2 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-lg">
			<svg class="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>Showing events from today onward.</span>
			<button type="button" on:click={toggleIncludePast} class="text-amber-700 hover:underline font-medium">
				Include past events
			</button>
		</div>
	{/if}

	<!-- Categories -->
	{#if categories.length > 0}
		<div class="mb-4">
			<div class="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Categories</div>
			<div class="flex flex-wrap gap-2">
				{#each categories as cat}
					{@const active = selectedCategories.has(cat.slug)}
					<button type="button"
						on:click={() => toggleCategory(cat.slug)}
						class="px-3 py-1.5 text-xs font-medium rounded-full border-2 transition-all flex items-center gap-1.5"
						style="border-color: {active ? (cat.color || '#6b7280') : '#e7e5e4'};
							background: {active ? (cat.color || '#6b7280') : 'white'};
							color: {active ? 'white' : '#44403c'};"
					>
						<span class="w-2 h-2 rounded-full" style="background: {active ? 'white' : (cat.color || '#9ca3af')}"></span>
						{cat.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Regions -->
	<div class="mb-6">
		<div class="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Region</div>
		<div class="flex flex-wrap gap-2">
			{#each Object.entries(REGION_LABELS) as [slug, label]}
				{@const active = region === slug}
				<button type="button"
					on:click={() => setRegion(slug)}
					class="px-3 py-1.5 text-xs font-medium rounded-full border-2 transition-all
						{active ? 'border-amber-500 bg-amber-500 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}"
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Results -->
	{#if !hasActiveFilters}
		<div class="text-center py-16 bg-stone-50 rounded-xl border border-stone-200">
			<svg class="w-12 h-12 mx-auto text-stone-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
			</svg>
			<p class="text-stone-600 mb-4">Enter a search or pick a filter to find events.</p>
			<div class="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
				<button type="button" on:click={() => setQuickRange(0)}
					class="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600">
					Events today
				</button>
				<button type="button" on:click={() => setQuickRange(7)}
					class="px-4 py-2 text-sm font-medium rounded-lg bg-stone-200 text-stone-800 hover:bg-stone-300">
					This week
				</button>
				{#if categories[0]}
					<button type="button" on:click={() => toggleCategory(categories[0].slug)}
						class="px-4 py-2 text-sm font-medium rounded-lg bg-stone-200 text-stone-800 hover:bg-stone-300">
						{categories[0].name}
					</button>
				{/if}
			</div>
		</div>
	{:else if events.length === 0}
		<div class="text-center py-16 bg-stone-50 rounded-xl border border-stone-200">
			<svg class="w-12 h-12 mx-auto text-stone-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<p class="text-stone-700 font-medium mb-1">No events match your filters.</p>
			<p class="text-stone-500 text-sm mb-4">
				Try removing the date range, expanding categories, or
				<button type="button" on:click={clearAll} class="text-amber-700 hover:underline">clearing all filters</button>.
			</p>
		</div>
	{:else}
		<div class="mb-3 text-sm text-stone-500">
			{total} event{total === 1 ? '' : 's'} found
		</div>
		<div class="space-y-6">
			{#each groupedEvents as [dateK, evs] (dateK)}
				<div>
					<h2 class="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3 sticky top-0 bg-white/95 backdrop-blur py-2 z-10 -mx-4 px-4 border-b border-stone-100">
						{formatGroupDate(evs[0].startDatetime)}
					</h2>
					<div class="space-y-2">
						{#each evs as ev (ev.id)}
							{@const cat = ev.categoryDetails?.[0]}
							<a href="/events/{ev.id}" class="block bg-white border border-stone-200 rounded-lg p-4 hover:border-amber-300 hover:shadow-md transition-all">
								<div class="flex gap-4">
									<div class="flex-shrink-0 text-center min-w-[64px]">
										<div class="text-xs uppercase tracking-wider text-stone-500">
											{formatTime(ev.startDatetime)}
										</div>
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-start gap-2 mb-1">
											{#if cat}
												<span class="px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0"
													style="background: {(cat.color || '#9ca3af')}20; color: {cat.color || '#6b7280'};">
													{cat.name}
												</span>
											{/if}
											{#if ev.featured}
												<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 flex-shrink-0">
													★ Featured
												</span>
											{/if}
										</div>
										<h3 class="text-base font-semibold text-stone-900 mb-1">{ev.title}</h3>
										{#if ev.location || ev.address}
											<div class="text-sm text-stone-600 flex items-center gap-1">
												<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
												</svg>
												<span class="truncate">{ev.location || ev.address}</span>
											</div>
										{/if}
										{#if ev.description}
											<p class="text-sm text-stone-500 mt-1 line-clamp-2">{ev.description}</p>
										{/if}
									</div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
