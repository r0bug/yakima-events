<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	export let data: PageData;

	let form = {
		title: '',
		description: '',
		startDatetime: '',
		endDatetime: '',
		location: '',
		address: '',
		primaryShopId: data.userShops[0]?.shopId || 0,
		participantShopIds: [] as number[],
	};

	let submitting = false;
	let error = '';

	function toggleParticipant(shopId: number) {
		if (shopId === form.primaryShopId) return;
		const idx = form.participantShopIds.indexOf(shopId);
		if (idx >= 0) {
			form.participantShopIds = form.participantShopIds.filter(id => id !== shopId);
		} else {
			form.participantShopIds = [...form.participantShopIds, shopId];
		}
	}

	async function submit() {
		if (!form.title.trim()) { error = 'Title is required'; return; }
		if (!form.startDatetime) { error = 'Start date/time is required'; return; }
		if (!form.primaryShopId) { error = 'Select your primary shop'; return; }

		submitting = true;
		error = '';

		try {
			const response = await fetch('/api/events/propose', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...form,
					startDatetime: new Date(form.startDatetime).toISOString(),
					endDatetime: form.endDatetime ? new Date(form.endDatetime).toISOString() : null,
				}),
			});

			const result = await response.json();
			if (!response.ok) throw new Error(result.error || 'Failed to submit proposal');

			goto('/communication');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to submit';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Propose Collaborative Event - Yakima Events</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-2xl mx-auto px-4 py-8">
		<nav class="mb-6 text-sm">
			<a href="/communication" class="text-purple-600 hover:underline">Communication Hub</a>
			<span class="mx-2 text-gray-400">/</span>
			<span class="text-gray-600">Propose Event</span>
		</nav>

		<h1 class="text-2xl font-bold text-gray-900 mb-2">Propose Collaborative Event</h1>
		<p class="text-gray-600 mb-6">
			Create an event and invite other shops to participate. They'll need to approve before it goes live.
		</p>

		{#if error}
			<div class="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
		{/if}

		<form on:submit|preventDefault={submit} class="space-y-6">
			<div class="bg-white rounded-lg border p-6 space-y-4">
				<h2 class="font-semibold text-gray-900">Event Details</h2>

				<div>
					<label for="title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
					<input
						id="title"
						type="text"
						bind:value={form.title}
						placeholder="Event title"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
						required
					/>
				</div>

				<div>
					<label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
					<textarea
						id="description"
						bind:value={form.description}
						placeholder="Describe the event"
						rows="4"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
					></textarea>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label for="start" class="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
						<input
							id="start"
							type="datetime-local"
							bind:value={form.startDatetime}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
							required
						/>
					</div>
					<div>
						<label for="end" class="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
						<input
							id="end"
							type="datetime-local"
							bind:value={form.endDatetime}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
						/>
					</div>
				</div>

				<div>
					<label for="location" class="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
					<input
						id="location"
						type="text"
						bind:value={form.location}
						placeholder="e.g., Downtown Yakima"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
					/>
				</div>

				<div>
					<label for="address" class="block text-sm font-medium text-gray-700 mb-1">Address</label>
					<input
						id="address"
						type="text"
						bind:value={form.address}
						placeholder="Full street address"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
					/>
				</div>
			</div>

			<div class="bg-white rounded-lg border p-6 space-y-4">
				<h2 class="font-semibold text-gray-900">Your Shop (Host)</h2>
				<div class="flex flex-wrap gap-2">
					{#each data.userShops as shop}
						<button
							type="button"
							on:click={() => (form.primaryShopId = shop.shopId)}
							class="px-4 py-2 rounded-lg border text-sm transition-colors {form.primaryShopId === shop.shopId
								? 'bg-purple-600 text-white border-purple-600'
								: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
						>
							{shop.shopName}
						</button>
					{/each}
				</div>
			</div>

			<div class="bg-white rounded-lg border p-6 space-y-4">
				<h2 class="font-semibold text-gray-900">Invite Participating Shops</h2>
				<p class="text-sm text-gray-500">Select shops to invite as participants. They'll need to approve the event.</p>
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
					{#each data.allShops.filter(s => s.id !== form.primaryShopId) as shop}
						<button
							type="button"
							on:click={() => toggleParticipant(shop.id)}
							class="px-3 py-2 rounded-lg border text-sm text-left transition-colors {form.participantShopIds.includes(shop.id)
								? 'bg-purple-100 text-purple-800 border-purple-300'
								: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}"
						>
							{shop.name}
						</button>
					{/each}
				</div>
				{#if form.participantShopIds.length > 0}
					<p class="text-sm text-purple-600">{form.participantShopIds.length} shop(s) selected</p>
				{/if}
			</div>

			<div class="flex gap-3">
				<a
					href="/communication"
					class="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition-colors"
				>
					Cancel
				</a>
				<button
					type="submit"
					disabled={submitting}
					class="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
				>
					{submitting ? 'Submitting...' : 'Submit Proposal'}
				</button>
			</div>
		</form>
	</div>
</div>
