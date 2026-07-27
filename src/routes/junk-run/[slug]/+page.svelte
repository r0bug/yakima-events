<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { PageData } from './$types';
  import { getYakimaRegion, REGION_LABELS } from '$lib/utils/geo';
  import JunkRunFlyer from '$lib/components/JunkRunFlyer.svelte';

  export let data: PageData;

  $: config = data.config;
  $: allShops = data.shops;
  $: categories = data.categories;
  $: salesToday = data.salesToday;

  // Build category lookup
  $: catById = new Map(categories.map(c => [c.id, c]));
  $: catBySlug = new Map(categories.map(c => [c.slug, c]));

  // Derive regions from shop addresses
  $: shopsWithRegion = allShops.map(s => ({
    ...s,
    region: getYakimaRegion(s.address || ''),
    category: catById.get(s.categoryId || 0),
  }));

  // Get unique regions that have shops
  $: regions = [...new Set(shopsWithRegion.map(s => s.region))].sort();

  // Filter state
  let selectedCategory = '';
  let selectedRegion = '';
  let showSales = false;
  let selectedShopId: number | null = null;
  let showFlyer = false;
  let routeMode = false;
  let routeSelected: Set<number> = new Set();

  // Shops with sales today
  $: shopIdsWithSales = new Set(salesToday.map(s => s.shopId));

  $: filteredShops = shopsWithRegion.filter(s => {
    if (selectedCategory && s.category?.slug !== selectedCategory) return false;
    if (selectedRegion && s.region !== selectedRegion) return false;
    if (showSales && !shopIdsWithSales.has(s.id)) return false;
    return true;
  });

  // Group by region for listing
  $: groupedShops = (() => {
    const groups: Record<string, typeof filteredShops> = {};
    for (const s of filteredShops) {
      if (!groups[s.region]) groups[s.region] = [];
      groups[s.region].push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  })();

  // Map
  let mapContainer: HTMLDivElement;
  let map: any;
  let markers: any[] = [];
  let L: any;

  onMount(async () => {
    if (!browser) return;
    L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');

    map = L.map(mapContainer, { zoomControl: true }).setView(
      config.mapCenter,
      config.mapZoom
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    updateMarkers();
  });

  function createStarIcon(num: number, color: string, isSelected: boolean, hasSale: boolean) {
    const size = isSelected ? 40 : 32;
    const strokeWidth = isSelected ? 3 : 1.5;
    const badge = hasSale
      ? `<circle cx="${size - 6}" cy="6" r="6" fill="#ef4444" stroke="white" stroke-width="1.5"/>
         <text x="${size - 6}" y="10" text-anchor="middle" fill="white" font-size="9" font-weight="bold">!</text>`
      : '';
    return L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <polygon points="${starPoints(size / 2, size / 2, size * 0.45, size * 0.2, 5)}"
          fill="${color}" stroke="${isSelected ? '#000' : '#fff'}" stroke-width="${strokeWidth}" opacity="0.95"/>
        <text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle" fill="white" font-size="${size * 0.32}" font-weight="bold" style="text-shadow:0 1px 2px rgba(0,0,0,.5)">${num}</text>
        ${badge}
      </svg>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      className: 'junkrun-marker',
    });
  }

  function starPoints(cx: number, cy: number, outerR: number, innerR: number, pts: number): string {
    const points: string[] = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle = (Math.PI / pts) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return points.join(' ');
  }

  function updateMarkers() {
    if (!map || !L) return;
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    filteredShops.forEach((shop, i) => {
      if (!shop.latitude || !shop.longitude) return;
      const cat = shop.category;
      const color = cat?.color || '#6b7280';
      const hasSale = shopIdsWithSales.has(shop.id);
      const isSelected = shop.id === selectedShopId;

      const marker = L.marker([shop.latitude, shop.longitude], {
        icon: createStarIcon(i + 1, color, isSelected, hasSale),
        zIndexOffset: isSelected ? 1000 : 0,
      }).addTo(map);

      marker.on('click', () => selectShop(shop.id));

      marker.bindPopup(`
        <div style="min-width:180px">
          <strong>${shop.name}</strong><br/>
          <span style="color:${color};font-size:11px">${cat?.name || 'Shop'}</span><br/>
          ${shop.address ? `<span style="font-size:12px;color:#666">${shop.address}</span><br/>` : ''}
          ${shop.phone ? `<a href="tel:${shop.phone}" style="font-size:12px">${shop.phone}</a><br/>` : ''}
          ${hasSale ? '<span style="color:#ef4444;font-weight:bold;font-size:11px">SALE TODAY</span>' : ''}
        </div>
      `);

      markers.push(marker);
    });

    if (markers.length > 0 && !selectedShopId) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  $: if (browser && map && L) {
    // Reactively update markers when filters change
    filteredShops;
    selectedShopId;
    updateMarkers();
  }

  function selectShop(id: number) {
    selectedShopId = selectedShopId === id ? null : id;
    if (selectedShopId) {
      const shop = filteredShops.find(s => s.id === id);
      if (shop?.latitude && shop?.longitude) {
        map?.setView([shop.latitude, shop.longitude], 15);
      }
      // Scroll to shop card
      const el = document.getElementById(`shop-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function toggleRouteShop(id: number) {
    if (routeSelected.has(id)) {
      routeSelected.delete(id);
    } else {
      routeSelected.add(id);
    }
    routeSelected = routeSelected; // trigger reactivity
  }

  function selectAllForRoute() {
    routeSelected = new Set(filteredShops.filter(s => s.latitude && s.longitude).map(s => s.id));
  }

  function clearRouteSelection() {
    routeSelected = new Set();
  }

  function buildRouteUrl(): string | null {
    const selected = filteredShops.filter(s => routeSelected.has(s.id) && s.latitude && s.longitude);
    if (selected.length === 0) return null;
    // Google Maps multi-stop: /dir/lat,lng/lat,lng/lat,lng
    const stops = selected.map(s => `${s.latitude},${s.longitude}`);
    return `https://www.google.com/maps/dir/${stops.join('/')}`;
  }

  function launchRoute() {
    const url = buildRouteUrl();
    if (url) window.open(url, '_blank');
  }

  function navigateToShop(lat: number, lng: number) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  }

  function getOperatingHoursText(hours: any): string | null {
    if (!hours) return null;
    if (typeof hours === 'string') {
      try { hours = JSON.parse(hours); } catch { return hours; }
    }
    if (hours.description) return hours.description;
    return null;
  }
</script>

<svelte:head>
  <title>{config.name} — Yakima Events</title>
  <meta name="description" content={config.tagline} />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div
  class="junkrun-page min-h-screen"
  style="--jr-primary: {config.theme.primary}; --jr-accent: {config.theme.accent}; --jr-bg: {config.theme.background}; --jr-text: {config.theme.text}; --jr-header-bg: {config.theme.headerBg}; --jr-header-text: {config.theme.headerText};"
>
  <!-- Hero Header -->
  <header class="relative overflow-hidden" style="background: linear-gradient(135deg, var(--jr-header-bg) 0%, color-mix(in srgb, var(--jr-header-bg) 70%, var(--jr-primary)) 100%);">
    <div class="absolute inset-0 opacity-10">
      <div class="absolute inset-0" style="background-image: radial-gradient(circle at 20% 50%, var(--jr-accent) 1px, transparent 1px); background-size: 40px 40px;"></div>
    </div>
    <div class="relative max-w-6xl mx-auto px-4 py-8 md:py-12 text-center">
      {#if config.logo}
        <img src={config.logo} alt={config.name} class="h-16 mx-auto mb-4" />
      {/if}
      <h1 class="text-3xl md:text-5xl font-black tracking-tight" style="color: var(--jr-header-text); font-family: 'Playfair Display', Georgia, serif;">
        {config.name}
      </h1>
      <p class="mt-2 text-lg md:text-xl opacity-80" style="color: var(--jr-header-text);">
        {config.tagline}
      </p>
      {#if config.headerHtml}
        <p class="mt-3 text-sm opacity-60" style="color: var(--jr-header-text);">
          {@html config.headerHtml}
        </p>
      {/if}
      <div class="mt-4 flex justify-center gap-3 text-sm" style="color: var(--jr-accent);">
        <span>{filteredShops.length} shops</span>
        <span>&bull;</span>
        <span>{regions.length} areas</span>
        {#if salesToday.length > 0}
          <span>&bull;</span>
          <span class="text-red-400 font-semibold">{salesToday.length} sales today</span>
        {/if}
      </div>
    </div>
  </header>

  <!-- Optional notice banner (e.g. event schedule flyer) -->
  {#if config.notice}
    <div class="max-w-3xl mx-auto px-4 pt-6">
      <details
        open
        class="rounded-lg border shadow-sm overflow-hidden bg-white"
        style="border-color: color-mix(in srgb, var(--jr-primary) 30%, transparent);"
      >
        <summary
          class="cursor-pointer select-none px-4 py-3 font-bold text-lg"
          style="color: var(--jr-primary); font-family: 'Playfair Display', Georgia, serif;"
        >
          {config.notice.title}
        </summary>
        <a href={config.notice.href || config.notice.image} target="_blank" rel="noopener">
          <img
            src={config.notice.image}
            alt={config.notice.title}
            class="w-full h-auto"
            loading="lazy"
          />
        </a>
        {#if config.notice.caption}
          <p class="px-4 py-2 text-sm text-center" style="color: color-mix(in srgb, var(--jr-text) 60%, transparent);">
            {config.notice.caption}
          </p>
        {/if}
      </details>
    </div>
  {/if}

  <!-- Filter Bar -->
  <div class="sticky top-0 z-30 border-b shadow-sm" style="background: var(--jr-bg); border-color: color-mix(in srgb, var(--jr-primary) 15%, transparent);">
    <div class="max-w-6xl mx-auto px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <!-- Category filters -->
        <button
          on:click={() => selectedCategory = ''}
          class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          class:active-pill={selectedCategory === ''}
          style="{selectedCategory === '' ? `background: var(--jr-primary); color: white;` : `background: color-mix(in srgb, var(--jr-primary) 10%, transparent); color: var(--jr-text);`}"
        >All</button>

        {#each categories as cat}
          <button
            on:click={() => selectedCategory = selectedCategory === cat.slug ? '' : cat.slug}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style="{selectedCategory === cat.slug
              ? `background: ${cat.color}; color: white;`
              : `background: ${cat.color}15; color: ${cat.color};`}"
          >
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background: {cat.color};"></span>
            {cat.name}
          </button>
        {/each}

        {#if salesToday.length > 0}
          <button
            on:click={() => showSales = !showSales}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style="{showSales ? 'background: #ef4444; color: white;' : 'background: #ef444415; color: #ef4444;'}"
          >
            <span class="w-2 h-2 rounded-full flex-shrink-0 bg-red-500"></span>
            Sales Today
          </button>
        {/if}

        <div class="hidden md:block h-4 w-px mx-1" style="background: color-mix(in srgb, var(--jr-text) 20%, transparent);"></div>

        <!-- Region filters -->
        {#each regions as region}
          <button
            on:click={() => selectedRegion = selectedRegion === region ? '' : region}
            class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
            style="{selectedRegion === region
              ? `background: var(--jr-text); color: var(--jr-bg);`
              : `background: color-mix(in srgb, var(--jr-text) 8%, transparent); color: var(--jr-text);`}"
          >
            {REGION_LABELS[region] || region}
          </button>
        {/each}

        <div class="ml-auto flex items-center gap-2">
          <button
            on:click={() => { routeMode = !routeMode; if (!routeMode) clearRouteSelection(); showFlyer = false; }}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style="{routeMode ? `background: var(--jr-primary); color: white;` : `background: color-mix(in srgb, var(--jr-primary) 15%, transparent); color: var(--jr-primary);`}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {routeMode ? 'Cancel Route' : 'Plan Route'}
          </button>
          <button
            on:click={() => { showFlyer = !showFlyer; routeMode = false; clearRouteSelection(); }}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style="background: var(--jr-accent); color: var(--jr-header-bg);"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {showFlyer ? 'Hide Flyer' : 'Print Flyer'}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Route Action Bar -->
  {#if routeMode}
    <div class="sticky top-12 z-20 border-b shadow-sm" style="background: color-mix(in srgb, var(--jr-primary) 5%, white); border-color: var(--jr-primary);">
      <div class="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <span class="text-sm font-semibold" style="color: var(--jr-primary);">
          {routeSelected.size} shop{routeSelected.size !== 1 ? 's' : ''} selected
        </span>
        <button on:click={selectAllForRoute} class="text-xs underline" style="color: var(--jr-primary);">Select All</button>
        <button on:click={clearRouteSelection} class="text-xs underline text-gray-500">Clear</button>
        <div class="ml-auto">
          <button
            on:click={launchRoute}
            disabled={routeSelected.size === 0}
            class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm transition-all disabled:opacity-40"
            style="background: var(--jr-primary);"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Open in Google Maps
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Content -->
  {#if showFlyer}
    <!-- Print Flyer Preview -->
    <div class="max-w-4xl mx-auto px-4 py-8">
      <JunkRunFlyer
        shops={shopsWithRegion}
        {config}
        salesTodayIds={shopIdsWithSales}
      />
    </div>
  {:else}
    <div class="max-w-6xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Map -->
        <div class="lg:col-span-3">
          <div class="sticky top-16">
            <div bind:this={mapContainer} class="w-full rounded-xl overflow-hidden shadow-lg border" style="height: 500px; border-color: color-mix(in srgb, var(--jr-primary) 20%, transparent);"></div>

            <!-- Legend -->
            <div class="mt-3 flex flex-wrap gap-2">
              {#each categories as cat}
                <div class="flex items-center gap-1.5 text-[11px]" style="color: {cat.color};">
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <polygon points={starPoints(7, 7, 6, 3, 5)} fill={cat.color} stroke="white" stroke-width="0.5"/>
                  </svg>
                  {cat.name}
                </div>
              {/each}
              {#if salesToday.length > 0}
                <div class="flex items-center gap-1.5 text-[11px] text-red-500">
                  <span class="w-3 h-3 rounded-full bg-red-500 inline-flex items-center justify-center text-white text-[8px] font-bold">!</span>
                  Sale Today
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Shop List -->
        <div class="lg:col-span-2 space-y-6">
          {#each groupedShops as [region, shops]}
            <div>
              <h2 class="text-sm font-bold uppercase tracking-wider mb-3" style="color: var(--jr-primary);">
                {REGION_LABELS[region] || region}
                <span class="text-xs font-normal opacity-60 ml-1">({shops.length})</span>
              </h2>
              <div class="space-y-2">
                {#each shops as shop, i}
                  {@const num = filteredShops.indexOf(shop) + 1}
                  {@const cat = shop.category}
                  {@const hasSale = shopIdsWithSales.has(shop.id)}
                  <div
                    id="shop-{shop.id}"
                    class="w-full text-left p-3 rounded-lg border transition-all hover:shadow-md group"
                    style="border-color: {selectedShopId === shop.id ? (cat?.color || 'var(--jr-primary)') : routeSelected.has(shop.id) ? 'var(--jr-primary)' : 'transparent'};
                           background: {selectedShopId === shop.id ? `${cat?.color || 'var(--jr-primary)'}08` : routeSelected.has(shop.id) ? 'color-mix(in srgb, var(--jr-primary) 5%, white)' : 'white'};"
                  >
                    <div class="flex items-start gap-3">
                      <!-- Route checkbox (shown in route mode) -->
                      {#if routeMode}
                        <button
                          on:click|stopPropagation={() => toggleRouteShop(shop.id)}
                          class="flex-shrink-0 w-6 h-6 mt-1 rounded border-2 flex items-center justify-center transition-all"
                          style="border-color: {routeSelected.has(shop.id) ? 'var(--jr-primary)' : '#d1d5db'};
                                 background: {routeSelected.has(shop.id) ? 'var(--jr-primary)' : 'white'};"
                          aria-label="Select {shop.name} for route"
                        >
                          {#if routeSelected.has(shop.id)}
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          {/if}
                        </button>
                      {/if}
                      <!-- Number badge -->
                      <button
                        on:click={() => selectShop(shop.id)}
                        class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style="background: {cat?.color || '#6b7280'};"
                      >
                        {num}
                      </button>
                      <button on:click={() => selectShop(shop.id)} class="flex-1 min-w-0 text-left">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-sm truncate" style="color: var(--jr-text);">{shop.name}</span>
                          {#if hasSale}
                            <span class="flex-shrink-0 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">SALE</span>
                          {/if}
                        </div>
                        {#if shop.address}
                          <p class="text-xs text-gray-500 truncate mt-0.5">{shop.address}</p>
                        {/if}
                        <div class="flex items-center gap-3 mt-1">
                          {#if shop.phone}
                            <a href="tel:{shop.phone}" class="text-xs text-blue-600 hover:underline" on:click|stopPropagation>{shop.phone}</a>
                          {/if}
                          {#if getOperatingHoursText(shop.operatingHours)}
                            <span class="text-xs text-gray-400">{getOperatingHoursText(shop.operatingHours)}</span>
                          {/if}
                        </div>
                        {#if shop.description && selectedShopId === shop.id}
                          <p class="text-xs text-gray-600 mt-2 leading-relaxed">{shop.description}</p>
                        {/if}
                      </button>
                      <!-- Navigate button -->
                      {#if shop.latitude && shop.longitude}
                        <button
                          on:click|stopPropagation={() => navigateToShop(shop.latitude, shop.longitude)}
                          class="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                          title="Navigate to {shop.name}"
                        >
                          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}

          {#if filteredShops.length === 0}
            <div class="text-center py-12 text-gray-400">
              <p class="text-lg">No shops match your filters</p>
              <button on:click={() => { selectedCategory = ''; selectedRegion = ''; showSales = false; }} class="mt-2 text-sm underline" style="color: var(--jr-primary);">Clear filters</button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Footer -->
  <footer class="mt-12 py-6 text-center text-sm" style="background: var(--jr-header-bg); color: var(--jr-header-text); opacity: 0.8;">
    <p>{@html config.footerHtml}</p>
    <p class="mt-2 opacity-50">
      <a href="/" class="hover:underline">Yakima Events</a> &bull;
      <a href="/shops" class="hover:underline">Shop Directory</a>
    </p>
  </footer>
</div>

<style>
  :global(.junkrun-marker) {
    background: none !important;
    border: none !important;
  }

  @media print {
    .sticky { position: static !important; }
  }
</style>
