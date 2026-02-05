import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as facebookService from '$lib/server/services/facebook';

/**
 * GET /api/scraper/facebook
 * Get Facebook scraper status
 */
export const GET: RequestHandler = async () => {
  const status = facebookService.getStatus();
  return json(status);
};

/**
 * POST /api/scraper/facebook
 * Test Facebook scraper with a page URL
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { pageUrl } = body;

    if (!pageUrl) {
      return json({ error: 'pageUrl is required' }, { status: 400 });
    }

    // Check if service is available
    if (!facebookService.isAvailable()) {
      return json(
        {
          error: 'Facebook scraper not configured',
          details: 'RAPIDAPI_KEY environment variable is not set',
        },
        { status: 503 }
      );
    }

    // Test the scraper
    const result = await facebookService.testScraper(pageUrl);

    return json(result);
  } catch (error) {
    console.error('[API] Facebook scraper error:', error);
    return json(
      {
        error: 'Failed to test Facebook scraper',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};
