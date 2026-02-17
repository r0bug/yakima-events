import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'moderator')) {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) {
		return json({ error: 'URL parameter required' }, { status: 400 });
	}

	const start = performance.now();
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);

		const response = await fetch(targetUrl, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'follow',
		});

		clearTimeout(timeout);
		const responseTime = performance.now() - start;

		return json({
			status: response.status,
			responseTime: Math.round(responseTime),
			error: null,
		});
	} catch (e) {
		const responseTime = performance.now() - start;
		return json({
			status: null,
			responseTime: Math.round(responseTime),
			error: e instanceof Error ? e.message : 'Request failed',
		});
	}
};
