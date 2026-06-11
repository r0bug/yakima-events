<script lang="ts">
	import type { JunkRunConfig, FlyerShop } from '$lib/types/junk-run';
	import FlyerHeader from './FlyerHeader.svelte';
	import FlyerFooter from './FlyerFooter.svelte';
	import { pinPath, pinLabelY, truncate, getBaseFontSize, getColumnCount, buildRouteQrUrl, getUniqueCategories, type MarkerPosition } from './flyer-utils';
	import QRCode from 'qrcode-svg';

	export let shops: FlyerShop[];
	export let config: JunkRunConfig;
	export let salesTodayIds: Set<number>;
	export let mapImageUrl: string;
	export let markerPositions: MarkerPosition[] = [];
	export let areaLabel: string;

	const PAGE_W = 816;
	const PAGE_H = 1056;
	const HEADER_H = 80;
	const FOOTER_H = 36;
	const MARGIN = 28;

	// Compact map (40% of page)
	const MAP_X = MARGIN;
	const MAP_Y = HEADER_H;
	const MAP_W = PAGE_W - MARGIN * 2;
	const MAP_H = 380;
	const GRID_Y = MAP_Y + MAP_H + 12;
	const GRID_H = PAGE_H - GRID_Y - FOOTER_H - 60; // Leave room for QR

	$: baseFontSize = getBaseFontSize(config.flyer.fontSize);
	$: gridCols = getColumnCount(config.flyer.columnCount, shops.length, 'list');
	$: categories = getUniqueCategories(shops);
	$: showLegend = config.flyer.showCategoryLegend && categories.length >= 2;

	// Single route QR in corner
	$: routeQrSvg = config.flyer.qrMode !== 'none' ? (() => {
		const url = buildRouteQrUrl(shops);
		if (!url) return '';
		const qr = new QRCode({ content: url, padding: 0, width: 72, height: 72, ecl: 'L', join: true });
		return qr.svg();
	})() : '';
</script>

<!-- Single Page Postcard -->
<div class="flyer-page" style="width:{PAGE_W}px; height:{PAGE_H}px; background:white; position:relative; overflow:hidden; margin:0 auto; box-shadow:0 2px 20px rgba(0,0,0,0.1);">
	<!-- Larger header for postcard -->
	<div style="position:absolute; top:0; left:0; right:0; height:{HEADER_H}px; background:{config.theme.headerBg}; display:flex; align-items:center; justify-content:center; flex-direction:column;">
		{#if config.customContent.sponsorLogoUrl && config.customContent.sponsorLogoPlacement === 'header'}
			<img src={config.customContent.sponsorLogoUrl} alt="Sponsor" style="height:28px; position:absolute; left:24px; top:50%; transform:translateY(-50%);" />
		{/if}
		<div style="font-family:'Playfair Display',Georgia,serif; font-size:26px; font-weight:900; color:{config.theme.headerText}; letter-spacing:-0.5px;">
			{config.name}
		</div>
		<div style="font-size:11px; color:{config.theme.accent}; margin-top:2px;">
			{config.tagline} &mdash; {areaLabel}
		</div>
		{#if config.customContent.announcementText}
			<div style="font-size:9px; color:{config.theme.accent}; font-weight:bold; margin-top:2px;">
				{config.customContent.announcementText}
			</div>
		{/if}
	</div>

	<!-- Map -->
	{#if mapImageUrl}
		<img src={mapImageUrl} alt="Map" style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; border:1px solid #d6d0c6; border-radius:8px;" />
		<div style="position:absolute; left:{MAP_X}px; top:{MAP_Y + MAP_H - 13}px; width:{MAP_W}px; text-align:right; pointer-events:none;">
			<span style="font-size:6px; color:#777; background:rgba(255,255,255,0.8); padding:1px 5px; border-radius:3px 0 6px 0;">&copy; OpenStreetMap contributors &copy; CARTO</span>
		</div>
	{:else}
		<div style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; background:#e5e7eb; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:14px;">
			Map unavailable &mdash; try Generate Flyer again
		</div>
	{/if}

	<!-- Numbered pin markers -->
	<svg style="position:absolute; top:0; left:0; width:{PAGE_W}px; height:{PAGE_H}px; pointer-events:none;" viewBox="0 0 {PAGE_W} {PAGE_H}">
		<defs>
			<filter id="pinShadowPC" x="-50%" y="-50%" width="200%" height="200%">
				<feDropShadow dx="0" dy="1.2" stdDeviation="1" flood-opacity="0.45" />
			</filter>
		</defs>
		{#each markerPositions as m}
			<path d={pinPath(MAP_X + m.x, MAP_Y + m.y, 8)} fill={m.shop.category?.color || '#6b7280'} stroke="white" stroke-width="1.5" filter="url(#pinShadowPC)" />
			<text x={MAP_X + m.x} y={pinLabelY(MAP_Y + m.y, 8) + 3} text-anchor="middle" fill="white" font-size="8.5" font-weight="bold" font-family="Arial, sans-serif">{m.num}</text>
		{/each}
	</svg>

	<!-- Compact name grid -->
	<div style="position:absolute; left:{MARGIN}px; top:{GRID_Y}px; right:{MARGIN}px; height:{GRID_H}px; overflow:hidden;">
		{#if showLegend}
			<div style="display:flex; gap:12px; margin-bottom:5px; font-size:{baseFontSize - 1}px;">
				{#each categories as cat}
					<span style="display:flex; align-items:center; gap:3px; color:{cat.color || '#6b7280'};">
						<span style="width:7px; height:7px; border-radius:50%; background:{cat.color || '#6b7280'}; display:inline-block;"></span>
						{cat.name}
					</span>
				{/each}
			</div>
		{/if}
		<div style="column-count:{gridCols}; column-gap:10px; font-size:{baseFontSize}px; color:#333; line-height:1.4;">
			{#each shops as shop, i}
				<div style="break-inside:avoid; margin-bottom:3px; display:flex; align-items:baseline; gap:3px;">
					<span style="display:inline-flex; align-items:center; justify-content:center; min-width:14px; height:14px; border-radius:50%; background:{shop.category?.color || '#6b7280'}; color:white; font-size:7px; font-weight:bold; flex-shrink:0;">{i + 1}</span>
					<span style="font-weight:600;">{truncate(shop.name, 25)}</span>
					{#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
						<span style="color:#ef4444; font-size:{baseFontSize - 2}px; font-weight:bold;">SALE</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Route QR in bottom-right corner -->
	{#if routeQrSvg}
		<div style="position:absolute; bottom:{FOOTER_H + 8}px; right:{MARGIN}px; text-align:center;">
			<div style="width:72px; height:72px;">{@html routeQrSvg}</div>
			<div style="font-size:6px; color:#999; margin-top:1px;">Scan for route</div>
		</div>
	{/if}

	<!-- Visit online note -->
	<div style="position:absolute; bottom:{FOOTER_H + 24}px; left:{MARGIN}px; font-size:8px; color:#999;">
		Full directory with hours &amp; details: yfevents.yakimafinds.com/junk-run/{config.slug}
	</div>

	<FlyerFooter {config} height={FOOTER_H} />
</div>
