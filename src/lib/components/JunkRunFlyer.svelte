<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import QRCode from 'qrcode-svg';

  interface FlyerShop {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
    operatingHours: any;
    description: string | null;
    category?: { name: string; color: string | null; slug: string } | undefined;
    region: string;
  }

  interface FlyerConfig {
    name: string;
    tagline: string;
    headerHtml: string;
    footerHtml: string;
    theme: { primary: string; accent: string; background: string; text: string; headerBg: string; headerText: string };
    mapCenter: [number, number];
    mapZoom: number;
  }

  export let shops: FlyerShop[] = [];
  export let config: FlyerConfig;
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
  let mapContainer: HTMLDivElement;

  // Page dimensions in px (96dpi: 8.5in = 816px, 11in = 1056px)
  const PAGE_W = 816;
  const PAGE_H = 1056;
  const HEADER_H = 70;
  const FOOTER_H = 36;
  const MARGIN = 24;
  // Map takes up most of page 1
  const MAP_X = MARGIN;
  const MAP_Y = HEADER_H;
  const MAP_W = PAGE_W - MARGIN * 2;
  const MAP_H = 620;
  // Shop list below map on page 1
  const LIST_Y = MAP_Y + MAP_H + 8;
  const LIST_H = PAGE_H - LIST_Y - FOOTER_H - 4;

  $: areaShops = getAreaShops(selectedArea);

  function getAreaShops(areaKey: string): FlyerShop[] {
    const area = AREAS.find(a => a.key === areaKey);
    if (!area || area.regions.length === 0) {
      return shops.filter(s => s.latitude && s.longitude);
    }
    return shops.filter(s => s.latitude && s.longitude && area.regions.includes(s.region));
  }

  function getBounds(shopList: FlyerShop[]): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const s of shopList) {
      if (s.latitude! < minLat) minLat = s.latitude!;
      if (s.latitude! > maxLat) maxLat = s.latitude!;
      if (s.longitude! < minLng) minLng = s.longitude!;
      if (s.longitude! > maxLng) maxLng = s.longitude!;
    }
    const latPad = (maxLat - minLat) * 0.1 || 0.01;
    const lngPad = (maxLng - minLng) * 0.1 || 0.01;
    return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLng: minLng - lngPad, maxLng: maxLng + lngPad };
  }

  function latLngToPixel(lat: number, lng: number, bounds: ReturnType<typeof getBounds>, w: number, h: number): { x: number; y: number } {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * w;
    const mercator = (la: number) => Math.log(Math.tan(Math.PI / 4 + (la * Math.PI / 180) / 2));
    const yMin = mercator(bounds.minLat);
    const yMax = mercator(bounds.maxLat);
    const yPt = mercator(lat);
    const y = h - ((yPt - yMin) / (yMax - yMin)) * h;
    return { x: Math.round(x), y: Math.round(y) };
  }

  // Compute marker positions on map
  $: markerPositions = (() => {
    if (areaShops.length === 0) return [];
    const bounds = getBounds(areaShops);
    return areaShops.map((shop, i) => {
      const pos = latLngToPixel(shop.latitude!, shop.longitude!, bounds, MAP_W, MAP_H);
      return { shop, num: i + 1, x: MAP_X + pos.x, y: MAP_Y + pos.y };
    });
  })();

  function starPoints(cx: number, cy: number, outerR: number, innerR: number, pts: number): string {
    const points: string[] = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle = (Math.PI / pts) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return points.join(' ');
  }

  function getHoursText(hours: any): string {
    if (!hours) return '';
    if (typeof hours === 'string') {
      try { hours = JSON.parse(hours); } catch { return hours; }
    }
    return hours.description || '';
  }

  function truncate(str: string, max: number): string {
    return str.length > max ? str.substring(0, max - 1) + '\u2026' : str;
  }

  function generateQrSvg(lat: number, lng: number): string {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const qr = new QRCode({
      content: url,
      padding: 0,
      width: 48,
      height: 48,
      ecl: 'L',
      join: true,
    });
    return qr.svg();
  }

  $: qrCodes = new Map(
    areaShops
      .filter(s => s.latitude && s.longitude)
      .map(s => [s.id, generateQrSvg(s.latitude!, s.longitude!)])
  );

  async function generateFlyer() {
    if (!browser || areaShops.length === 0) return;
    generating = true;
    flyerReady = false;
    mapImageUrl = '';

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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(offscreenMap);

    offscreenMap.fitBounds(lBounds, { padding: [20, 20] });

    offscreenMap.whenReady(() => {
      setTimeout(async () => {
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

<!-- Offscreen map for capture -->
<div bind:this={mapContainer} style="position:absolute; left:-9999px; width:{MAP_W}px; height:{MAP_H}px;"></div>

<div class="flyer-wrapper">
  <!-- Area Selector (no-print) -->
  <div class="no-print mb-6">
    <h3 class="text-lg font-bold mb-3" style="color: {config.theme.text};">Choose an area for your flyer</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {#each AREAS as area}
        {@const count = getAreaShops(area.key).length}
        {#if count > 0 || area.key === 'all'}
          <button
            on:click={() => { selectedArea = area.key; flyerReady = false; mapImageUrl = ''; }}
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
      <div class="mt-4 flex items-center gap-3">
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
        <span class="text-xs text-gray-400">Best printed on US Letter (8.5" x 11")</span>
      </div>
    {/if}
  </div>

  {#if flyerReady && selectedArea}
    {@const areaLabel = AREAS.find(a => a.key === selectedArea)?.label || ''}

    <!-- Page 1: Big Map + Compact Shop List Below -->
    <div class="flyer-page" style="width:{PAGE_W}px; height:{PAGE_H}px; background:white; position:relative; overflow:hidden; margin:0 auto; box-shadow:0 2px 20px rgba(0,0,0,0.1);">

      <!-- Header -->
      <div style="position:absolute; top:0; left:0; right:0; height:{HEADER_H}px; background:{config.theme.headerBg}; display:flex; align-items:center; justify-content:center; flex-direction:column;">
        <div style="font-family:'Playfair Display',Georgia,serif; font-size:22px; font-weight:900; color:{config.theme.headerText}; letter-spacing:-0.5px;">
          {config.name}
        </div>
        <div style="font-size:10px; color:{config.theme.accent}; margin-top:1px;">
          {config.tagline} &mdash; {areaLabel}
        </div>
      </div>

      <!-- Map Image (full width) -->
      {#if mapImageUrl}
        <img
          src={mapImageUrl}
          alt="Map"
          style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; border:1px solid #ddd;"
        />
      {:else}
        <div style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; background:#e5e7eb; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:14px;">
          Map loading...
        </div>
      {/if}

      <!-- SVG overlay: numbered star markers on map -->
      <svg style="position:absolute; top:0; left:0; width:{PAGE_W}px; height:{PAGE_H}px; pointer-events:none;" viewBox="0 0 {PAGE_W} {PAGE_H}">
        {#each markerPositions as m}
          <polygon
            points={starPoints(m.x, m.y, 13, 6, 5)}
            fill={m.shop.category?.color || '#6b7280'}
            stroke="white"
            stroke-width="1.5"
          />
          <text
            x={m.x}
            y={m.y + 4}
            text-anchor="middle"
            fill="white"
            font-size="9"
            font-weight="bold"
            style="text-shadow:0 0 3px rgba(0,0,0,.7)"
          >{m.num}</text>
        {/each}
      </svg>

      <!-- Compact numbered shop list below map -->
      <div style="position:absolute; left:{MARGIN}px; top:{LIST_Y}px; right:{MARGIN}px; height:{LIST_H}px; overflow:hidden;">
        <!-- Category legend -->
        <div style="display:flex; gap:12px; margin-bottom:5px; font-size:7px;">
          {#each [...new Map(areaShops.filter(s => s.category).map(s => [s.category?.slug, s.category])).values()] as cat}
            {#if cat}
              <span style="display:flex; align-items:center; gap:3px; color:{cat.color || '#6b7280'};">
                <span style="width:6px; height:6px; border-radius:50%; background:{cat.color || '#6b7280'}; display:inline-block;"></span>
                {cat.name}
              </span>
            {/if}
          {/each}
        </div>
        <!-- Grid of shops: 3 or 4 columns -->
        <div style="column-count:{areaShops.length > 20 ? 4 : 3}; column-gap:12px; font-size:7.5px; color:#333; line-height:1.35;">
          {#each areaShops as shop, i}
            <div style="break-inside:avoid; margin-bottom:3px; display:flex; align-items:baseline; gap:3px;">
              <span style="display:inline-flex; align-items:center; justify-content:center; min-width:13px; height:13px; border-radius:50%; background:{shop.category?.color || '#6b7280'}; color:white; font-size:6.5px; font-weight:bold; flex-shrink:0;">{i + 1}</span>
              <span style="font-weight:600;">{truncate(shop.name, 28)}</span>
              {#if salesTodayIds.has(shop.id)}
                <span style="color:#ef4444; font-size:6px; font-weight:bold;">SALE</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Footer -->
      <div style="position:absolute; bottom:0; left:0; right:0; height:{FOOTER_H}px; background:{config.theme.headerBg}; display:flex; align-items:center; justify-content:center; padding:0 20px;">
        <span style="font-size:8px; color:{config.theme.accent};">{config.footerHtml}</span>
        <span style="font-size:7px; color:{config.theme.headerText}; opacity:0.4; margin-left:auto;">yfevents.yakimafinds.com</span>
      </div>
    </div>

    <!-- Page 2: Full Directory with QR codes -->
    <div class="flyer-page" style="width:{PAGE_W}px; min-height:{PAGE_H}px; background:white; position:relative; margin:20px auto 0; padding:30px 40px; box-shadow:0 2px 20px rgba(0,0,0,0.1); page-break-before:always;">
      <h2 style="font-family:'Playfair Display',Georgia,serif; font-size:18px; font-weight:900; color:{config.theme.text}; margin-bottom:4px;">
        {config.name} &mdash; {areaLabel} Directory
      </h2>
      <div style="height:2px; background:{config.theme.primary}; width:80px; margin-bottom:16px;"></div>

      <div style="column-count:{areaShops.length > 16 ? 3 : 2}; column-gap:20px; font-size:9px; color:#333; line-height:1.5;">
        {#each areaShops as shop, i}
          <div style="break-inside:avoid; margin-bottom:8px; padding-bottom:6px; border-bottom:0.5px solid #e5e7eb;">
            <div style="display:flex; align-items:flex-start; gap:6px;">
              <!-- QR code -->
              {#if shop.latitude && shop.longitude && qrCodes.has(shop.id)}
                <div class="qr-code" style="flex-shrink:0; width:48px; height:48px;">
                  {@html qrCodes.get(shop.id)}
                </div>
              {/if}
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:4px; margin-bottom:1px;">
                  <span style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border-radius:50%; background:{shop.category?.color || '#6b7280'}; color:white; font-size:7px; font-weight:bold; flex-shrink:0;">{i + 1}</span>
                  <strong style="font-size:9.5px; color:{config.theme.text};">{shop.name}</strong>
                </div>
                {#if shop.address}
                  <div style="color:#555; margin-left:18px; font-size:8px;">{shop.address}</div>
                {/if}
                {#if shop.phone}
                  <div style="color:#333; margin-left:18px; font-size:8px;">{shop.phone}</div>
                {/if}
                {#if getHoursText(shop.operatingHours)}
                  <div style="color:#888; margin-left:18px; font-size:7.5px;">{getHoursText(shop.operatingHours)}</div>
                {/if}
                {#if salesTodayIds.has(shop.id)}
                  <div style="color:#ef4444; margin-left:18px; font-size:7.5px; font-weight:bold;">SALE TODAY</div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
      <p style="font-size:7px; color:#999; text-align:center; margin-top:8px;">Scan QR codes with your phone camera to open navigation</p>

      <!-- Category legend -->
      <div style="position:absolute; bottom:30px; left:40px; right:40px; display:flex; gap:16px; justify-content:center; font-size:8px;">
        {#each [...new Map(areaShops.filter(s => s.category).map(s => [s.category?.slug, s.category])).values()] as cat}
          {#if cat}
            <div style="display:flex; align-items:center; gap:4px; color:{cat.color || '#6b7280'};">
              <span style="width:8px; height:8px; border-radius:50%; background:{cat.color || '#6b7280'}; display:inline-block;"></span>
              {cat.name}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .flyer-wrapper {
    padding: 20px 0;
  }

  @media print {
    .no-print { display: none !important; }
    .flyer-wrapper { padding: 0; }
    .flyer-page {
      box-shadow: none !important;
      margin: 0 !important;
    }

    @page {
      size: letter;
      margin: 0;
    }
  }

  @media screen {
    .flyer-page {
      transform-origin: top center;
      transform: scale(0.75);
      margin-bottom: -130px !important;
    }
  }
</style>
