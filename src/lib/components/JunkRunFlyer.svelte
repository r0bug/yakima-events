<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

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

  // Page dimensions in px (96dpi: 8.5in = 816px, 11in = 1056px)
  const PAGE_W = 816;
  const PAGE_H = 1056;
  const MARGIN = 24;
  const MAP_MARGIN = 140; // margin zone width for bubbles
  const MAP_X = MAP_MARGIN;
  const MAP_Y = 80; // after header
  const MAP_W = PAGE_W - MAP_MARGIN * 2;
  const MAP_H = PAGE_H - MAP_Y - MAP_MARGIN - 50; // leave room for footer

  let mapImageUrl = '';
  let flyerReady = false;
  let mapContainer: HTMLDivElement;

  // Assign shops to margin zones (top, right, bottom, left) based on position
  interface PlacedBubble {
    shop: FlyerShop;
    num: number;
    zone: 'top' | 'right' | 'bottom' | 'left';
    mapX: number; // marker position on map image
    mapY: number;
    bubbleX: number; // bubble position
    bubbleY: number;
  }

  $: placements = computePlacements(shops);

  function latLngToMapPixel(lat: number, lng: number, center: [number, number], zoom: number, w: number, h: number): { x: number; y: number } {
    const scale = Math.pow(2, zoom) * 256;
    const toWorld = (la: number, lo: number) => {
      const wx = ((lo + 180) / 360) * scale;
      const sinLat = Math.sin((la * Math.PI) / 180);
      const wy = ((0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale);
      return { wx, wy };
    };
    const ctr = toWorld(center[0], center[1]);
    const pt = toWorld(lat, lng);
    return {
      x: Math.round(w / 2 + (pt.wx - ctr.wx)),
      y: Math.round(h / 2 + (pt.wy - ctr.wy)),
    };
  }

  function computePlacements(shopList: FlyerShop[]): PlacedBubble[] {
    const results: PlacedBubble[] = [];
    const centerX = MAP_W / 2;
    const centerY = MAP_H / 2;

    // Calculate map positions and angles
    const withAngles = shopList
      .filter(s => s.latitude && s.longitude)
      .map((shop, i) => {
        const pos = latLngToMapPixel(shop.latitude!, shop.longitude!, config.mapCenter, config.mapZoom, MAP_W, MAP_H);
        const angle = Math.atan2(pos.y - centerY, pos.x - centerX);
        return { shop, num: i + 1, pos, angle };
      });

    // Sort by angle (clockwise from top)
    withAngles.sort((a, b) => a.angle - b.angle);

    // Assign to zones: top(-3π/4 to -π/4), right(-π/4 to π/4), bottom(π/4 to 3π/4), left(3π/4 to -3π/4)
    const zones = { top: [] as typeof withAngles, right: [] as typeof withAngles, bottom: [] as typeof withAngles, left: [] as typeof withAngles };

    for (const item of withAngles) {
      const a = item.angle;
      if (a >= -Math.PI * 0.75 && a < -Math.PI * 0.25) zones.top.push(item);
      else if (a >= -Math.PI * 0.25 && a < Math.PI * 0.25) zones.right.push(item);
      else if (a >= Math.PI * 0.25 && a < Math.PI * 0.75) zones.bottom.push(item);
      else zones.left.push(item);
    }

    // Balance zones — if one is too full, overflow to neighbors
    const maxPerZone = Math.ceil(shopList.length / 4) + 2;
    const allZones: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
    for (const zone of allZones) {
      while (zones[zone].length > maxPerZone) {
        const overflow = zones[zone].pop()!;
        const nextZone = allZones[(allZones.indexOf(zone) + 1) % 4];
        zones[nextZone].unshift(overflow);
      }
    }

    // Place bubbles in each zone
    for (const [zone, items] of Object.entries(zones) as [string, typeof withAngles][]) {
      const count = items.length;
      if (count === 0) continue;

      items.forEach((item, idx) => {
        const t = count === 1 ? 0.5 : idx / (count - 1);
        let bx: number, by: number;

        switch (zone) {
          case 'top':
            bx = MAP_X + MAP_W * 0.1 + MAP_W * 0.8 * t;
            by = MAP_Y - 10;
            break;
          case 'bottom':
            bx = MAP_X + MAP_W * 0.1 + MAP_W * 0.8 * t;
            by = MAP_Y + MAP_H + 10;
            break;
          case 'left':
            bx = MAP_X - 10;
            by = MAP_Y + MAP_H * 0.1 + MAP_H * 0.8 * t;
            break;
          case 'right':
            bx = MAP_X + MAP_W + 10;
            by = MAP_Y + MAP_H * 0.1 + MAP_H * 0.8 * t;
            break;
          default:
            bx = 0; by = 0;
        }

        results.push({
          shop: item.shop,
          num: item.num,
          zone: zone as PlacedBubble['zone'],
          mapX: MAP_X + item.pos.x,
          mapY: MAP_Y + item.pos.y,
          bubbleX: bx,
          bubbleY: by,
        });
      });
    }

    return results;
  }

  function leaderPath(mx: number, my: number, bx: number, by: number): string {
    const cx = (mx + bx) / 2;
    const cy = (my + by) / 2;
    // Slight curve
    const offsetX = (by - my) * 0.15;
    const offsetY = (mx - bx) * 0.15;
    return `M${mx},${my} Q${cx + offsetX},${cy + offsetY} ${bx},${by}`;
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

  function getHoursText(hours: any): string {
    if (!hours) return '';
    if (typeof hours === 'string') {
      try { hours = JSON.parse(hours); } catch { return hours; }
    }
    return hours.description || '';
  }

  onMount(async () => {
    if (!browser) return;
    const L = await import('leaflet');

    // Create an offscreen map to capture
    const offscreenMap = L.map(mapContainer, {
      zoomControl: false,
      attributionControl: false,
    }).setView(config.mapCenter, config.mapZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(offscreenMap);

    // Wait for tiles to load then capture
    offscreenMap.whenReady(() => {
      setTimeout(async () => {
        try {
          const leafletImage = (await import('leaflet-image')).default;
          leafletImage(offscreenMap, (err: any, canvas: HTMLCanvasElement) => {
            if (!err && canvas) {
              mapImageUrl = canvas.toDataURL('image/png');
            }
            flyerReady = true;
            offscreenMap.remove();
          });
        } catch {
          // Fallback: use a static tile URL
          flyerReady = true;
          offscreenMap.remove();
        }
      }, 2000); // Wait for tiles
    });
  });

  function printFlyer() {
    window.print();
  }
</script>

<!-- Offscreen map for capture -->
<div bind:this={mapContainer} style="position:absolute; left:-9999px; width:{MAP_W}px; height:{MAP_H}px;"></div>

<div class="flyer-wrapper">
  <div class="no-print text-center mb-4">
    <button
      on:click={printFlyer}
      disabled={!flyerReady}
      class="px-6 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-50"
      style="background: {config.theme.primary};"
    >
      {flyerReady ? 'Print Flyer' : 'Preparing map...'}
    </button>
    <p class="text-xs text-gray-400 mt-1">Best printed on US Letter (8.5" x 11")</p>
  </div>

  <!-- Page 1: Map + Bubbles -->
  <div class="flyer-page" style="width:{PAGE_W}px; height:{PAGE_H}px; background: white; position: relative; overflow: hidden; margin: 0 auto; box-shadow: 0 2px 20px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="position:absolute; top:0; left:0; right:0; height:{MAP_Y}px; background:{config.theme.headerBg}; display:flex; align-items:center; justify-content:center; flex-direction:column;">
      <div style="font-family:'Playfair Display',Georgia,serif; font-size:24px; font-weight:900; color:{config.theme.headerText}; letter-spacing:-0.5px;">
        {config.name}
      </div>
      <div style="font-size:10px; color:{config.theme.accent}; margin-top:2px;">
        {config.tagline}
      </div>
    </div>

    <!-- Map Image -->
    {#if mapImageUrl}
      <img
        src={mapImageUrl}
        alt="Map"
        style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; border:1px solid #ddd; border-radius:4px;"
      />
    {:else}
      <div style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; background:#e5e7eb; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:14px;">
        Map loading...
      </div>
    {/if}

    <!-- SVG overlay: markers, leader lines, bubbles -->
    <svg style="position:absolute; top:0; left:0; width:{PAGE_W}px; height:{PAGE_H}px; pointer-events:none;" viewBox="0 0 {PAGE_W} {PAGE_H}">
      <!-- Leader lines -->
      {#each placements as p}
        <path
          d={leaderPath(p.mapX, p.mapY, p.bubbleX, p.bubbleY)}
          fill="none"
          stroke={p.shop.category?.color || '#6b7280'}
          stroke-width="0.8"
          opacity="0.5"
        />
      {/each}

      <!-- Map markers (stars) -->
      {#each placements as p}
        <polygon
          points={starPoints(p.mapX, p.mapY, 10, 4.5, 5)}
          fill={p.shop.category?.color || '#6b7280'}
          stroke="white"
          stroke-width="1"
        />
        <text
          x={p.mapX}
          y={p.mapY + 3.5}
          text-anchor="middle"
          fill="white"
          font-size="8"
          font-weight="bold"
          style="text-shadow:0 0 2px rgba(0,0,0,.5)"
        >{p.num}</text>
      {/each}

      <!-- Margin bubbles -->
      {#each placements as p}
        {@const isLeft = p.zone === 'left'}
        {@const isRight = p.zone === 'right'}
        {@const isTop = p.zone === 'top'}
        {@const anchor = isLeft ? 'end' : isRight ? 'start' : 'middle'}
        {@const textX = isLeft ? p.bubbleX - 14 : isRight ? p.bubbleX + 14 : p.bubbleX}
        {@const textY = isTop ? p.bubbleY - 8 : p.bubbleY + 8}

        <!-- Number circle -->
        <circle
          cx={p.bubbleX}
          cy={p.bubbleY}
          r="7"
          fill={p.shop.category?.color || '#6b7280'}
        />
        <text
          x={p.bubbleX}
          y={p.bubbleY + 3}
          text-anchor="middle"
          fill="white"
          font-size="7"
          font-weight="bold"
        >{p.num}</text>

        <!-- Shop name -->
        <text
          x={textX}
          y={textY}
          text-anchor={anchor}
          fill={config.theme.text}
          font-size="6.5"
          font-weight="600"
        >{p.shop.name.length > 25 ? p.shop.name.substring(0, 23) + '...' : p.shop.name}</text>

        {#if salesTodayIds.has(p.shop.id)}
          <text
            x={textX}
            y={textY + 8}
            text-anchor={anchor}
            fill="#ef4444"
            font-size="5.5"
            font-weight="bold"
          >SALE TODAY</text>
        {/if}
      {/each}
    </svg>

    <!-- Footer -->
    <div style="position:absolute; bottom:0; left:0; right:0; height:40px; background:{config.theme.headerBg}; display:flex; align-items:center; justify-content:center; padding:0 20px;">
      <span style="font-size:8px; color:{config.theme.accent};">{config.footerHtml}</span>
      <span style="font-size:7px; color:{config.theme.headerText}; opacity:0.4; margin-left:auto;">yfevents.yakimafinds.com</span>
    </div>
  </div>

  <!-- Page 2: Directory -->
  <div class="flyer-page" style="width:{PAGE_W}px; min-height:{PAGE_H}px; background: white; position: relative; margin: 20px auto 0; padding: 30px 40px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); page-break-before: always;">
    <h2 style="font-family:'Playfair Display',Georgia,serif; font-size:18px; font-weight:900; color:{config.theme.text}; margin-bottom:4px;">
      {config.name} — Shop Directory
    </h2>
    <div style="height:2px; background:{config.theme.primary}; width:60px; margin-bottom:16px;"></div>

    <div style="column-count:3; column-gap:20px; font-size:8px; color:#333; line-height:1.4;">
      {#each shops.filter(s => s.latitude && s.longitude) as shop, i}
        <div style="break-inside:avoid; margin-bottom:10px; padding-bottom:6px; border-bottom:0.5px solid #e5e7eb;">
          <div style="display:flex; align-items:center; gap:4px; margin-bottom:2px;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border-radius:50%; background:{shop.category?.color || '#6b7280'}; color:white; font-size:7px; font-weight:bold; flex-shrink:0;">{i + 1}</span>
            <strong style="font-size:8.5px; color:{config.theme.text};">{shop.name}</strong>
          </div>
          {#if shop.address}
            <div style="color:#666; margin-left:18px;">{shop.address}</div>
          {/if}
          {#if shop.phone}
            <div style="color:#444; margin-left:18px;">{shop.phone}</div>
          {/if}
          {#if getHoursText(shop.operatingHours)}
            <div style="color:#888; margin-left:18px;">{getHoursText(shop.operatingHours)}</div>
          {/if}
          {#if shop.description}
            <div style="color:#666; margin-left:18px; font-style:italic;">{shop.description}</div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Category legend -->
    <div style="position:absolute; bottom:30px; left:40px; right:40px; display:flex; gap:16px; justify-content:center; font-size:8px;">
      {#each [...new Map(shops.filter(s => s.category).map(s => [s.category?.slug, s.category])).values()] as cat}
        {#if cat}
          <div style="display:flex; align-items:center; gap:4px; color:{cat.color || '#6b7280'};">
            <span style="width:8px; height:8px; border-radius:50%; background:{cat.color || '#6b7280'};"></span>
            {cat.name}
          </div>
        {/if}
      {/each}
    </div>
  </div>
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
      transform: scale(0.85);
      margin-bottom: -80px !important;
    }
  }
</style>
