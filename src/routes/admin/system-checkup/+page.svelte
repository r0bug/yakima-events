<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	let pm2Status = '';
	let checkingPm2 = false;

	async function checkPm2() {
		checkingPm2 = true;
		try {
			const res = await fetch('/api/admin/system-checkup');
			const result = await res.json();
			pm2Status = result.pm2Status || 'Unable to check';
		} catch {
			pm2Status = 'Failed to check';
		} finally {
			checkingPm2 = false;
		}
	}
</script>

<svelte:head>
	<title>System Checkup - Admin</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-gray-900">System Checkup</h1>

	<!-- Status Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div class="bg-white rounded-lg border p-4">
			<div class="flex items-center gap-3">
				<div class="w-3 h-3 rounded-full {data.dbConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
				<div>
					<div class="font-medium text-gray-900">Database</div>
					<div class="text-sm text-gray-500">{data.dbConnected ? 'Connected' : 'Disconnected'}</div>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg border p-4">
			<div class="flex items-center gap-3">
				<div class="w-3 h-3 rounded-full bg-green-500"></div>
				<div>
					<div class="font-medium text-gray-900">SvelteKit Server</div>
					<div class="text-sm text-gray-500">Running</div>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg border p-4">
			<div class="flex items-center gap-3">
				<div class="w-3 h-3 rounded-full bg-blue-500"></div>
				<div>
					<div class="font-medium text-gray-900">Server Time</div>
					<div class="text-sm text-gray-500">{new Date(data.serverTime).toLocaleString()}</div>
				</div>
			</div>
		</div>
	</div>

	<!-- PM2 Status -->
	<div class="bg-white rounded-lg border p-6">
		<div class="flex items-center justify-between mb-3">
			<h2 class="font-semibold text-gray-900">PM2 Process</h2>
			<button
				on:click={checkPm2}
				disabled={checkingPm2}
				class="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 disabled:opacity-50"
			>
				{checkingPm2 ? 'Checking...' : 'Check Status'}
			</button>
		</div>
		{#if pm2Status}
			<pre class="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">{pm2Status}</pre>
		{:else}
			<p class="text-sm text-gray-500">Click "Check Status" to view PM2 process information.</p>
		{/if}
	</div>

	<!-- Table Counts -->
	<div class="bg-white rounded-lg border p-6">
		<h2 class="font-semibold text-gray-900 mb-4">Database Table Counts</h2>
		<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
			{#each Object.entries(data.tableCounts) as [table, count]}
				<div class="flex justify-between items-center py-2 border-b last:border-0">
					<span class="text-gray-600 capitalize">{table}</span>
					<span class="font-mono font-medium text-gray-900">{count}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Active Scraper Sources -->
	<div class="bg-white rounded-lg border p-6">
		<h2 class="font-semibold text-gray-900 mb-4">Active Scraper Sources ({data.activeSources.length})</h2>
		{#if data.activeSources.length === 0}
			<p class="text-gray-500 text-sm">No active scraper sources.</p>
		{:else}
			<div class="space-y-2">
				{#each data.activeSources as source}
					<div class="flex items-center justify-between py-1">
						<span class="text-sm text-gray-700">{source.name}</span>
						<a href={source.url} target="_blank" rel="noopener" class="text-xs text-purple-600 hover:underline truncate max-w-xs">
							{source.url}
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Recent Events -->
	<div class="bg-white rounded-lg border p-6">
		<h2 class="font-semibold text-gray-900 mb-4">Recently Created Events</h2>
		<div class="space-y-2">
			{#each data.recentEvents as event}
				<div class="flex items-center justify-between py-1">
					<div class="flex items-center gap-2">
						<span class="px-2 py-0.5 text-xs rounded-full {
							event.status === 'approved' ? 'bg-green-100 text-green-700' :
							event.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
							'bg-red-100 text-red-700'
						}">
							{event.status}
						</span>
						<a href="/events/{event.id}" class="text-sm text-gray-700 hover:text-purple-600">{event.title}</a>
					</div>
					<span class="text-xs text-gray-400">
						{event.createdAt ? new Date(event.createdAt).toLocaleDateString() : ''}
					</span>
				</div>
			{/each}
		</div>
	</div>
</div>
