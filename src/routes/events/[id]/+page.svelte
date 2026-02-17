<script lang="ts">
	import { format, parseISO } from 'date-fns';
	import MapView from '$lib/components/MapView.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';

	export let data;

	$: event = data.event;
	$: primaryShop = data.primaryShop;
	$: participants = data.participants;
	$: seo = data.seo;

	function getGoogleCalendarUrl(): string {
		const start = new Date(event.startDatetime);
		const end = event.endDatetime
			? new Date(event.endDatetime)
			: new Date(start.getTime() + 2 * 60 * 60 * 1000);

		const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

		const params = new URLSearchParams({
			action: 'TEMPLATE',
			text: event.title,
			dates: `${fmt(start)}/${fmt(end)}`,
			details: event.description || '',
			location: event.location || event.address || '',
		});

		return `https://calendar.google.com/calendar/render?${params}`;
	}

	function getOutlookCalendarUrl(): string {
		const start = new Date(event.startDatetime);
		const end = event.endDatetime
			? new Date(event.endDatetime)
			: new Date(start.getTime() + 2 * 60 * 60 * 1000);

		const params = new URLSearchParams({
			path: '/calendar/action/compose',
			rru: 'addevent',
			subject: event.title,
			startdt: start.toISOString(),
			enddt: end.toISOString(),
			body: event.description || '',
			location: event.location || event.address || '',
		});

		return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
	}

	function getDirectionsUrl(): string {
		if (event.latitude && event.longitude) {
			return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
		}
		if (event.address) {
			return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`;
		}
		return '#';
	}

	// Build JSON-LD structured data
	function getJsonLd(): string {
		const start = new Date(event.startDatetime);
		const end = event.endDatetime
			? new Date(event.endDatetime)
			: new Date(start.getTime() + 2 * 60 * 60 * 1000);

		const jsonLd: Record<string, unknown> = {
			'@context': 'https://schema.org',
			'@type': 'Event',
			name: event.title,
			startDate: start.toISOString(),
			endDate: end.toISOString(),
			url: seo.url,
		};

		if (event.description) {
			jsonLd.description = event.description;
		}

		if (event.location || event.address) {
			jsonLd.location = {
				'@type': 'Place',
				name: event.location || event.address,
				...(event.address && { address: event.address }),
				...(event.latitude && event.longitude && {
					geo: {
						'@type': 'GeoCoordinates',
						latitude: Number(event.latitude),
						longitude: Number(event.longitude),
					},
				}),
			};
		}

		if (seo.image) {
			jsonLd.image = seo.image;
		}

		return JSON.stringify(jsonLd);
	}
</script>

<svelte:head>
	<title>{seo.title} - Yakima Events</title>
	<meta name="description" content={seo.description} />
	<link rel="canonical" href={seo.url} />

	<!-- Open Graph -->
	<meta property="og:type" content="event" />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta property="og:url" content={seo.url} />
	<meta property="og:image" content={seo.image} />
	<meta property="og:site_name" content="Yakima Events" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	<meta name="twitter:image" content={seo.image} />

	<!-- JSON-LD Structured Data -->
	{@html `<script type="application/ld+json">${getJsonLd()}</script>`}
</svelte:head>

<main class="container mx-auto px-4 py-8">
	<!-- Breadcrumb -->
	<nav class="mb-6 text-sm">
		<a href="/calendar" class="text-purple-600 hover:underline">Calendar</a>
		<span class="mx-2 text-gray-400">/</span>
		<span class="text-gray-600">{event.title}</span>
	</nav>

	{#if event.status === 'pending'}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
			<svg class="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<p class="text-sm text-yellow-800">This event is pending verification and has not been reviewed yet.</p>
		</div>
	{/if}

	<!-- Collaborative Banner -->
	{#if event.isCollaborative && participants.length > 0}
		<div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
			<div class="flex items-center gap-2 mb-2">
				<svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				<span class="font-semibold text-purple-800">Collaborative Event</span>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each participants.filter(p => p.status === 'approved') as participant}
					<a
						href="/shops/{participant.id}"
						class="inline-flex items-center gap-1 px-3 py-1 bg-white text-purple-700 rounded-full text-sm border border-purple-200 hover:bg-purple-100 transition-colors"
					>
						{participant.name}
						{#if participant.role}
							<span class="text-purple-400 text-xs">({participant.role.replace('_', ' ')})</span>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
		<!-- Main Content -->
		<div class="lg:col-span-2 space-y-6">
			<!-- Header Image -->
			{#if event.primaryImage}
				<img
					src="/uploads/{event.primaryImage}"
					alt={event.title}
					class="w-full h-64 md:h-96 object-cover rounded-lg"
				/>
			{/if}

			<!-- Title & Badges -->
			<div class="flex flex-wrap items-start gap-4">
				<div class="flex-1">
					<h1 class="text-3xl font-bold text-gray-900">{event.title}</h1>
					{#if event.categories}
						<div class="flex flex-wrap gap-2 mt-2">
							{#each event.categories.split(',') as category}
								<span class="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
									{category.trim()}
								</span>
							{/each}
						</div>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					{#if event.featured}
						<span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
							Featured
						</span>
					{/if}
					<ShareButton itemType="event" itemId={event.id} />
				</div>
			</div>

			<!-- Date & Time -->
			<div class="bg-white rounded-lg border p-6">
				<div class="flex items-center gap-3 text-gray-700">
					<div class="flex-shrink-0 w-14 h-14 bg-purple-100 rounded-lg flex flex-col items-center justify-center">
						<span class="text-xs font-medium text-purple-600 uppercase">
							{format(parseISO(event.startDatetime), 'MMM')}
						</span>
						<span class="text-xl font-bold text-purple-800">
							{format(parseISO(event.startDatetime), 'd')}
						</span>
					</div>
					<div>
						<div class="font-semibold text-gray-900">
							{format(parseISO(event.startDatetime), 'EEEE, MMMM d, yyyy')}
						</div>
						<div class="text-sm text-gray-500">
							{format(parseISO(event.startDatetime), 'h:mm a')}
							{#if event.endDatetime}
								- {format(parseISO(event.endDatetime), 'h:mm a')}
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Description -->
			{#if event.description}
				<div class="bg-white rounded-lg border p-6">
					<h2 class="text-lg font-semibold text-gray-900 mb-3">About this event</h2>
					<p class="text-gray-700 whitespace-pre-line">{event.description}</p>
				</div>
			{/if}

			<!-- Location & Map -->
			{#if event.location || event.address}
				<div class="bg-white rounded-lg border p-6">
					<h2 class="text-lg font-semibold text-gray-900 mb-3">Location</h2>
					<div class="flex items-start gap-3 mb-4">
						<svg class="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						<div>
							{#if event.location}
								<div class="font-medium text-gray-900">{event.location}</div>
							{/if}
							{#if event.address}
								<div class="text-sm text-gray-500">{event.address}</div>
							{/if}
							<a
								href={getDirectionsUrl()}
								target="_blank"
								rel="noopener"
								class="text-purple-600 hover:underline text-sm mt-1 inline-block"
							>
								Get Directions
							</a>
						</div>
					</div>

					{#if event.latitude && event.longitude}
						<div class="h-64 rounded-lg overflow-hidden">
							<MapView
								events={[{
									id: event.id,
									title: event.title,
									description: event.description || '',
									start_datetime: event.startDatetime,
									end_datetime: event.endDatetime || undefined,
									location: event.location || undefined,
									address: event.address || undefined,
									latitude: Number(event.latitude),
									longitude: Number(event.longitude),
								}]}
								shops={[]}
							/>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Source -->
			{#if event.sourceName}
				<div class="text-sm text-gray-500">
					Source:
					{#if event.externalUrl}
						<a href={event.externalUrl} target="_blank" rel="noopener noreferrer" class="text-purple-600 hover:underline">
							{event.sourceName}
						</a>
					{:else}
						{event.sourceName}
					{/if}
				</div>
			{/if}

			<!-- Primary Shop -->
			{#if primaryShop}
				<div class="bg-white rounded-lg border p-6">
					<h2 class="text-lg font-semibold text-gray-900 mb-3">Hosted by</h2>
					<a href="/shops/{primaryShop.id}" class="text-purple-600 hover:underline font-medium">
						{primaryShop.name}
					</a>
				</div>
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="space-y-6">
			<!-- Calendar Actions -->
			<div class="bg-white rounded-lg border p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">Add to Calendar</h2>
				<div class="space-y-3">
					<a
						href={getGoogleCalendarUrl()}
						target="_blank"
						rel="noopener"
						class="flex items-center gap-3 w-full px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
					>
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none">
							<path d="M18.316 5.684L15.8 6.4l-2.4-1.2L12 6.4l-1.4-1.2-2.4 1.2L5.684 5.684A2 2 0 004 7.632V18a2 2 0 002 2h12a2 2 0 002-2V7.632a2 2 0 00-1.684-1.948z" stroke="#4285F4" stroke-width="1.5"/>
							<rect x="7" y="10" width="3" height="3" rx="0.5" fill="#EA4335"/>
							<rect x="10.5" y="10" width="3" height="3" rx="0.5" fill="#FBBC04"/>
							<rect x="14" y="10" width="3" height="3" rx="0.5" fill="#34A853"/>
						</svg>
						<span class="text-gray-700 text-sm">Google Calendar</span>
					</a>

					<a
						href={getOutlookCalendarUrl()}
						target="_blank"
						rel="noopener"
						class="flex items-center gap-3 w-full px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
					>
						<svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.8 7.5 12 11.82 4.2 7.5 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z"/>
						</svg>
						<span class="text-gray-700 text-sm">Outlook</span>
					</a>

					<a
						href="/api/events/{event.id}/calendar.ics"
						download
						class="flex items-center gap-3 w-full px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
					>
						<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						<span class="text-gray-700 text-sm">Download .ics</span>
					</a>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="space-y-3">
				{#if event.externalUrl}
					<a
						href={event.externalUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="block w-full bg-purple-600 text-white text-center py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
					>
						More Info
					</a>
				{/if}

				{#if event.latitude && event.longitude}
					<a
						href={getDirectionsUrl()}
						target="_blank"
						rel="noopener"
						class="block w-full bg-white text-purple-600 text-center py-3 rounded-lg font-medium border-2 border-purple-600 hover:bg-purple-50 transition-colors"
					>
						Get Directions
					</a>
				{/if}
			</div>

			<!-- Event Details Card -->
			<div class="bg-white rounded-lg border p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">Details</h2>
				<div class="space-y-3 text-sm">
					<div class="flex items-center gap-3">
						<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						<span class="text-gray-700">{format(parseISO(event.startDatetime), 'MMM d, yyyy')}</span>
					</div>

					<div class="flex items-center gap-3">
						<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span class="text-gray-700">
							{format(parseISO(event.startDatetime), 'h:mm a')}
							{#if event.endDatetime}
								- {format(parseISO(event.endDatetime), 'h:mm a')}
							{/if}
						</span>
					</div>

					{#if event.location}
						<div class="flex items-center gap-3">
							<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<span class="text-gray-700">{event.location}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</main>
