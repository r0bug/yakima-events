import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SETTINGS_DIR = path.resolve('data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'site-settings.json');

interface SiteSettings {
	showUnapprovedEvents: boolean;
	disclaimerText: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
	showUnapprovedEvents: false,
	disclaimerText: '',
};

async function loadSettings(): Promise<SiteSettings> {
	try {
		const data = await readFile(SETTINGS_FILE, 'utf-8');
		return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
	} catch {
		return DEFAULT_SETTINGS;
	}
}

async function saveSettings(settings: SiteSettings): Promise<void> {
	if (!existsSync(SETTINGS_DIR)) {
		await mkdir(SETTINGS_DIR, { recursive: true });
	}
	await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login?return=/admin/settings');
	}
	const settings = await loadSettings();
	return { user: locals.user, settings };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const settings: SiteSettings = {
			showUnapprovedEvents: formData.get('showUnapprovedEvents') === 'on',
			disclaimerText: (formData.get('disclaimerText') as string) || '',
		};

		await saveSettings(settings);
		return { success: true, settings };
	},
};
