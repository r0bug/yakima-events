import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { Resvg } from '@resvg/resvg-js';
import { db } from '$lib/server/db';
import { localShops, shopCategories } from '$lib/server/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { loadJunkRunConfig } from '$lib/server/junkRuns';

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	// drop any dangling separator so we never render "Sept 18–20 ·…"
	return s.slice(0, max - 1).replace(/[\s·•—–-]+$/, '') + '…';
}

/**
 * GET /junk-run/[slug]/og.png
 * 1200x630 Open Graph card for a junk run, themed from its own config so every
 * run gets a branded share image without extra work.
 */
export const GET: RequestHandler = async ({ params }) => {
	const config = await loadJunkRunConfig(params.slug);
	if (!config) {
		error(404, 'Not found');
	}

	// Same shop set the page maps: active, in-scope categories, geocoded, not excluded.
	let shopCount = 0;
	if (config.defaultTags.length > 0) {
		const categories = await db
			.select({ id: shopCategories.id })
			.from(shopCategories)
			.where(and(eq(shopCategories.active, true), inArray(shopCategories.slug, config.defaultTags)));

		const categoryIds = categories.map((c) => c.id);
		if (categoryIds.length > 0) {
			const [row] = await db
				.select({ n: sql<number>`COUNT(*)` })
				.from(localShops)
				.where(
					and(
						eq(localShops.active, true),
						inArray(localShops.categoryId, categoryIds),
						sql`${localShops.latitude} IS NOT NULL`,
						sql`${localShops.longitude} IS NOT NULL`,
						config.excludedShopIds.length > 0
							? sql`${localShops.id} NOT IN (${sql.join(
									config.excludedShopIds.map((id) => sql`${id}`),
									sql`, `
								)})`
							: undefined
					)
				);
			shopCount = Number(row?.n ?? 0);
		}
	}

	const theme = config.theme;
	const name = escapeXml(truncate(config.name, 34));
	const tagline = escapeXml(truncate(config.tagline, 62));

	// Headline detail: the venue/date line if this run is pegged to an event,
	// otherwise the notice banner's title.
	const detail = config.venue?.label
		? `${config.venue.name} · ${config.venue.label}`
		: config.notice?.title || '';
	const detailSvg = detail
		? `<text x="80" y="372" font-family="DejaVu Sans" font-weight="bold" font-size="32" fill="${theme.primary}">${escapeXml(truncate(detail, 44))}</text>`
		: '';

	const countSvg =
		shopCount > 0
			? `<text x="80" y="448" font-family="DejaVu Sans" font-size="30" fill="${theme.text}" fill-opacity="0.72">${shopCount} stops mapped · printable flyer · free to use</text>`
			: '';

	const hashtag = escapeXml(`#${config.slug.replace(/[^a-z0-9]/gi, '')}JunkRun`);

	const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
	<rect width="${WIDTH}" height="${HEIGHT}" fill="${theme.background}"/>
	<rect width="${WIDTH}" height="196" fill="${theme.headerBg}"/>
	<rect y="196" width="${WIDTH}" height="8" fill="${theme.primary}"/>
	<rect y="204" width="${WIDTH}" height="3" fill="${theme.accent}"/>
	<text x="80" y="78" font-family="DejaVu Sans" font-weight="bold" font-size="26" fill="${theme.accent}" letter-spacing="4">YAKIMA FINDS · JUNK RUN</text>
	<text x="80" y="152" font-family="DejaVu Sans" font-weight="bold" font-size="58" fill="${theme.headerText}">${name}</text>
	<text x="80" y="286" font-family="DejaVu Sans" font-size="34" fill="${theme.text}" fill-opacity="0.85">${tagline}</text>
	${detailSvg}
	${countSvg}
	<rect y="${HEIGHT - 76}" width="${WIDTH}" height="76" fill="${theme.text}"/>
	<text x="80" y="${HEIGHT - 28}" font-family="DejaVu Sans" font-weight="bold" font-size="26" fill="${theme.accent}">yfevents.yakimafinds.com</text>
	<text x="${WIDTH - 80}" y="${HEIGHT - 28}" text-anchor="end" font-family="DejaVu Sans" font-size="24" fill="${theme.background}">${hashtag}</text>
</svg>`;

	const png = new Resvg(svg, {
		fitTo: { mode: 'width', value: WIDTH },
		font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
	})
		.render()
		.asPng();

	return new Response(new Uint8Array(png), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=1800',
		},
	});
};
