<script lang="ts">
  import type { JunkRunConfig, FlyerShop } from '$lib/types/junk-run';
  import FlyerHeaderVintage from './FlyerHeaderVintage.svelte';
  import FlyerFooterVintage from './FlyerFooterVintage.svelte';
  import { pinPath, pinLabelY, truncate, getHoursText, buildRouteQrUrl, getUniqueCategories, groupShopsByRegion, type MarkerPosition } from './flyer-utils';
  import QRCode from 'qrcode-svg';

  export let shops: FlyerShop[];
  export let config: JunkRunConfig;
  export let salesTodayIds: Set<number>;
  export let mapImageUrl: string;
  export let markerPositions: MarkerPosition[] = [];
  export let areaLabel: string;

  const PAGE_W = 816;
  const PAGE_H = 1056;
  const HEADER_H = 84;
  const FOOTER_H = 40;
  const MARGIN = 24;
  const MAP_X = MARGIN;
  const MAP_Y = HEADER_H;
  const MAP_W = PAGE_W - MARGIN * 2; // 768 — must match JunkRunFlyer capture width
  const MAP_H = 620;                 // must match JunkRunFlyer capture height
  const LIST_Y = MAP_Y + MAP_H + 6;

  // Pin number == index in the original shops order + 1 (matches markerPositions)
  $: numberById = new Map(shops.map((s, i) => [s.id, i + 1] as const));
  $: groups = groupShopsByRegion(shops);
  $: categories = getUniqueCategories(shops);
  $: showLegend = config.flyer.showCategoryLegend && categories.length >= 2;

  $: routeQrSvg = config.flyer.qrMode === 'route' ? (() => {
    const url = buildRouteQrUrl(shops);
    if (!url) return '';
    return new QRCode({ content: url, padding: 0, width: 72, height: 72, ecl: 'L', join: true }).svg();
  })() : '';

  $: onlineUrl = `yfevents.yakimafinds.com/junk-run/${config.slug}`;
  $: onlineQrSvg = new QRCode({ content: `https://${onlineUrl}`, padding: 0, width: 72, height: 72, ecl: 'L', join: true }).svg();
</script>

<!-- Page 1: kraft masthead + map + region ledger (names only) -->
<div class="flyer-page" style="width:{PAGE_W}px; height:{PAGE_H}px; background:#efe3cd; background-image:linear-gradient(135deg,rgba(90,58,34,0.045) 25%,transparent 25%,transparent 50%,rgba(90,58,34,0.045) 50%,rgba(90,58,34,0.045) 75%,transparent 75%); background-size:9px 9px; position:relative; overflow:hidden; margin:0 auto; box-shadow:0 2px 20px rgba(0,0,0,0.18);">
  <FlyerHeaderVintage {config} {areaLabel} height={HEADER_H} />

  {#if mapImageUrl}
    <img src={mapImageUrl} alt="Map" style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; border:2px solid #8a6a44; border-radius:4px;" />
    <div style="position:absolute; left:{MAP_X}px; top:{MAP_Y + MAP_H - 13}px; width:{MAP_W}px; text-align:right; pointer-events:none;">
      <span style="font-size:6px; color:#5a3a22; background:rgba(243,230,207,0.85); padding:1px 5px;">&copy; OpenStreetMap contributors &copy; CARTO</span>
    </div>
  {:else}
    <div style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; background:#d8c39a; border:2px solid #8a6a44; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#5a3a22; font:14px 'Special Elite',monospace;">
      Map unavailable &mdash; try Generate Flyer again
    </div>
  {/if}

  <!-- numbered pins -->
  <svg style="position:absolute; top:0; left:0; width:{PAGE_W}px; height:{PAGE_H}px; pointer-events:none;" viewBox="0 0 {PAGE_W} {PAGE_H}">
    <defs>
      <filter id="pinShadowVG" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1.2" stdDeviation="1" flood-opacity="0.45" />
      </filter>
    </defs>
    {#each markerPositions as m}
      <path d={pinPath(MAP_X + m.x, MAP_Y + m.y)} fill={m.shop.category?.color || '#6b7280'} stroke="white" stroke-width="1.5" filter="url(#pinShadowVG)" />
      <text x={MAP_X + m.x} y={pinLabelY(MAP_Y + m.y) + 3.2} text-anchor="middle" fill="white" font-size="9.5" font-weight="bold" font-family="Arial, sans-serif">{m.num}</text>
    {/each}
  </svg>

  <!-- legend -->
  {#if showLegend}
    <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:{MAP_Y + MAP_H + 4}px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
      {#each categories as cat}
        <span style="display:flex; align-items:center; gap:3px; font:bold 6px 'Courier Prime',monospace; letter-spacing:0.3px; color:#5a3a22;">
          <span style="width:7px; height:7px; border-radius:50%; background:{cat.color || '#6b7280'}; display:inline-block;"></span>{cat.name.toUpperCase()}
        </span>
      {/each}
    </div>
  {/if}

  <!-- region-grouped ledger (names only) -->
  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:{LIST_Y + (showLegend ? 14 : 0)}px; bottom:{FOOTER_H + 4}px; overflow:hidden;">
    <div style="column-count:2; column-gap:16px;">
      {#each groups as g}
        <div style="break-inside:avoid; margin-bottom:6px;">
          <div style="font:bold 7.5px 'Special Elite',monospace; letter-spacing:1px; text-transform:uppercase; color:#5a3a22; border-bottom:1.5px solid #b7410e; padding-bottom:1px; margin-bottom:2px;"><span style="color:#c8a951;">&#10022;</span> {g.label}</div>
          {#each g.shops as shop, i}
            <div style="display:flex; align-items:center; gap:4px; padding:1.5px 2px; background:{i % 2 ? 'rgba(183,65,14,0.06)' : 'transparent'}; font:9px/1.2 'Playfair Display',Georgia,serif; color:#3d2a18;">
              <span style="font:bold 7px 'Courier Prime',monospace; color:#b7410e; min-width:13px;">{numberById.get(shop.id)}</span>
              <span style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{truncate(shop.name, 26)}</span>
              {#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
                <span style="font:bold 5.5px 'Special Elite',monospace; background:#b7410e; color:#fff; padding:0 2px; border-radius:1px; flex-shrink:0;">SALE</span>
              {/if}
              <span style="flex:1; border-bottom:1px dotted #a07a4a; height:6px; min-width:6px;"></span>
              <span style="font:6px 'Courier Prime',monospace; color:#7a5a36; flex-shrink:0;">{(shop.category?.name || '').toUpperCase()}</span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <FlyerFooterVintage {config} height={FOOTER_H} qrSvg={routeQrSvg} ctaText={routeQrSvg ? 'Scan for a route to every shop' : ''} />
</div>

<!-- Page 2: full directory with address/phone -->
<div class="flyer-page" style="width:{PAGE_W}px; height:{PAGE_H}px; background:#efe3cd; background-image:linear-gradient(135deg,rgba(90,58,34,0.045) 25%,transparent 25%,transparent 50%,rgba(90,58,34,0.045) 50%,rgba(90,58,34,0.045) 75%,transparent 75%); background-size:9px 9px; position:relative; overflow:hidden; margin:20px auto 0; box-shadow:0 2px 20px rgba(0,0,0,0.18); page-break-before:always;">
  <div style="text-align:center; padding:14px 8px 8px; border-bottom:2px solid #5a3a22;">
    <div style="font:400 22px 'Rye','Playfair Display',serif; color:#3d2a18;">The Full Directory</div>
    <div style="font:italic 400 9px 'Playfair Display',Georgia,serif; color:#5a3a22;">{config.name} &mdash; addresses, hours &amp; phone</div>
  </div>

  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:64px; bottom:{FOOTER_H + 4}px; overflow:hidden;">
    <div style="column-count:2; column-gap:18px;">
      {#each groups as g}
        <div style="break-inside:avoid; margin-bottom:7px;">
          <div style="font:bold 8px 'Special Elite',monospace; letter-spacing:1px; text-transform:uppercase; color:#5a3a22; border-bottom:1.5px solid #b7410e; padding-bottom:1px; margin-bottom:3px;"><span style="color:#c8a951;">&#10022;</span> {g.label}</div>
          {#each g.shops as shop}
            <div style="break-inside:avoid; margin-bottom:4px; padding-bottom:3px; border-bottom:1px dotted #c2a877;">
              <div style="display:flex; align-items:center; gap:4px;">
                <span style="font:bold 7px 'Courier Prime',monospace; color:#b7410e; min-width:13px;">{numberById.get(shop.id)}</span>
                <strong style="font:700 9.5px 'Playfair Display',serif; color:#3d2a18;">{shop.name}</strong>
                {#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
                  <span style="font:bold 5.5px 'Special Elite',monospace; background:#b7410e; color:#fff; padding:0 2px;">SALE</span>
                {/if}
              </div>
              {#if shop.address}<div style="font:7px 'Courier Prime',monospace; color:#6b4f33; margin-left:17px;">{shop.address}</div>{/if}
              {#if config.flyer.showPhoneNumbers && shop.phone}<div style="font:7px 'Courier Prime',monospace; color:#5a3a22; margin-left:17px;">{shop.phone}</div>{/if}
              {#if config.flyer.showHours && getHoursText(shop.operatingHours)}<div style="font:7px 'Courier Prime',monospace; color:#8a6a44; margin-left:17px;">{getHoursText(shop.operatingHours)}</div>{/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <FlyerFooterVintage {config} height={FOOTER_H} qrSvg={onlineQrSvg} ctaText={"Full guide & today’s sales online"} url={onlineUrl} />
</div>
