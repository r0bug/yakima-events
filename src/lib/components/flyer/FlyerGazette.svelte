<script lang="ts">
  import type { JunkRunConfig, FlyerShop } from '$lib/types/junk-run';
  import { truncate, getHoursText, getUniqueCategories, groupShopsByRegion, type MarkerPosition } from './flyer-utils';
  import QRCode from 'qrcode-svg';

  export let shops: FlyerShop[];
  export let config: JunkRunConfig;
  export let salesTodayIds: Set<number>;
  export let mapImageUrl: string;
  export let markerPositions: MarkerPosition[] = [];
  export let areaLabel: string;

  // Landscape US Letter at 96dpi
  const PAGE_W = 1056;
  const PAGE_H = 816;
  const MARGIN = 20;

  const MAST_H = 104;
  const FOOT_H = 30;

  const COL_W = 296;                       // front-page story column
  const MAP_X = MARGIN + COL_W + 16;       // 332
  const MAP_Y = MAST_H + 4;                // 108
  const MAP_W = 698;                       // must match JunkRunFlyer capture width
  const MAP_H = 648;                       // must match JunkRunFlyer capture height

  const RAIL_W = 200;

  const INK = '#1a1a1a';
  const PAPER = '#f4f1e8';

  $: accent = config.theme.primary;
  $: gold = config.theme.accent;

  // Pin number == index in the original shops order + 1 (matches markerPositions)
  $: numberById = new Map(shops.map((s, i) => [s.id, i + 1] as const));
  $: groups = groupShopsByRegion(shops);
  $: categories = getUniqueCategories(shops);

  $: editionLabel = config.gazette?.editionLabel || `${config.name} Edition`;
  $: hashtag = `#${config.slug.replace(/[^a-z0-9]/gi, '')}JunkRun`;
  $: onlineUrl = `yfevents.yakimafinds.com/junk-run/${config.slug}`;

  /** "#1-17" for a region block, so the map and the classifieds cross-reference. */
  function rangeLabel(group: { shops: FlyerShop[] }): string {
    const nums = group.shops.map((s) => numberById.get(s.id) ?? 0).filter(Boolean);
    if (nums.length === 0) return '';
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    return lo === hi ? `#${lo}` : `#${lo}–${hi}`;
  }

  function starPoints(cx: number, cy: number, outerR: number, innerR: number, pts = 5): string {
    const out: string[] = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle = (Math.PI / pts) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      out.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return out.join(' ');
  }

  function qr(content: string, size: number): string {
    return new QRCode({ content, padding: 0, width: size, height: size, ecl: 'L', join: true }).svg();
  }

  $: liveMapQr = qr(`https://${onlineUrl}`, 84);
  $: shopQrs = new Map(
    shops
      .filter((s) => s.latitude && s.longitude)
      .map((s) => [
        s.id,
        qr(`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`, 34),
      ])
  );

  $: homeBase = config.gazette?.homeBaseShopId
    ? shops.find((s) => s.id === config.gazette?.homeBaseShopId)
    : undefined;

  $: railBoxes = config.gazette?.railBoxes ?? [];

  // Generated lede, overridable via config.gazette.lede
  $: regionNames = groups.map((g) => g.label);
  $: regionPhrase =
    regionNames.length > 1
      ? ` spanning ${regionNames[0]} to ${regionNames[regionNames.length - 1]}`
      : regionNames.length === 1
        ? ` around ${regionNames[0]}`
        : '';
  $: lede =
    config.gazette?.lede ||
    `Bargain hunters and vintage devotees converge on the valley as ${shops.length} shops, thrift stores and specialty dens${regionPhrase} throw open their doors. Numbered stars on the map at right mark every stop, and the dense downtown cluster is detailed in the inset.`;
</script>

<!-- ============ PAGE 1 — front page: story + treasure map ============ -->
<div
  class="flyer-page"
  style="width:{PAGE_W}px; height:{PAGE_H}px; background:{PAPER}; position:relative; overflow:hidden; margin:0 auto; box-shadow:0 2px 20px rgba(0,0,0,0.18); color:{INK};"
>
  <!-- Masthead -->
  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:10px; height:{MAST_H - 14}px;">
    <div style="display:flex; justify-content:space-between; align-items:baseline; font:bold 7px 'Courier Prime',monospace; letter-spacing:1.6px; text-transform:uppercase; border-bottom:1px solid {INK}; padding-bottom:3px;">
      <span>{truncate(editionLabel, 38)}</span>
      <span>Yakima, Washington</span>
      <span>Free &mdash; Take One</span>
    </div>

    <div style="text-align:center; margin-top:6px;">
      <div style="font:900 40px 'Playfair Display',Georgia,serif; letter-spacing:3px; line-height:1;">
        YAKIMA <span style="color:{accent};">&#9733;</span> FINDS
      </div>
      <div style="font:bold 10px 'Courier Prime',monospace; letter-spacing:7px; text-transform:uppercase; margin-top:4px;">
        &mdash; The Junk Run Gazette &mdash;
      </div>
    </div>
  </div>
  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:{MAST_H - 4}px; border-top:3px double {INK};"></div>

  <!-- Story column -->
  <div style="position:absolute; left:{MARGIN}px; top:{MAP_Y}px; width:{COL_W}px; bottom:{FOOT_H + 6}px; overflow:hidden;">
    <div style="font:900 26px/0.95 'Playfair Display',Georgia,serif; text-transform:uppercase;">
      {shops.length} Stops of<br />Buried Treasure
    </div>
    <div style="font:italic 700 9.5px/1.3 'Playfair Display',Georgia,serif; color:#4a4a4a; margin-top:6px;">
      {config.tagline}{areaLabel ? ` — ${areaLabel}` : ''}
    </div>
    <div style="border-top:1px solid {INK}; margin:7px 0 6px;"></div>

    <p style="font:8.5px/1.38 'Playfair Display',Georgia,serif; text-align:justify; margin:0 0 5px;">
      <strong style="letter-spacing:.5px;">YAKIMA VALLEY &mdash;</strong> {lede}
    </p>
    <p style="font:8.5px/1.38 'Playfair Display',Georgia,serif; text-align:justify; margin:0 0 5px; text-indent:10px;">
      Overleaf, readers will find the full classified directory &mdash; every stop with address and
      telephone, plus a scannable code that summons turn-by-turn directions to its door.
    </p>
    <p style="font:8.5px/1.38 'Playfair Display',Georgia,serif; text-align:justify; margin:0 0 7px; text-indent:10px;">
      Local experts recommend an early start: the good junk goes first.
    </p>

    {#if config.venue}
      <div style="border:1.5px solid {accent}; padding:5px 7px; margin-bottom:7px; background:rgba(0,0,0,0.02);">
        <div style="font:bold 7px 'Courier Prime',monospace; letter-spacing:1.5px; text-transform:uppercase; color:{accent};">
          Headed to the show?
        </div>
        <div style="font:700 10px 'Playfair Display',serif; margin-top:2px;">{config.venue.name}</div>
        {#if config.venue.label}
          <div style="font:7px 'Courier Prime',monospace; color:#4a4a4a; margin-top:1px;">{config.venue.label}</div>
        {/if}
      </div>
    {/if}

    <!-- Map key -->
    {#if config.flyer.showCategoryLegend && categories.length >= 2}
      <div style="border:1px solid {INK}; padding:5px 7px; margin-bottom:7px;">
        <div style="font:bold 7.5px 'Courier Prime',monospace; letter-spacing:2px; text-transform:uppercase; border-bottom:1px solid {INK}; padding-bottom:2px; margin-bottom:4px;">
          Map Key
        </div>
        {#each categories as cat}
          <div style="display:flex; align-items:center; gap:5px; font:8px 'Playfair Display',serif; margin-bottom:1.5px;">
            <svg width="11" height="11" viewBox="0 0 11 11" style="flex-shrink:0;">
              <polygon points={starPoints(5.5, 5.5, 5, 2.2)} fill={cat.color || '#6b7280'} stroke={INK} stroke-width="0.4" />
            </svg>
            <span>{cat.name}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Extra! Extra! -->
    {#if config.customContent.announcementText}
      <div style="border:2px dashed {accent}; padding:6px 8px; text-align:center;">
        <div style="font:bold 8px 'Courier Prime',monospace; letter-spacing:2px; text-transform:uppercase; color:{accent};">
          &#9733; Extra! Extra! &#9733;
        </div>
        <div style="font:8px/1.3 'Playfair Display',serif; margin-top:3px;">
          {config.customContent.announcementText}
        </div>
      </div>
    {/if}
  </div>

  <!-- Treasure map -->
  {#if mapImageUrl}
    <img
      src={mapImageUrl}
      alt="Junk run map"
      style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; border:1.5px solid {INK};"
    />
  {:else}
    <div style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; border:1.5px solid {INK}; display:flex; align-items:center; justify-content:center; font:12px 'Courier Prime',monospace; color:#666; background:#e8e4d8;">
      Map unavailable &mdash; try Generate Flyer again
    </div>
  {/if}

  <!-- Numbered stars -->
  <svg style="position:absolute; top:0; left:0; width:{PAGE_W}px; height:{PAGE_H}px; pointer-events:none;" viewBox="0 0 {PAGE_W} {PAGE_H}">
    <defs>
      <filter id="gzStarShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="0.9" flood-opacity="0.45" />
      </filter>
    </defs>
    {#each markerPositions as m}
      <polygon
        points={starPoints(MAP_X + m.x, MAP_Y + m.y, 10, 4.4)}
        fill={m.shop.category?.color || '#6b7280'}
        stroke="#fff"
        stroke-width="1.1"
        filter="url(#gzStarShadow)"
      />
      <text
        x={MAP_X + m.x}
        y={MAP_Y + m.y + 3}
        text-anchor="middle"
        fill="#fff"
        font-size="8"
        font-weight="bold"
        font-family="Arial, sans-serif"
        style="paint-order:stroke; stroke:rgba(0,0,0,.45); stroke-width:1.6px;"
      >{m.num}</text>
    {/each}
  </svg>

  <div style="position:absolute; left:{MAP_X}px; top:{MAP_Y + MAP_H + 3}px; width:{MAP_W}px; display:flex; justify-content:space-between; font:italic 6.5px 'Playfair Display',serif; color:#4a4a4a;">
    <span>THE TREASURE MAP &mdash; numbered stars mark all {shops.length} stops.</span>
    <span>&copy; OpenStreetMap contributors</span>
  </div>

  <!-- Footer -->
  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; bottom:8px; border-top:1px solid {INK}; padding-top:3px; display:flex; justify-content:space-between; font:bold 6.5px 'Courier Prime',monospace; letter-spacing:1.4px; text-transform:uppercase;">
    <span>yakimafinds.com</span>
    <span style="color:{accent};">{hashtag}</span>
    <span>Page 1 of 2</span>
  </div>
</div>

<!-- ============ PAGE 2 — classifieds directory ============ -->
<div
  class="flyer-page"
  style="width:{PAGE_W}px; height:{PAGE_H}px; background:{PAPER}; position:relative; overflow:hidden; margin:20px auto 0; box-shadow:0 2px 20px rgba(0,0,0,0.18); color:{INK}; page-break-before:always;"
>
  <!-- Masthead -->
  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:10px;">
    <div style="text-align:center;">
      <div style="font:900 26px 'Playfair Display',Georgia,serif; letter-spacing:2px; line-height:1;">
        YAKIMA <span style="color:{accent};">&#9733;</span> FINDS
      </div>
      <div style="font:bold 9px 'Courier Prime',monospace; letter-spacing:6px; text-transform:uppercase; margin-top:3px; border-top:1px solid {INK}; border-bottom:3px double {INK}; padding:3px 0;">
        Junk Run Classifieds
      </div>
      <div style="font:italic 6.5px 'Playfair Display',serif; color:#4a4a4a; margin-top:3px;">
        {shops.length} listings &middot; numbers match the stars on the map overleaf &middot; scan a code for turn-by-turn directions &middot; hours vary, call ahead
      </div>
    </div>
  </div>

  <!-- Listings -->
  <div style="position:absolute; left:{MARGIN}px; top:82px; width:{PAGE_W - MARGIN * 2 - RAIL_W - 14}px; bottom:{FOOT_H + 4}px; overflow:hidden;">
    <div style="column-count:4; column-gap:12px; min-height:0;">
      {#each groups as g}
        <!-- groups deliberately flow across columns; only entries stay unbroken,
             otherwise one long region reserves an entire column -->
        <div style="margin-bottom:6px;">
          <div style="background:{INK}; color:{PAPER}; break-after:avoid; padding:2px 5px; display:flex; justify-content:space-between; align-items:center; font:bold 6.5px 'Courier Prime',monospace; letter-spacing:1.2px; text-transform:uppercase;">
            <span>{truncate(g.label, 22)}</span>
            <span style="color:{gold};">{rangeLabel(g)}</span>
          </div>

          {#each g.shops as shop}
            <div style="break-inside:avoid; display:flex; gap:4px; align-items:flex-start; padding:3px 2px; border-bottom:1px dotted #b9b2a0;">
              <svg width="13" height="13" viewBox="0 0 13 13" style="flex-shrink:0; margin-top:1px;">
                <polygon points={starPoints(6.5, 6.5, 6, 2.6)} fill={shop.category?.color || '#6b7280'} stroke={INK} stroke-width="0.4" />
              </svg>
              <div style="flex:1; min-width:0;">
                <div style="font:700 8px/1.15 'Playfair Display',serif; display:flex; align-items:center; gap:3px;">
                  <span style="font:bold 6.5px 'Courier Prime',monospace; color:{accent};">{numberById.get(shop.id)}</span>
                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{truncate(shop.name, 24)}</span>
                  {#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
                    <span style="font:bold 5px 'Courier Prime',monospace; background:{accent}; color:#fff; padding:0 2px; flex-shrink:0;">SALE</span>
                  {/if}
                </div>
                {#if shop.address}
                  <div style="font:6.2px/1.2 'Courier Prime',monospace; color:#55504a;">{truncate(shop.address, 34)}</div>
                {/if}
                {#if config.flyer.showPhoneNumbers && shop.phone}
                  <div style="font:6.2px 'Courier Prime',monospace; color:#55504a;">{shop.phone}</div>
                {/if}
                {#if config.flyer.showHours && getHoursText(shop.operatingHours)}
                  <div style="font:6px 'Courier Prime',monospace; color:#7a7468;">{truncate(getHoursText(shop.operatingHours), 30)}</div>
                {/if}
              </div>
              {#if config.flyer.qrMode !== 'none' && shopQrs.has(shop.id)}
                <div style="width:34px; height:34px; flex-shrink:0; line-height:0;">{@html shopQrs.get(shop.id)}</div>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- Right rail -->
  <div style="position:absolute; right:{MARGIN}px; top:82px; width:{RAIL_W}px; bottom:{FOOT_H + 4}px; overflow:hidden;">
    {#if homeBase}
      <div style="border:2.5px solid {accent}; padding:6px 7px; margin-bottom:7px; text-align:center;">
        <div style="font:900 12px 'Playfair Display',serif; letter-spacing:1px;">
          YAKIMA <span style="color:{accent};">&#9733;</span> FINDS
        </div>
        <div style="font:bold 7px 'Courier Prime',monospace; letter-spacing:1.5px; text-transform:uppercase; color:{accent}; margin-top:2px;">
          Home Base &mdash; Stop #{numberById.get(homeBase.id)}
        </div>
        <div style="font:7px/1.25 'Playfair Display',serif; margin-top:3px;">{homeBase.address || ''}</div>
        {#if homeBase.phone}
          <div style="font:6.5px 'Courier Prime',monospace; margin-top:1px;">{homeBase.phone}</div>
        {/if}
      </div>
    {/if}

    <div style="border:1.5px solid {INK}; padding:6px 7px; margin-bottom:7px; text-align:center;">
      <div style="font:bold 7px 'Courier Prime',monospace; letter-spacing:1.5px; text-transform:uppercase; border-bottom:1px solid {INK}; padding-bottom:2px;">
        Scan for the live map
      </div>
      <div style="width:84px; height:84px; margin:5px auto 3px; line-height:0;">{@html liveMapQr}</div>
      <div style="font:6px 'Courier Prime',monospace; color:#55504a; word-break:break-all;">{onlineUrl}</div>
    </div>

    {#each railBoxes as box}
      <div style="border:1.5px solid {INK}; padding:6px 7px; margin-bottom:7px;">
        <div style="font:bold 7px 'Courier Prime',monospace; letter-spacing:1.5px; text-transform:uppercase; border-bottom:1px solid {INK}; padding-bottom:2px; margin-bottom:3px;">
          {box.title}
        </div>
        <div style="font:7px/1.3 'Playfair Display',serif;">{box.body}</div>
        {#if box.qrUrl}
          <div style="width:60px; height:60px; margin:4px auto 2px; line-height:0;">{@html qr(box.qrUrl, 60)}</div>
        {/if}
        {#if box.qrCaption}
          <div style="font:6px 'Courier Prime',monospace; color:#55504a; text-align:center;">{box.qrCaption}</div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Footer -->
  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; bottom:8px; border-top:1px solid {INK}; padding-top:3px; display:flex; justify-content:space-between; font:bold 6.5px 'Courier Prime',monospace; letter-spacing:1.4px; text-transform:uppercase;">
    <span>yakimafinds.com</span>
    <span style="color:{accent};">{hashtag}</span>
    <span>Page 2 of 2</span>
  </div>
</div>
