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

        <div class="ml-auto">
          <button
            on:click={() => showFlyer = !showFlyer}
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
                  <button
                    id="shop-{shop.id}"
                    on:click={() => selectShop(shop.id)}
                    class="w-full text-left p-3 rounded-lg border transition-all hover:shadow-md group"
                    style="border-color: {selectedShopId === shop.id ? (cat?.color || 'var(--jr-primary)') : 'transparent'};
                           background: {selectedShopId === shop.id ? `${cat?.color || 'var(--jr-primary)'}08` : 'white'};"
                  >
                    <div class="flex items-start gap-3">
                      <!-- Number badge -->
                      <div
                        class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style="background: {cat?.color || '#6b7280'};"
                      >
                        {num}
                      </div>
                      <div class="flex-1 min-w-0">
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
                      </div>
                    </div>
                  </button>
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
