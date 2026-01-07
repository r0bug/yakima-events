import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeSourceById } from '$server/scrapers/scraper';

/**
 * POST /api/scrape/[id]
 * Scrape a specific source by ID
 */
export const POST: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ success: false, error: 'Invalid source ID' }, { status: 400 });
    }

    const result = await scrapeSourceById(id);

    return json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error('Error scraping source:', error);
    return json(
      { success: false, error: 'Failed to scrape source' },
      { status: 500 }
    );
  }
};
