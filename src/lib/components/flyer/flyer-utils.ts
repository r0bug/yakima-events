import type { FlyerShop, FlyerDisplayOptions } from '$lib/types/junk-run';
import { REGION_LABELS, REGION_ORDER } from '../../utils/geo';

export function getBounds(shops: FlyerShop[]): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
	let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
	for (const s of shops) {
		if (s.latitude! < minLat) minLat = s.latitude!;
		if (s.latitude! > maxLat) maxLat = s.latitude!;
		if (s.longitude! < minLng) minLng = s.longitude!;
		if (s.longitude! > maxLng) maxLng = s.longitude!;
	}
	const latPad = (maxLat - minLat) * 0.1 || 0.01;
	const lngPad = (maxLng - minLng) * 0.1 || 0.01;
	return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLng: minLng - lngPad, maxLng: maxLng + lngPad };
}

export interface MarkerPosition {
	shop: FlyerShop;
	num: number;
	/** Pixel position relative to the map image's top-left corner */
	x: number;
	y: number;
}

/**
 * SVG path for a map pin whose tip is exactly at (x, y).
 * The numbered head is a circle of radius r centered above the tip.
 */
export function pinPath(x: number, y: number, r = 9): string {
	const cy = y - r - 6;
	return [
		`M ${x} ${y}`,
		`C ${x - r * 0.62} ${y - 5.5} ${x - r} ${cy + r * 0.65} ${x - r} ${cy}`,
		`A ${r} ${r} 0 1 1 ${x + r} ${cy}`,
		`C ${x + r} ${cy + r * 0.65} ${x + r * 0.62} ${y - 5.5} ${x} ${y}`,
		'Z',
	].join(' ');
}

/** Vertical center of the pin head, for placing the number */
export function pinLabelY(y: number, r = 9): number {
	return y - r - 6;
}

export function getHoursText(hours: any): string {
	if (!hours) return '';
	if (typeof hours === 'string') {
		try { hours = JSON.parse(hours); } catch { return hours; }
	}
	return hours.description || '';
}

export function truncate(str: string, max: number): string {
	return str.length > max ? str.substring(0, max - 1) + '\u2026' : str;
}

export function getBaseFontSize(fontSize: FlyerDisplayOptions['fontSize']): number {
	switch (fontSize) {
		case 'compact': return 7.5;
		case 'large': return 10;
		default: return 9;
	}
}

export function getColumnCount(columnCount: FlyerDisplayOptions['columnCount'], shopCount: number, forPage: 'list' | 'directory'): number {
	if (columnCount !== 'auto') return columnCount;
	if (forPage === 'list') return shopCount > 20 ? 4 : 3;
	return shopCount > 16 ? 3 : 2;
}

export function buildRouteQrUrl(shops: FlyerShop[]): string {
	const withCoords = shops.filter(s => s.latitude && s.longitude);
	if (withCoords.length === 0) return '';
	// Google Maps multi-stop URL
	const waypoints = withCoords.map(s => `${s.latitude},${s.longitude}`).join('/');
	return `https://www.google.com/maps/dir/${waypoints}`;
}

export function getUniqueCategories(shops: FlyerShop[]): { name: string; color: string | null; slug: string }[] {
	const map = new Map<string, { name: string; color: string | null; slug: string }>();
	for (const s of shops) {
		if (s.category && !map.has(s.category.slug)) {
			map.set(s.category.slug, s.category);
		}
	}
	return [...map.values()];
}

export function groupShopsByRegion(
	shops: FlyerShop[],
): { region: string; label: string; shops: FlyerShop[] }[] {
	const groups = new Map<string, FlyerShop[]>();
	for (const s of shops) {
		const r = s.region || 'yakima';
		if (!groups.has(r)) groups.set(r, []);
		groups.get(r)!.push(s);
	}
	const ordered: { region: string; label: string; shops: FlyerShop[] }[] = [];
	for (const r of REGION_ORDER) {
		if (groups.has(r)) {
			ordered.push({ region: r, label: REGION_LABELS[r] ?? r, shops: groups.get(r)! });
			groups.delete(r);
		}
	}
	for (const r of [...groups.keys()].sort()) {
		ordered.push({ region: r, label: REGION_LABELS[r] ?? r, shops: groups.get(r)! });
	}
	return ordered;
}
