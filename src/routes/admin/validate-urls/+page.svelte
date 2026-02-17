<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	interface UrlResult {
		id: number;
		name: string;
		url: string;
		status: number | null;
		responseTime: number | null;
		error: string | null;
		checking: boolean;
	}

	let results: UrlResult[] = data.sources.map(s => ({
		...s,
		status: null,
		responseTime: null,
		error: null,
		checking: false,
	}));

	let validating = false;

	async function validateUrl(idx: number) {
		results[idx].checking = true;
		results[idx].error = null;
		results = results;

		const start = performance.now();
		try {
			const res = await fetch(`/api/admin/validate-url?url=${encodeURIComponent(results[idx].url)}`);
			const data = await res.json();
			results[idx].status = data.status;
			results[idx].responseTime = Math.round(data.responseTime);
			results[idx].error = data.error || null;
		} catch (e) {
			results[idx].error = 'Request failed';
			results[idx].status = null;
			results[idx].responseTime = Math.round(performance.now() - start);
		} finally {
			results[idx].checking = false;
			results = results;
		}
	}

	async function validateAll() {
		validating = true;
		for (let i = 0; i < results.length; i++) {
			await validateUrl(i);
		}
		validating = false;
	}

	function statusClass(status: number | null): string {
		if (!status) return 'text-gray-400';
		if (status >= 200 && status < 300) return 'text-green-600';
		if (status >= 300 && status < 400) return 'text-yellow-600';
		return 'text-red-600';
	}
</script>

<svelte:head>
	<title>URL Validator - Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">URL Validator</h1>
			<p class="text-gray-600">Check calendar source URLs for availability.</p>
		</div>
		<button
			on:click={validateAll}
			disabled={validating}
			class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
		>
			{validating ? 'Checking...' : 'Validate All'}
		</button>
	</div>

	<div class="bg-white rounded-lg border overflow-hidden">
		<table class="w-full">
			<thead class="bg-gray-50">
				<tr>
					<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
					<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
					<th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
					<th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Time</th>
					<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
				</tr>
			</thead>
			<tbody class="divide-y">
				{#each results as result, idx}
					<tr class="hover:bg-gray-50">
						<td class="px-4 py-3">
							<div class="font-medium text-gray-900 text-sm">{result.name}</div>
							<div class="text-xs text-gray-400">{result.type}</div>
						</td>
						<td class="px-4 py-3">
							<a
								href={result.url}
								target="_blank"
								rel="noopener"
								class="text-sm text-purple-600 hover:underline break-all max-w-md block truncate"
							>
								{result.url}
							</a>
						</td>
						<td class="px-4 py-3 text-center">
							{#if result.checking}
								<span class="text-gray-400 text-sm animate-pulse">...</span>
							{:else if result.status !== null}
								<span class="font-mono text-sm font-medium {statusClass(result.status)}">
									{result.status}
								</span>
							{:else if result.error}
								<span class="text-red-600 text-xs">{result.error}</span>
							{:else}
								<span class="text-gray-300 text-sm">-</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-center text-sm text-gray-500">
							{result.responseTime !== null ? `${result.responseTime}ms` : '-'}
						</td>
						<td class="px-4 py-3 text-right">
							<button
								on:click={() => validateUrl(idx)}
								disabled={result.checking}
								class="text-sm text-purple-600 hover:text-purple-800 disabled:opacity-50"
							>
								Check
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if results.length === 0}
			<div class="p-8 text-center text-gray-500">No active calendar sources found.</div>
		{/if}
	</div>
</div>
