export interface JunkRunTheme {
	primary: string;
	accent: string;
	background: string;
	text: string;
	headerBg: string;
	headerText: string;
}

export type FlyerTemplate =
	| 'map-focus'
	| 'directory-focus'
	| 'postcard'
	| 'vintage-guide'
	| 'gazette';
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

export interface JunkRunNotice {
	title: string;
	image: string;
	href?: string | null;
	caption?: string | null;
}

/** One boxed item in the Gazette's right-hand rail (page 2). */
export interface JunkRunGazetteBox {
	title: string;
	body: string;
	qrUrl?: string | null;
	qrCaption?: string | null;
}

/** Editorial content for the landscape newspaper ('gazette') flyer template. */
export interface JunkRunGazette {
	/** Masthead kicker, e.g. "Vintiques Weekend Edition". Defaults to the run name. */
	editionLabel?: string | null;
	/** Opening paragraph. A sensible one is generated from the data when absent. */
	lede?: string | null;
	/** Shop id to feature as "home base" in the rail. */
	homeBaseShopId?: number | null;
	/** Extra rail boxes: credits, classifieds, promos. */
	railBoxes?: JunkRunGazetteBox[];
}

export interface JunkRunVenue {
	name: string;
	lat: number;
	lng: number;
	label?: string | null;
	url?: string | null;
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
	notice?: JunkRunNotice | null;
	venue?: JunkRunVenue | null;
	gazette?: JunkRunGazette | null;
	/** Absolute-from-root image used as og:image instead of the generated card. */
	shareImage?: string | null;
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
		notice: raw.notice ?? null,
		venue: raw.venue ?? null,
		gazette: raw.gazette ?? null,
		shareImage: raw.shareImage ?? null,
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
