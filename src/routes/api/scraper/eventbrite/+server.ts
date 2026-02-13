import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import * as eventbriteService from '$lib/server/services/eventbrite';

const eventbriteScrapeSchema = z.object({
  inputUrl: z.string().min(1, 'inputUrl is required').max(2000),
  maxPages: z.number().int().min(1).max(20).default(3),
});

/**
 * GET /api/scraper/eventbrite
 * Get Eventbrite scraper status
 */
export const GET: RequestHandler = async () => {
  const status = eventbriteService.getStatus();
  return json(status);
};

/**
 * POST /api/scraper/eventbrite
 * Test Eventbrite scraper with a URL (event or search)
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const parsed = eventbriteScrapeSchema.safeParse(body);

    if (!parsed.success) {
      return json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { inputUrl, maxPages } = parsed.data;

    // Check if service is available
    if (!eventbriteService.isAvailable()) {
      return json(
        {
          error: 'Eventbrite scraper not configured',
          details: 'RAPIDAPI_KEY environment variable is not set',
        },
        { status: 503 }
      );
    }

    // Test the scraper
    const result = await eventbriteService.testScraper(inputUrl, maxPages);

    return json(result);
  } catch (error) {
    console.error('[API] Eventbrite scraper error:', error);
    return json(
      {
        error: 'Failed to test Eventbrite scraper',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};
