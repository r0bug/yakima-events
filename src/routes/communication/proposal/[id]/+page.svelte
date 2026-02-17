<script lang="ts">
	import type { PageData } from './$types';
	import { format } from 'date-fns';
	import { invalidateAll } from '$app/navigation';

	export let data: PageData;

	let acting = false;
	let actionError = '';

	async function handleAction(shopId: number, action: 'approve' | 'reject') {
		acting = true;
		actionError = '';

		try {
			const response = await fetch(`/api/events/${data.event.id}/participants`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ shopId, action }),
			});

			const result = await response.json();
			if (!response.ok) throw new Error(result.error || `Failed to ${action}`);

			await invalidateAll();
		} catch (e) {
			actionError = e instanceof Error ? e.message : `Failed to ${action}`;
		} finally {
			acting = false;
		}
	}
</script>

<svelte:head>
	<title>Proposal: {data.event.title} - Yakima Events</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-2xl mx-auto px-4 py-8">
		<nav class="mb-6 text-sm">
			<a href="/communication" class="text-purple-600 hover:underline">Communication Hub</a>
			<span class="mx-2 text-gray-400">/</span>
			<span class="text-gray-600">Proposal</span>
		</nav>

		<!-- Status Badge -->
		<div class="mb-4">
			{#if data.allApproved}
				<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">All Approved</span>
			{:else if data.anyRejected}
				<span class="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">Rejected</span>
			{:else}
				<span class="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Pending Approval</span>
			{/if}
		</div>

		<h1 class="text-2xl font-bold text-gray-900 mb-2">{data.event.title}</h1>

		{#if actionError}
			<div class="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{actionError}</div>
		{/if}

		<!-- Event Details -->
		<div class="bg-white rounded-lg border p-6 mb-6 space-y-3">
			<div class="flex items-center gap-3 text-gray-700">
				<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<span>
					{data.event.startDatetime ? format(new Date(data.event.startDatetime), 'EEEE, MMMM d, yyyy h:mm a') : 'TBD'}
					{#if data.event.endDatetime}
						- {format(new Date(data.event.endDatetime), 'h:mm a')}
					{/if}
				</span>
			</div>

			{#if data.event.location || data.event.address}
				<div class="flex items-center gap-3 text-gray-700">
					<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					<span>{data.event.location || data.event.address}</span>
				</div>
			{/if}

			{#if data.event.description}
				<div class="pt-3 border-t">
					<p class="text-gray-700 whitespace-pre-line">{data.event.description}</p>
				</div>
			{/if}
		</div>

		<!-- Participants -->
		<div class="bg-white rounded-lg border p-6 mb-6">
			<h2 class="font-semibold text-gray-900 mb-4">Participating Shops</h2>
			<div class="space-y-3">
				{#each data.participants as participant}
					<div class="flex items-center justify-between py-2 {participant.status === 'pending' ? 'border-l-4 border-yellow-400 pl-3' : 'pl-4'}">
						<div>
							<a href="/shops/{participant.shopId}" class="font-medium text-purple-600 hover:underline">
								{participant.shopName}
							</a>
						</div>
						<div class="flex items-center gap-2">
							<span class="px-2 py-1 rounded-full text-xs font-medium {
								participant.status === 'approved' ? 'bg-green-100 text-green-700' :
								participant.status === 'rejected' ? 'bg-red-100 text-red-700' :
								'bg-yellow-100 text-yellow-700'
							}">
								{participant.status}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Action Buttons for Pending -->
		{#if data.pendingForUser.length > 0}
			<div class="bg-purple-50 border border-purple-200 rounded-lg p-6">
				<h2 class="font-semibold text-gray-900 mb-3">Your Response Required</h2>
				{#each data.pendingForUser as pending}
					<div class="flex items-center justify-between py-3">
						<span class="text-gray-700">
							Approve for <strong>{pending.shopName}</strong>?
						</span>
						<div class="flex gap-2">
							<button
								on:click={() => handleAction(pending.shopId, 'reject')}
								disabled={acting}
								class="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm disabled:opacity-50"
							>
								Reject
							</button>
							<button
								on:click={() => handleAction(pending.shopId, 'approve')}
								disabled={acting}
								class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
							>
								{acting ? 'Processing...' : 'Approve'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-6">
			<a href="/communication" class="text-purple-600 hover:underline text-sm">
				Back to Communication Hub
			</a>
		</div>
	</div>
</div>
