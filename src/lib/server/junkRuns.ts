import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { applyConfigDefaults } from '$lib/types/junk-run';
import type { JunkRunConfig } from '$lib/types/junk-run';

const SITE_URL = 'https://yfevents.yakimafinds.com';

/**
 * Load a junk-run config by slug.
 * Admin-managed configs in data/junk-runs/ win; src/lib/config/junk-runs/ is the
 * legacy fallback. Returns null when the slug has no config.
 *
 * Shared by the public page, its OG card and anything else that needs the config,
 * so there is exactly one place that knows where these files live.
 */
export async function loadJunkRunConfig(slug: string): Promise<JunkRunConfig | null> {
	// Guard the slug before it reaches resolve() — never let a param walk the filesystem.
	if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) return null;

	try {
		const dataPath = resolve('data/junk-runs', `${slug}.json`);
		const legacyPath = resolve('src/lib/config/junk-runs', `${slug}.json`);
		const configPath = existsSync(dataPath) ? dataPath : legacyPath;
		const raw = await readFile(configPath, 'utf-8');
		return applyConfigDefaults(JSON.parse(raw));
	} catch {
		return null;
	}
}

/**
 * Everything a share surface needs for one junk run: canonical URL, OG card URL,
 * a human description, and ready-made network share links.
 */
export function junkRunShare(config: JunkRunConfig, shopCount: number) {
	const url = `${SITE_URL}/junk-run/${config.slug}`;
	const image = `${url}/og.png`;

	const bits = [config.tagline];
	if (config.venue?.label) bits.push(`${config.venue.name} — ${config.venue.label}`);
	if (shopCount > 0) bits.push(`${shopCount} stops mapped, with a printable flyer.`);

	const hashtag = `#${config.slug.replace(/[^a-z0-9]/gi, '')}JunkRun`;

	return {
		title: config.name,
		description: bits.filter(Boolean).join(' · '),
		url,
		image,
		hashtag,
		links: {
			facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
			twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(config.name)}`,
			email: `mailto:?subject=${encodeURIComponent(config.name)}&body=${encodeURIComponent(url)}`,
		},
	};
}
