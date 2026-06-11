<script lang="ts">
	import type { PageData } from './$types';
	import type { JunkRunConfig } from '$lib/types/junk-run';

	export let data: PageData;

	// Deep clone to create a mutable local copy
	let config: JunkRunConfig = JSON.parse(JSON.stringify(data.config));

	let saving = false;
	let saveMessage = '';
	let showExcluded = false;

	function toggleTag(slug: string) {
		if (config.defaultTags.includes(slug)) {
			config.defaultTags = config.defaultTags.filter(t => t !== slug);
		} else {
			config.defaultTags = [...config.defaultTags, slug];
		}
	}

	function toggleExcluded(shopId: number) {
		if (config.excludedShopIds.includes(shopId)) {
			config.excludedShopIds = config.excludedShopIds.filter(id => id !== shopId);
		} else {
			config.excludedShopIds = [...config.excludedShopIds, shopId];
		}
	}

	async function saveConfig() {
		saving = true;
		saveMessage = '';
		try {
			const res = await fetch(`/api/admin/junk-runs/${config.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config),
			});
			const result = await res.json();
			if (result.success) {
				saveMessage = 'saved';
			} else {
				saveMessage = 'error';
			}
		} catch {
			saveMessage = 'error';
		}
		saving = false;
		setTimeout(() => { saveMessage = ''; }, 3000);
	}
</script>

<svelte:head>
	<title>Edit {config.name || 'Junk Run'} - Admin</title>
</svelte:head>

<div class="space-y-6 max-w-4xl">
	<div class="flex items-center gap-3">
		<a href="/admin/junk-runs" class="text-gray-400 hover:text-gray-600">&larr;</a>
		<h1 class="text-2xl font-bold text-gray-900">Edit: {config.name || config.slug}</h1>
		<a href="/junk-run/{config.slug}" target="_blank" class="ml-auto text-sm text-purple-600 hover:underline">View live</a>
	</div>

	{#if saveMessage === 'saved'}
		<div class="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Configuration saved.</div>
	{:else if saveMessage === 'error'}
		<div class="p-3 bg-red-50 text-red-700 rounded-lg text-sm">Failed to save configuration.</div>
	{/if}

	<!-- Section 1: General Settings -->
	<section class="bg-white rounded-lg border p-6 space-y-4">
		<h2 class="text-lg font-semibold text-gray-900 border-b pb-2">General Settings</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
				<input type="text" id="name" bind:value={config.name}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
			</div>
			<div>
				<label for="tagline" class="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
				<input type="text" id="tagline" bind:value={config.tagline}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label for="headerHtml" class="block text-sm font-medium text-gray-700 mb-1">Header HTML</label>
				<input type="text" id="headerHtml" bind:value={config.headerHtml}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
				<p class="text-xs text-gray-500 mt-1">Supports HTML tags like &lt;em&gt;</p>
			</div>
			<div>
				<label for="footerHtml" class="block text-sm font-medium text-gray-700 mb-1">Footer HTML</label>
				<input type="text" id="footerHtml" bind:value={config.footerHtml}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
			</div>
		</div>

		<div>
			<label for="logo" class="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
			<input type="url" id="logo" bind:value={config.logo}
				placeholder="https://example.com/logo.png"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
		</div>

		<!-- Theme Colors -->
		<div>
			<h3 class="text-sm font-medium text-gray-700 mb-2">Theme Colors</h3>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
				<div class="flex items-center gap-2">
					<input type="color" bind:value={config.theme.primary} class="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
					<span class="text-sm text-gray-600">Primary</span>
					<span class="text-xs text-gray-400">{config.theme.primary}</span>
				</div>
				<div class="flex items-center gap-2">
					<input type="color" bind:value={config.theme.accent} class="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
					<span class="text-sm text-gray-600">Accent</span>
					<span class="text-xs text-gray-400">{config.theme.accent}</span>
				</div>
				<div class="flex items-center gap-2">
					<input type="color" bind:value={config.theme.background} class="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
					<span class="text-sm text-gray-600">Background</span>
					<span class="text-xs text-gray-400">{config.theme.background}</span>
				</div>
				<div class="flex items-center gap-2">
					<input type="color" bind:value={config.theme.text} class="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
					<span class="text-sm text-gray-600">Text</span>
					<span class="text-xs text-gray-400">{config.theme.text}</span>
				</div>
				<div class="flex items-center gap-2">
					<input type="color" bind:value={config.theme.headerBg} class="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
					<span class="text-sm text-gray-600">Header BG</span>
					<span class="text-xs text-gray-400">{config.theme.headerBg}</span>
				</div>
				<div class="flex items-center gap-2">
					<input type="color" bind:value={config.theme.headerText} class="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
					<span class="text-sm text-gray-600">Header Text</span>
					<span class="text-xs text-gray-400">{config.theme.headerText}</span>
				</div>
			</div>
		</div>

		<!-- Map Settings -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label for="mapLat" class="block text-sm font-medium text-gray-700 mb-1">Map Center Lat</label>
				<input type="number" id="mapLat" bind:value={config.mapCenter[0]} step="0.001"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
			</div>
			<div>
				<label for="mapLng" class="block text-sm font-medium text-gray-700 mb-1">Map Center Lng</label>
				<input type="number" id="mapLng" bind:value={config.mapCenter[1]} step="0.001"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
			</div>
			<div>
				<label for="mapZoom" class="block text-sm font-medium text-gray-700 mb-1">Map Zoom</label>
				<input type="number" id="mapZoom" bind:value={config.mapZoom} min="5" max="18"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
			</div>
		</div>

		<!-- Category Tags -->
		<div>
			<h3 class="text-sm font-medium text-gray-700 mb-2">Shop Categories to Include</h3>
			<div class="flex flex-wrap gap-2">
				{#each data.allCategories as cat}
					<button type="button"
						on:click={() => toggleTag(cat.slug)}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors
							{config.defaultTags.includes(cat.slug) ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}">
						{#if cat.color}
							<span class="w-3 h-3 rounded-full inline-block" style="background: {cat.color};"></span>
						{/if}
						{cat.name}
					</button>
				{/each}
			</div>
		</div>

		<label class="flex items-center gap-3">
			<input type="checkbox" bind:checked={config.showSalesToday}
				class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
			<span class="text-sm text-gray-700">Show "Sale Today" badges</span>
		</label>
	</section>

	<!-- Section 2: Flyer Template Selection -->
	<section class="bg-white rounded-lg border p-6 space-y-4">
		<h2 class="text-lg font-semibold text-gray-900 border-b pb-2">Flyer Template</h2>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			{#each [
				{ value: 'map-focus', label: 'Map Focus', desc: 'Full-width map with numbered markers. Clean 2-column directory on page 2. Best for spread-out areas.' },
				{ value: 'directory-focus', label: 'Directory Focus', desc: 'Half-page map with categorized shop list and addresses. Page 2 only if needed. Best for dense areas.' },
				{ value: 'postcard', label: 'Postcard', desc: 'Single page handout. Compact map, name grid, one route QR. Best for events and farmer\'s markets.' },
			] as tmpl}
				<button type="button"
					on:click={() => config.flyer.template = tmpl.value}
					class="block p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm text-left
						{config.flyer.template === tmpl.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}">
					<div class="font-semibold text-gray-900 text-sm mb-1">{tmpl.label}</div>
					<p class="text-xs text-gray-500 leading-relaxed">{tmpl.desc}</p>
				</button>
			{/each}
		</div>
	</section>

	<!-- Section 3: Display Options -->
	<section class="bg-white rounded-lg border p-6 space-y-4">
		<h2 class="text-lg font-semibold text-gray-900 border-b pb-2">Display Options</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- Toggles -->
			<div class="space-y-3">
				<label class="flex items-center gap-3">
					<input type="checkbox" bind:checked={config.flyer.showPhoneNumbers}
						class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
					<span class="text-sm text-gray-700">Show phone numbers</span>
				</label>
				<label class="flex items-center gap-3">
					<input type="checkbox" bind:checked={config.flyer.showHours}
						class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
					<span class="text-sm text-gray-700">Show operating hours</span>
					<span class="text-xs text-amber-600">(can add clutter)</span>
				</label>
				<label class="flex items-center gap-3">
					<input type="checkbox" bind:checked={config.flyer.showSaleBadges}
						class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
					<span class="text-sm text-gray-700">Show sale badges</span>
				</label>
				<label class="flex items-center gap-3">
					<input type="checkbox" bind:checked={config.flyer.showCategoryLegend}
						class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
					<span class="text-sm text-gray-700">Show category legend</span>
				</label>
			</div>

			<!-- Selects -->
			<div class="space-y-3">
				<div>
					<label for="qrMode" class="block text-sm font-medium text-gray-700 mb-1">QR Code Mode</label>
					<select id="qrMode" bind:value={config.flyer.qrMode}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
						<option value="route">Single route QR (recommended)</option>
						<option value="individual">Individual QR per shop</option>
						<option value="none">No QR codes</option>
					</select>
					<p class="text-xs text-gray-500 mt-1">Route QR opens Google Maps with all shops as stops.</p>
				</div>

				<div>
					<label for="fontSize" class="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
					<select id="fontSize" bind:value={config.flyer.fontSize}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
						<option value="compact">Compact (7.5px)</option>
						<option value="normal">Normal (9px)</option>
						<option value="large">Large (10px)</option>
					</select>
				</div>

				<div>
					<label for="columnCount" class="block text-sm font-medium text-gray-700 mb-1">Column Count</label>
					<select id="columnCount" bind:value={config.flyer.columnCount}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
						<option value="auto">Auto (adapts to shop count)</option>
						<option value={2}>2 columns</option>
						<option value={3}>3 columns</option>
						<option value={4}>4 columns</option>
					</select>
				</div>

				<div>
					<label for="maxShopsPerPage" class="block text-sm font-medium text-gray-700 mb-1">Max Shops Per Page</label>
					<input type="number" id="maxShopsPerPage" bind:value={config.flyer.maxShopsPerPage} min="5" max="40"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
					<p class="text-xs text-gray-500 mt-1">Directory wraps to page 2 beyond this count.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Section 4: Shop Selection -->
	<section class="bg-white rounded-lg border p-6 space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900">Shop Selection</h2>
			<button type="button" on:click={() => showExcluded = !showExcluded}
				class="text-sm text-purple-600 hover:underline">
				{showExcluded ? 'Hide' : 'Show'} exclusion list ({config.excludedShopIds.length} excluded)
			</button>
		</div>

		{#if showExcluded}
			<p class="text-sm text-gray-500">Check shops to <strong>exclude</strong> them from the flyer. They will remain in the main directory.</p>
			<div class="max-h-64 overflow-y-auto border rounded-lg divide-y">
				{#each data.shops as shop}
					{@const cat = data.allCategories.find(c => c.id === shop.categoryId)}
					<label class="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer">
						<input type="checkbox"
							checked={config.excludedShopIds.includes(shop.id)}
							on:change={() => toggleExcluded(shop.id)}
							class="w-4 h-4 text-red-500 rounded focus:ring-red-400" />
						<span class="text-sm text-gray-800">{shop.name}</span>
						{#if cat}
							<span class="text-xs px-1.5 py-0.5 rounded-full" style="background: {cat.color}20; color: {cat.color};">{cat.name}</span>
						{/if}
						{#if shop.address}
							<span class="text-xs text-gray-400 ml-auto truncate max-w-48">{shop.address}</span>
						{/if}
					</label>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Section 5: Custom Content -->
	<section class="bg-white rounded-lg border p-6 space-y-4">
		<h2 class="text-lg font-semibold text-gray-900 border-b pb-2">Custom Content</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label for="sponsorLogoUrl" class="block text-sm font-medium text-gray-700 mb-1">Sponsor Logo URL</label>
				<input type="url" id="sponsorLogoUrl" bind:value={config.customContent.sponsorLogoUrl}
					placeholder="https://example.com/sponsor-logo.png"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
			</div>
			<div>
				<label for="sponsorLogoPlacement" class="block text-sm font-medium text-gray-700 mb-1">Logo Placement</label>
				<select id="sponsorLogoPlacement" bind:value={config.customContent.sponsorLogoPlacement}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
					<option value="none">None</option>
					<option value="header">Header</option>
					<option value="footer">Footer</option>
				</select>
			</div>
		</div>

		<div>
			<label for="announcementText" class="block text-sm font-medium text-gray-700 mb-1">Announcement Text</label>
			<textarea id="announcementText" bind:value={config.customContent.announcementText} rows="2"
				placeholder="e.g., Spring Sale Weekend - April 12-13!"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
			></textarea>
			<p class="text-xs text-gray-500 mt-1">Displayed as a banner on the flyer.</p>
		</div>
	</section>

	<!-- Save Button -->
	<div class="flex items-center gap-4 pb-8">
		<button type="button" on:click={saveConfig} disabled={saving}
			class="px-8 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50">
			{saving ? 'Saving...' : 'Save Configuration'}
		</button>
		<a href="/admin/junk-runs" class="text-sm text-gray-500 hover:text-gray-700">Cancel</a>
	</div>
</div>
