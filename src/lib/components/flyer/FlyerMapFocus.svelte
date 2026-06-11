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
	const MAP_X = MARGIN;
	const MAP_Y = HEADER_H;
	const MAP_W = PAGE_W - MARGIN * 2;
	const MAP_H = 620;
	const LIST_Y = MAP_Y + MAP_H + 8;
	const LIST_H = PAGE_H - LIST_Y - FOOTER_H - 4;

	$: baseFontSize = getBaseFontSize(config.flyer.fontSize);
	$: listCols = getColumnCount(config.flyer.columnCount, shops.length, 'list');
	$: dirCols = getColumnCount(config.flyer.columnCount, shops.length, 'directory');
	$: categories = getUniqueCategories(shops);
	$: showLegend = config.flyer.showCategoryLegend && categories.length >= 2;

	// Route QR for page 2
	$: routeQrSvg = config.flyer.qrMode === 'route' ? (() => {
		const url = buildRouteQrUrl(shops);
		if (!url) return '';
		const qr = new QRCode({ content: url, padding: 0, width: 80, height: 80, ecl: 'L', join: true });
		return qr.svg();
	})() : '';

	// Individual QR codes
	$: individualQrs = config.flyer.qrMode === 'individual' ? new Map(
		shops.filter(s => s.latitude && s.longitude).map(s => [
			s.id,
			new QRCode({
				content: `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`,
				padding: 0, width: 48, height: 48, ecl: 'L', join: true,
			}).svg()
		])
	) : new Map();

	// Directory shops: split by maxShopsPerPage
	$: maxPerPage = config.flyer.maxShopsPerPage;
	$: needsPage2 = shops.length > 0;
</script>

<!-- Page 1: Map + Pill Grid -->
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

	<!-- Numbered pin markers overlay -->
	<svg style="position:absolute; top:0; left:0; width:{PAGE_W}px; height:{PAGE_H}px; pointer-events:none;" viewBox="0 0 {PAGE_W} {PAGE_H}">
		<defs>
			<filter id="pinShadowMF" x="-50%" y="-50%" width="200%" height="200%">
				<feDropShadow dx="0" dy="1.2" stdDeviation="1" flood-opacity="0.45" />
			</filter>
		</defs>
		{#each markerPositions as m}
			<path d={pinPath(MAP_X + m.x, MAP_Y + m.y)} fill={m.shop.category?.color || '#6b7280'} stroke="white" stroke-width="1.5" filter="url(#pinShadowMF)" />
			<text x={MAP_X + m.x} y={pinLabelY(MAP_Y + m.y) + 3.2} text-anchor="middle" fill="white" font-size="9.5" font-weight="bold" font-family="Arial, sans-serif">{m.num}</text>
		{/each}
	</svg>

	<!-- Compact pill grid (names only) -->
	<div style="position:absolute; left:{MARGIN}px; top:{LIST_Y}px; right:{MARGIN}px; height:{LIST_H}px; overflow:hidden;">
		{#if showLegend}
			<div style="display:flex; gap:12px; margin-bottom:5px; font-size:{baseFontSize - 2}px;">
				{#each categories as cat}
					<span style="display:flex; align-items:center; gap:3px; color:{cat.color || '#6b7280'};">
						<span style="width:6px; height:6px; border-radius:50%; background:{cat.color || '#6b7280'}; display:inline-block;"></span>
						{cat.name}
					</span>
				{/each}
			</div>
		{/if}
		<div style="column-count:{listCols}; column-gap:12px; font-size:{baseFontSize - 1}px; color:#333; line-height:1.35;">
			{#each shops as shop, i}
				<div style="break-inside:avoid; margin-bottom:3px; display:flex; align-items:baseline; gap:3px;">
					<span style="display:inline-flex; align-items:center; justify-content:center; min-width:13px; height:13px; border-radius:50%; background:{shop.category?.color || '#6b7280'}; color:white; font-size:6.5px; font-weight:bold; flex-shrink:0;">{i + 1}</span>
					<span style="font-weight:600;">{truncate(shop.name, 28)}</span>
					{#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
						<span style="color:#ef4444; font-size:{baseFontSize - 3}px; font-weight:bold;">SALE</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<FlyerFooter {config} height={FOOTER_H} />
</div>

<!-- Page 2: Clean Directory -->
{#if needsPage2}
	<div class="flyer-page" style="width:{PAGE_W}px; min-height:{PAGE_H}px; background:white; position:relative; margin:20px auto 0; padding:30px 40px; box-shadow:0 2px 20px rgba(0,0,0,0.1); page-break-before:always;">
		<div style="display:flex; align-items:flex-start; justify-content:space-between;">
			<div>
				<h2 style="font-family:'Playfair Display',Georgia,serif; font-size:18px; font-weight:900; color:{config.theme.text}; margin-bottom:4px;">
					{config.name} &mdash; {areaLabel} Directory
				</h2>
				<div style="height:2px; background:{config.theme.primary}; width:80px; margin-bottom:16px;"></div>
			</div>
			{#if routeQrSvg}
				<div style="text-align:center; flex-shrink:0; margin-left:16px;">
					<div style="width:80px; height:80px;">{@html routeQrSvg}</div>
					<div style="font-size:6px; color:#999; margin-top:2px;">Scan for route</div>
				</div>
			{/if}
		</div>

		<div style="column-count:{dirCols}; column-gap:20px; font-size:{baseFontSize}px; color:#333; line-height:1.5;">
			{#each shops as shop, i}
				<div style="break-inside:avoid; margin-bottom:8px; padding-bottom:6px; border-bottom:0.5px solid #e5e7eb;">
					<div style="display:flex; align-items:flex-start; gap:6px;">
						{#if config.flyer.qrMode === 'individual' && shop.latitude && shop.longitude && individualQrs.has(shop.id)}
							<div style="flex-shrink:0; width:48px; height:48px;">
								{@html individualQrs.get(shop.id)}
							</div>
						{/if}
						<div style="flex:1; min-width:0;">
							<div style="display:flex; align-items:center; gap:4px; margin-bottom:1px;">
								<span style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border-radius:50%; background:{shop.category?.color || '#6b7280'}; color:white; font-size:7px; font-weight:bold; flex-shrink:0;">{i + 1}</span>
								<strong style="font-size:{baseFontSize + 0.5}px; color:{config.theme.text};">{shop.name}</strong>
							</div>
							{#if shop.address}
								<div style="color:#555; margin-left:18px; font-size:{baseFontSize - 1}px;">{shop.address}</div>
							{/if}
							{#if config.flyer.showPhoneNumbers && shop.phone}
								<div style="color:#333; margin-left:18px; font-size:{baseFontSize - 1}px;">{shop.phone}</div>
							{/if}
							{#if config.flyer.showHours && getHoursText(shop.operatingHours)}
								<div style="color:#888; margin-left:18px; font-size:{baseFontSize - 1.5}px;">{getHoursText(shop.operatingHours)}</div>
							{/if}
							{#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
								<div style="color:#ef4444; margin-left:18px; font-size:{baseFontSize - 1.5}px; font-weight:bold;">SALE TODAY</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if config.flyer.qrMode === 'individual'}
			<p style="font-size:7px; color:#999; text-align:center; margin-top:8px;">Scan QR codes with your phone camera to open navigation</p>
		{:else if config.flyer.qrMode === 'route'}
			<p style="font-size:7px; color:#999; text-align:center; margin-top:8px;">Scan the QR code above to open a route to all shops in Google Maps</p>
		{/if}

		{#if showLegend}
			<div style="position:absolute; bottom:30px; left:40px; right:40px; display:flex; gap:16px; justify-content:center; font-size:8px;">
				{#each categories as cat}
					<div style="display:flex; align-items:center; gap:4px; color:{cat.color || '#6b7280'};">
						<span style="width:8px; height:8px; border-radius:50%; background:{cat.color || '#6b7280'}; display:inline-block;"></span>
						{cat.name}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
