<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<svelte:head>
	<title>Junk Runs - Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Junk Run Configurations</h1>
	</div>

	{#if data.configs.length === 0}
		<div class="bg-white rounded-lg border p-8 text-center text-gray-500">
			No junk run configurations found.
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each data.configs as config}
				<a
					href="/admin/junk-runs/{config.slug}"
					class="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow block"
				>
					<div class="flex items-start gap-4">
						<div
							class="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
							style="background: {config.theme.primary};"
						>
							{config.name.charAt(0)}
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="font-semibold text-gray-900">{config.name}</h3>
							<p class="text-sm text-gray-500 mt-0.5">{config.tagline}</p>
							<div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
								<span>Template: {config.flyer.template}</span>
								<span>Tags: {config.defaultTags.length}</span>
								<span>QR: {config.flyer.qrMode}</span>
							</div>
						</div>
					</div>
					<div class="flex gap-1.5 mt-3">
						{#each Object.values(config.theme) as color}
							<div
								class="w-6 h-6 rounded border border-gray-200"
								style="background: {color};"
								title={color}
							></div>
						{/each}
					</div>
				</a>
			{/each}
		</div>
	{/if}

	<div class="text-sm text-gray-500">
		<a href="/junk-run/vintiques" class="text-purple-600 hover:underline" target="_blank">View live junk run page</a>
	</div>
</div>
