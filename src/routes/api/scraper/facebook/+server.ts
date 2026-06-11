import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/api-utils';
import * as facebookService from '$lib/server/services/facebook';

const facebookScrapeSchema = z.object({
  eventUrl: z.string().min(1, 'eventUrl is required').max(2000),
});

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
 * Test Facebook scraper with an event URL or ID
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const authError = requireAdmin(locals);
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = facebookScrapeSchema.safeParse(body);

    if (!parsed.success) {
      return json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { eventUrl } = parsed.data;

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
    const result = await facebookService.testScraper(eventUrl);

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
