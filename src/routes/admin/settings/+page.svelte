<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';

	export let data: PageData;
	export let form: ActionData;
</script>

<svelte:head>
	<title>Site Settings - Admin</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-gray-900">Site Settings</h1>

	{#if form?.success}
		<div class="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Settings saved.</div>
	{/if}
	{#if form?.error}
		<div class="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{form.error}</div>
	{/if}

	<form method="POST" use:enhance class="bg-white rounded-lg border p-6 space-y-6 max-w-2xl">
		<div>
			<label class="flex items-center gap-3">
				<input
					type="checkbox"
					name="showUnapprovedEvents"
					checked={form?.settings?.showUnapprovedEvents ?? data.settings.showUnapprovedEvents}
					class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
				/>
				<div>
					<span class="font-medium text-gray-900">Show unapproved events on public calendar</span>
					<p class="text-sm text-gray-500">When enabled, pending events will appear on the public calendar with a warning badge.</p>
				</div>
			</label>
		</div>

		<div>
			<label for="disclaimerText" class="block text-sm font-medium text-gray-700 mb-1">
				Custom Disclaimer Text
			</label>
			<textarea
				id="disclaimerText"
				name="disclaimerText"
				rows="4"
				value={form?.settings?.disclaimerText ?? data.settings.disclaimerText}
				placeholder="e.g., Event information is sourced from third parties and may not be accurate."
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
			></textarea>
			<p class="text-xs text-gray-500 mt-1">Displayed at the bottom of the public calendar.</p>
		</div>

		<button
			type="submit"
			class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
		>
			Save Settings
		</button>
	</form>
</div>
