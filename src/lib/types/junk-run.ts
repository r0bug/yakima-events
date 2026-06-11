export interface JunkRunTheme {
	primary: string;
	accent: string;
	background: string;
	text: string;
	headerBg: string;
	headerText: string;
}

export type FlyerTemplate = 'map-focus' | 'directory-focus' | 'postcard';
export type QrMode = 'none' | 'route' | 'individual';
export type FontSize = 'compact' | 'normal' | 'large';
export type ColumnCount = 2 | 3 | 4 | 'auto';

export interface FlyerDisplayOptions {
	template: FlyerTemplate;
	showPhoneNumbers: boolean;
	showHours: boolean;
	qrMode: QrMode;
	showSaleBadges: boolean;
	showCategoryLegend: boolean;
	maxShopsPerPage: number;
	fontSize: FontSize;
	columnCount: ColumnCount;
}

export interface FlyerCustomContent {
	sponsorLogoUrl: string | null;
	sponsorLogoPlacement: 'header' | 'footer' | 'none';
	announcementText: string;
}

export interface JunkRunConfig {
	slug: string;
	name: string;
	tagline: string;
	headerHtml: string;
	footerHtml: string;
	logo: string | null;
	theme: JunkRunTheme;
	mapCenter: [number, number];
	mapZoom: number;
	defaultTags: string[];
	showSalesToday: boolean;
	flyer: FlyerDisplayOptions;
	excludedShopIds: number[];
	customContent: FlyerCustomContent;
}

export const DEFAULT_FLYER_OPTIONS: FlyerDisplayOptions = {
	template: 'map-focus',
	showPhoneNumbers: true,
	showHours: false,
	qrMode: 'route',
	showSaleBadges: true,
	showCategoryLegend: true,
	maxShopsPerPage: 15,
	fontSize: 'normal',
	columnCount: 'auto',
};

export const DEFAULT_CUSTOM_CONTENT: FlyerCustomContent = {
	sponsorLogoUrl: null,
	sponsorLogoPlacement: 'none',
	announcementText: '',
};

export function applyConfigDefaults(raw: Partial<JunkRunConfig>): JunkRunConfig {
	return {
		slug: raw.slug || '',
		name: raw.name || '',
		tagline: raw.tagline || '',
		headerHtml: raw.headerHtml || '',
		footerHtml: raw.footerHtml || '',
		logo: raw.logo ?? null,
		theme: {
			primary: '#b7410e',
			accent: '#c8a951',
			background: '#faf6f0',
			text: '#1a1a1a',
			headerBg: '#1a1a1a',
			headerText: '#faf6f0',
			...raw.theme,
		},
		mapCenter: raw.mapCenter || [46.585, -120.49],
		mapZoom: raw.mapZoom ?? 11,
		defaultTags: raw.defaultTags || [],
		showSalesToday: raw.showSalesToday ?? true,
		flyer: { ...DEFAULT_FLYER_OPTIONS, ...raw.flyer },
		excludedShopIds: raw.excludedShopIds || [],
		customContent: { ...DEFAULT_CUSTOM_CONTENT, ...raw.customContent },
	};
}

export interface FlyerShop {
	id: number;
	name: string;
	address: string | null;
	phone: string | null;
	latitude: number | null;
	longitude: number | null;
	operatingHours: any;
	description: string | null;
	category?: { name: string; color: string | null; slug: string };
	region: string;
}
