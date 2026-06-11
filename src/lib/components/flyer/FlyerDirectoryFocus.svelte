<script lang="ts">
	import type { JunkRunConfig, FlyerShop } from '$lib/types/junk-run';
	import FlyerHeader from './FlyerHeader.svelte';
	import FlyerFooter from './FlyerFooter.svelte';
	import { pinPath, pinLabelY, truncate, getHoursText, getBaseFontSize, getColumnCount, buildRouteQrUrl, getUniqueCategories, type MarkerPosition } from './flyer-utils';
	import QRCode from 'qrcode-svg';

	export let shops: FlyerShop[];
	export let config: JunkRunConfig;
	export let salesTodayIds: Set<number>;
	export let mapImageUrl: string;
	export let markerPositions: MarkerPosition[] = [];
	export let areaLabel: string;

	const PAGE_W = 816;
	const PAGE_H = 1056;
	const HEADER_H = 70;
	const FOOTER_H = 36;
	const MARGIN = 24;

	// Half-page map
	const MAP_X = MARGIN;
	const MAP_Y = HEADER_H;
	const MAP_W = PAGE_W - MARGIN * 2;
	const MAP_H = 380;
	const DIR_Y = MAP_Y + MAP_H + 12;
	const DIR_H = PAGE_H - DIR_Y - FOOTER_H - 8;

	$: baseFontSize = getBaseFontSize(config.flyer.fontSize);
	$: dirCols = getColumnCount(config.flyer.columnCount, shops.length, 'directory');
	$: categories = getUniqueCategories(shops);
	$: showLegend = config.flyer.showCategoryLegend && categories.length >= 2;

	// Determine if we need a second page
	$: maxPerPage = config.flyer.maxShopsPerPage;
	$: page1Shops = shops.slice(0, maxPerPage);
	$: page2Shops = shops.slice(maxPerPage);
	$: needsPage2 = page2Shops.length > 0;

	$: routeQrSvg = config.flyer.qrMode === 'route' ? (() => {
		const url = buildRouteQrUrl(shops);
		if (!url) return '';
		const qr = new QRCode({ content: url, padding: 0, width: 64, height: 64, ecl: 'L', join: true });
		return qr.svg();
	})() : '';

	$: individualQrs = config.flyer.qrMode === 'individual' ? new Map(
		shops.filter(s => s.latitude && s.longitude).map(s => [
			s.id,
			new QRCode({
				content: `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`,
				padding: 0, width: 36, height: 36, ecl: 'L', join: true,
			}).svg()
		])
	) : new Map();
</script>

<!-- Page 1: Half Map + Categorized Directory -->
<div class="flyer-page" style="width:{PAGE_W}px; height:{PAGE_H}px; background:white; position:relative; overflow:hidden; margin:0 auto; box-shadow:0 2px 20px rgba(0,0,0,0.1);">
	<FlyerHeader {config} {areaLabel} height={HEADER_H} />

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
			<filter id="pinShadowDF" x="-50%" y="-50%" width="200%" height="200%">
				<feDropShadow dx="0" dy="1.2" stdDeviation="1" flood-opacity="0.45" />
			</filter>
		</defs>
		{#each markerPositions as m}
			<path d={pinPath(MAP_X + m.x, MAP_Y + m.y, 8)} fill={m.shop.category?.color || '#6b7280'} stroke="white" stroke-width="1.5" filter="url(#pinShadowDF)" />
			<text x={MAP_X + m.x} y={pinLabelY(MAP_Y + m.y, 8) + 3} text-anchor="middle" fill="white" font-size="8.5" font-weight="bold" font-family="Arial, sans-serif">{m.num}</text>
		{/each}
	</svg>

	<!-- Directory directly below map (with addresses) -->
	<div style="position:absolute; left:{MARGIN}px; top:{DIR_Y}px; right:{MARGIN}px; height:{DIR_H}px; overflow:hidden;">
		{#if showLegend}
			<div style="display:flex; gap:12px; margin-bottom:6px; font-size:{baseFontSize - 2}px;">
				{#each categories as cat}
					<span style="display:flex; align-items:center; gap:3px; color:{cat.color || '#6b7280'};">
						<span style="width:6px; height:6px; border-radius:50%; background:{cat.color || '#6b7280'}; display:inline-block;"></span>
						{cat.name}
					</span>
				{/each}
				{#if routeQrSvg}
					<span style="margin-left:auto; display:flex; align-items:center; gap:4px;">
						<span style="width:32px; height:32px;">{@html routeQrSvg}</span>
						<span style="font-size:6px; color:#999;">Route</span>
					</span>
				{/if}
			</div>
		{/if}

		<div style="column-count:{dirCols}; column-gap:16px; font-size:{baseFontSize - 0.5}px; color:#333; line-height:1.4;">
			{#each page1Shops as shop, i}
				<div style="break-inside:avoid; margin-bottom:4px; padding-bottom:3px; border-bottom:0.5px solid #eee;">
					<div style="display:flex; align-items:flex-start; gap:4px;">
						{#if config.flyer.qrMode === 'individual' && individualQrs.has(shop.id)}
							<div style="flex-shrink:0; width:36px; height:36px;">{@html individualQrs.get(shop.id)}</div>
						{/if}
						<div style="flex:1; min-width:0;">
							<div style="display:flex; align-items:center; gap:3px;">
								<span style="display:inline-flex; align-items:center; justify-content:center; min-width:12px; height:12px; border-radius:50%; background:{shop.category?.color || '#6b7280'}; color:white; font-size:6px; font-weight:bold; flex-shrink:0;">{i + 1}</span>
								<strong style="font-size:{baseFontSize}px;">{truncate(shop.name, 30)}</strong>
								{#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
									<span style="color:#ef4444; font-size:{baseFontSize - 2}px; font-weight:bold;">SALE</span>
								{/if}
							</div>
							{#if shop.address}
								<div style="color:#666; margin-left:15px; font-size:{baseFontSize - 1.5}px;">{truncate(shop.address, 40)}</div>
							{/if}
							{#if config.flyer.showPhoneNumbers && shop.phone}
								<div style="color:#444; margin-left:15px; font-size:{baseFontSize - 1.5}px;">{shop.phone}</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<FlyerFooter {config} height={FOOTER_H} />
</div>

<!-- Page 2 (overflow only) -->
{#if needsPage2}
	<div class="flyer-page" style="width:{PAGE_W}px; min-height:{PAGE_H}px; background:white; position:relative; margin:20px auto 0; padding:30px 40px; box-shadow:0 2px 20px rgba(0,0,0,0.1); page-break-before:always;">
		<h2 style="font-family:'Playfair Display',Georgia,serif; font-size:16px; font-weight:900; color:{config.theme.text}; margin-bottom:4px;">
			{config.name} &mdash; continued
		</h2>
		<div style="height:2px; background:{config.theme.primary}; width:60px; margin-bottom:16px;"></div>

		<div style="column-count:{dirCols}; column-gap:20px; font-size:{baseFontSize}px; color:#333; line-height:1.5;">
			{#each page2Shops as shop, i}
				{@const num = maxPerPage + i + 1}
				<div style="break-inside:avoid; margin-bottom:6px; padding-bottom:4px; border-bottom:0.5px solid #e5e7eb;">
					<div style="display:flex; align-items:center; gap:4px;">
						<span style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border-radius:50%; background:{shop.category?.color || '#6b7280'}; color:white; font-size:7px; font-weight:bold; flex-shrink:0;">{num}</span>
						<strong style="font-size:{baseFontSize + 0.5}px; color:{config.theme.text};">{shop.name}</strong>
					</div>
					{#if shop.address}
						<div style="color:#555; margin-left:18px; font-size:{baseFontSize - 1}px;">{shop.address}</div>
					{/if}
					{#if config.flyer.showPhoneNumbers && shop.phone}
						<div style="color:#333; margin-left:18px; font-size:{baseFontSize - 1}px;">{shop.phone}</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
