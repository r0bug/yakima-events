<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import type { JunkRunConfig, FlyerShop } from '$lib/types/junk-run';
  import FlyerMapFocus from './flyer/FlyerMapFocus.svelte';
  import FlyerDirectoryFocus from './flyer/FlyerDirectoryFocus.svelte';
  import FlyerPostcard from './flyer/FlyerPostcard.svelte';
  import FlyerVintageGuide from './flyer/FlyerVintageGuide.svelte';
  import { getBounds, type MarkerPosition } from './flyer/flyer-utils';

  export let shops: FlyerShop[] = [];
  export let config: JunkRunConfig;
  export let salesTodayIds: Set<number> = new Set();

  // Area definitions for the selector
  const AREAS = [
    { key: 'yakima-area', label: 'Yakima / Union Gap / Selah', regions: ['yakima', 'uniongap', 'selah'] },
    { key: 'lower-valley', label: 'Lower Valley', subtitle: 'Wapato, Toppenish, Granger, Sunnyside, Zillah', regions: ['wapato', 'toppenish', 'granger', 'sunnyside', 'zillah'] },
    { key: 'wine-country', label: 'Wine Country', subtitle: 'Prosser, Benton City', regions: ['prosser', 'bentoncity'] },
    { key: 'canyon', label: 'Naches / Tieton', subtitle: 'Highway 12 Corridor', regions: ['naches', 'tieton'] },
    { key: 'all', label: 'All Areas', regions: [] },
  ];

  let selectedArea = '';
  let flyerReady = false;
  let generating = false;
  let mapImageUrl = '';
  let markerPositions: MarkerPosition[] = [];
  let mapContainer: HTMLDivElement;

  // Capture the map at 2x and display at 1x so it stays crisp on paper (~192dpi)
  const SCALE = 2;

  // Map dimensions depend on template (must match the template's MAP_W/MAP_H)
  $: mapW = config.flyer.template === 'postcard' ? 816 - 28 * 2 : 816 - 24 * 2;
  $: mapH = config.flyer.template === 'directory-focus' ? 380 : config.flyer.template === 'postcard' ? 380 : 620;

  $: areaShops = getAreaShops(selectedArea);

  function getAreaShops(areaKey: string): FlyerShop[] {
    const area = AREAS.find(a => a.key === areaKey);
    if (!area || area.regions.length === 0) {
      return shops.filter(s => s.latitude && s.longitude);
    }
    return shops.filter(s => s.latitude && s.longitude && area.regions.includes(s.region));
  }

  $: areaLabel = AREAS.find(a => a.key === selectedArea)?.label || '';

  async function generateFlyer() {
    if (!browser || areaShops.length === 0) return;
    generating = true;
    flyerReady = false;
    mapImageUrl = '';
    markerPositions = [];

    await tick();

    const L = await import('leaflet');
    const bounds = getBounds(areaShops);
    const corner1 = L.latLng(bounds.minLat, bounds.minLng);
    const corner2 = L.latLng(bounds.maxLat, bounds.maxLng);
    const lBounds = L.latLngBounds(corner1, corner2);

    const offscreenMap = L.map(mapContainer, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(offscreenMap);

    offscreenMap.fitBounds(lBounds, { paddingTopLeft: [40, 70], paddingBottomRight: [40, 40] });

    offscreenMap.whenReady(() => {
      setTimeout(async () => {
        // Project shops through the *actual* rendered map so pins land exactly
        // on their locations (the captured image and the overlay share this projection)
        markerPositions = areaShops.map((shop, i) => {
          const pt = offscreenMap.latLngToContainerPoint([shop.latitude!, shop.longitude!]);
          return { shop, num: i + 1, x: pt.x / SCALE, y: pt.y / SCALE };
        });
        try {
          const leafletImage = (await import('leaflet-image')).default;
          leafletImage(offscreenMap, (err: any, canvas: HTMLCanvasElement) => {
            if (!err && canvas) {
              mapImageUrl = canvas.toDataURL('image/png');
            }
            flyerReady = true;
            generating = false;
            offscreenMap.remove();
          });
        } catch {
          flyerReady = true;
          generating = false;
          offscreenMap.remove();
        }
      }, 2500);
    });
  }

  function printFlyer() {
    window.print();
  }
</script>

<!-- Offscreen map for capture (2x for print sharpness) -->
<div bind:this={mapContainer} style="position:absolute; left:-9999px; width:{mapW * SCALE}px; height:{mapH * SCALE}px;"></div>

<div class="flyer-wrapper">
  <!-- Area Selector (no-print) -->
  <div class="no-print mb-6">
    <h3 class="text-lg font-bold mb-3" style="color: {config.theme.text};">Choose an area for your flyer</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {#each AREAS as area}
        {@const count = getAreaShops(area.key).length}
        {#if count > 0 || area.key === 'all'}
          <button
            on:click={() => { selectedArea = area.key; flyerReady = false; mapImageUrl = ''; markerPositions = []; }}
            class="p-3 rounded-lg border-2 text-left transition-all hover:shadow-md"
            style="border-color: {selectedArea === area.key ? config.theme.primary : '#e5e7eb'};
                   background: {selectedArea === area.key ? `${config.theme.primary}08` : 'white'};"
          >
            <div class="font-semibold text-sm" style="color: {config.theme.text};">{area.label}</div>
            {#if area.subtitle}
              <div class="text-xs text-gray-500 mt-0.5">{area.subtitle}</div>
            {/if}
            <div class="text-xs mt-1" style="color: {config.theme.primary};">{count} shops</div>
          </button>
        {/if}
      {/each}
    </div>

    {#if selectedArea}
      <div class="mt-4 flex items-center gap-3 flex-wrap">
        <button
          on:click={generateFlyer}
          disabled={generating}
          class="px-6 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-50"
          style="background: {config.theme.primary};"
        >
          {generating ? 'Generating...' : 'Generate Flyer'}
        </button>
        {#if flyerReady}
          <button
            on:click={printFlyer}
            class="px-6 py-2.5 rounded-lg font-semibold border-2 transition-all"
            style="border-color: {config.theme.primary}; color: {config.theme.primary};"
          >
            Print
          </button>
        {/if}
        <span class="text-xs text-gray-400">
          Best printed on US Letter (8.5" x 11")
          {#if config.flyer.template === 'postcard'} &mdash; Single page{/if}
        </span>
        <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">
          Template: {config.flyer.template}
        </span>
      </div>
    {/if}
  </div>

  {#if flyerReady && selectedArea}
    {#if config.flyer.template === 'directory-focus'}
      <FlyerDirectoryFocus shops={areaShops} {config} {salesTodayIds} {mapImageUrl} {markerPositions} {areaLabel} />
    {:else if config.flyer.template === 'postcard'}
      <FlyerPostcard shops={areaShops} {config} {salesTodayIds} {mapImageUrl} {markerPositions} {areaLabel} />
    {:else if config.flyer.template === 'vintage-guide'}
      <FlyerVintageGuide shops={areaShops} {config} {salesTodayIds} {mapImageUrl} {markerPositions} {areaLabel} />
    {:else}
      <FlyerMapFocus shops={areaShops} {config} {salesTodayIds} {mapImageUrl} {markerPositions} {areaLabel} />
    {/if}
  {/if}
</div>

<style>
  .flyer-wrapper {
    padding: 20px 0;
  }

  :global(.flyer-page) {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @media print {
    .no-print { display: none !important; }
    .flyer-wrapper { padding: 0; }
    :global(.flyer-page) {
      box-shadow: none !important;
      margin: 0 !important;
    }

    @page {
      size: letter;
      margin: 0;
    }
  }

  @media screen {
    :global(.flyer-page) {
      transform-origin: top center;
      transform: scale(0.75);
      margin-bottom: -130px !important;
    }
  }
</style>
