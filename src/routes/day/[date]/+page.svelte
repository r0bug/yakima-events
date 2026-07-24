<script lang="ts">
	import type { PageData } from './$types';
	import { formatEventTime } from '$lib/dayShare';

	export let data: PageData;
	$: ({ date, headline, events, seo, shareLinks } = data);

	let copied = false;
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(seo.url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// clipboard unavailable — leave the URL visible for manual copy
		}
	}

	function shiftDay(offset: number): string {
		const d = new Date(`${date}T12:00:00Z`);
		d.setUTCDate(d.getUTCDate() + offset);
		return `/day/${d.toISOString().slice(0, 10)}`;
	}
</script>

<svelte:head>
	<title>{seo.title} - Yakima Events</title>
	<meta name="description" content={seo.description} />
	<link rel="canonical" href={seo.url} />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta property="og:url" content={seo.url} />
	<meta property="og:image" content={seo.image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:site_name" content="Yakima Events" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	<meta name="twitter:image" content={seo.image} />
</svelte:head>

<main class="container mx-auto px-4 py-8 max-w-3xl">
	<nav class="mb-6 flex items-center justify-between text-sm">
		<a href={shiftDay(-1)} class="text-purple-600 hover:underline">&larr; Previous day</a>
		<a href="/calendar" class="text-purple-600 hover:underline">Full calendar</a>
		<a href={shiftDay(1)} class="text-purple-600 hover:underline">Next day &rarr;</a>
	</nav>

	<header class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900">{headline}</h1>
		<p class="text-gray-600 mt-1">
			{events.length} event{events.length === 1 ? '' : 's'} across the Yakima Valley
		</p>
	</header>

	<!-- Share bar -->
	<div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 flex flex-wrap items-center gap-3">
		<span class="font-medium text-amber-900">Share this day:</span>
		<a
			href={shareLinks.facebook}
			target="_blank"
			rel="noopener"
			class="inline-flex items-center gap-2 bg-[#1877f2] text-white px-4 py-2 rounded-lg hover:bg-[#166fe5] font-medium"
		>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
			</svg>
			Share on Facebook
		</a>
		<button
			on:click={copyLink}
			class="inline-flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
		>
			{copied ? 'Copied!' : 'Copy link'}
		</button>
	</div>

	{#if events.length === 0}
		<div class="text-center py-16 text-gray-500">
			<p class="text-lg">No approved events listed for this day yet.</p>
			<a href="/events/submit" class="text-purple-600 hover:underline mt-2 inline-block">Know of one? Add it</a>
		</div>
	{:else}
		<ul class="space-y-3">
			{#each events as event (event.id)}
				<li>
					<a
						href="/events/{event.id}"
						class="block bg-white border border-gray-200 rounded-lg p-4 hover:border-amber-400 hover:shadow-sm transition"
					>
						<div class="flex items-baseline gap-3">
							<span class="text-amber-600 font-semibold whitespace-nowrap w-20 flex-shrink-0">
								{formatEventTime(event.startDatetime)}
							</span>
							<div class="min-w-0">
								<h2 class="font-semibold text-gray-900 truncate">{event.title}</h2>
								{#if event.location}
									<p class="text-sm text-gray-500 truncate">{event.location}</p>
								{/if}
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>
