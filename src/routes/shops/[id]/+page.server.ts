import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getShopById } from '$lib/server/services/shops';
import { db } from '$lib/server/db';
import { shopImages } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		error(404, 'Shop not found');
	}

	const shop = await getShopById(id);
	if (!shop) {
		error(404, 'Shop not found');
	}

	// Fetch shop images (table may not exist yet)
	let images: { id: number; filename: string; altText: string | null }[] = [];
	try {
		images = await db
			.select({ id: shopImages.id, filename: shopImages.filename, altText: shopImages.altText })
			.from(shopImages)
			.where(eq(shopImages.shopId, id));
	} catch {
		// shop_images table may not exist yet - continue without images
	}

	const siteUrl = 'https://yfevents.yakimafinds.com';
	const shopUrl = `${siteUrl}/shops/${id}`;
	const description = shop.description
		? shop.description.substring(0, 200).replace(/\n/g, ' ')
		: `${shop.name} - Local shop in Yakima, WA`;

	const primaryImage = shop.primaryImageUrl || shop.imageUrl;

	return {
		shop: {
			...shop,
			images,
			isVenuePlaceholder: (shop as any).isVenuePlaceholder || false,
			venueSourceCount: (shop as any).venueSourceCount || 0,
		},
		seo: {
			title: shop.name,
			description,
			url: shopUrl,
			image: primaryImage ? `${siteUrl}/uploads/${primaryImage}` : `${siteUrl}/og-default.png`,
			address: shop.address || 'Yakima, WA',
		},
	};
};
