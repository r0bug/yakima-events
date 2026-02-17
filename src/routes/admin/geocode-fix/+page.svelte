<script lang="ts">
	import type { PageData } from './$types';
	import MapView from '$lib/components/MapView.svelte';

	export let data: PageData;

	let geocoding = '';

	async function geocodeShop(shopId: number, address: string) {
		geocoding = `shop-${shopId}`;
		try {
			const res = await fetch(`/api/shops/${shopId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ geocode: true, address }),
			});
			if (res.ok) {
				data.shopsNeedingGeocode = data.shopsNeedingGeocode.filter(s => s.id !== shopId);
			}
		} catch (e) {
			console.error('Geocode failed:', e);
		} finally {
			geocoding = '';
		}
	}

	async function geocodeEvent(eventId: number, address: string) {
		geocoding = `event-${eventId}`;
		try {
			const res = await fetch(`/api/events/${eventId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ geocode: true, address }),
			});
			if (res.ok) {
				data.eventsNeedingGeocode = data.eventsNeedingGeocode.filter(e => e.id !== eventId);
			}
		} catch (e) {
			console.error('Geocode failed:', e);
		} finally {
			geocoding = '';
		}
	}
</script>

<svelte:head>
	<title>Geocode Fix - Admin</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-gray-900">Geocode Fix</h1>
	<p class="text-gray-600">Fix shops and events with missing or incorrect coordinates.</p>

	<!-- Map of all shop locations -->
	{#if data.allShopsWithCoords.length > 0}
		<div class="bg-white rounded-lg border overflow-hidden">
			<div class="p-4 border-b">
				<h2 class="font-semibold text-gray-900">All Shop Locations ({data.allShopsWithCoords.length})</h2>
			</div>
			<div class="h-80">
				<MapView
					events={[]}
					shops={data.allShopsWithCoords.map(s => ({
						id: s.id,
						name: s.name,
						latitude: Number(s.latitude),
						longitude: Number(s.longitude),
					}))}
				/>
			</div>
		</div>
	{/if}

	<!-- Shops needing geocode -->
	<div class="bg-white rounded-lg border">
		<div class="p-4 border-b">
			<h2 class="font-semibold text-gray-900">
				Shops Missing Coordinates ({data.shopsNeedingGeocode.length})
			</h2>
		</div>
		{#if data.shopsNeedingGeocode.length === 0}
			<div class="p-6 text-center text-green-600">All shops have valid coordinates.</div>
		{:else}
			<div class="divide-y">
				{#each data.shopsNeedingGeocode as shop}
					<div class="p-4 flex items-center justify-between">
						<div>
							<div class="font-medium text-gray-900">{shop.name}</div>
							<div class="text-sm text-gray-500">{shop.address || 'No address'}</div>
							<div class="text-xs text-gray-400">
								Coords: {shop.latitude || 'null'}, {shop.longitude || 'null'}
							</div>
						</div>
						{#if shop.address}
							<button
								on:click={() => geocodeShop(shop.id, shop.address)}
								disabled={geocoding === `shop-${shop.id}`}
								class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
							>
								{geocoding === `shop-${shop.id}` ? 'Geocoding...' : 'Re-geocode'}
							</button>
						{:else}
							<span class="text-xs text-gray-400">No address to geocode</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Events needing geocode -->
	<div class="bg-white rounded-lg border">
		<div class="p-4 border-b">
			<h2 class="font-semibold text-gray-900">
				Events Missing Coordinates ({data.eventsNeedingGeocode.length})
			</h2>
		</div>
		{#if data.eventsNeedingGeocode.length === 0}
			<div class="p-6 text-center text-green-600">All events with addresses have coordinates.</div>
		{:else}
			<div class="divide-y">
				{#each data.eventsNeedingGeocode as event}
					<div class="p-4 flex items-center justify-between">
						<div>
							<div class="font-medium text-gray-900">{event.title}</div>
							<div class="text-sm text-gray-500">{event.address || event.location}</div>
						</div>
						<button
							on:click={() => geocodeEvent(event.id, event.address || event.location || '')}
							disabled={geocoding === `event-${event.id}`}
							class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
						>
							{geocoding === `event-${event.id}` ? 'Geocoding...' : 'Re-geocode'}
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
