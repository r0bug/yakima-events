import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { testSource } from '$server/services/sources';
import { requireScraperAuth } from '$lib/server/auth/scraper-guard';

/**
 * POST /api/sources/[id]/test
 * Test a source connection and format
 */
export const POST: RequestHandler = async (event) => {
  // Makes the server fetch the source URL: admin session or scraper secret only
  const auth = requireScraperAuth(event);
  if (!auth.ok) return auth.response;
  const { params } = event;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ success: false, error: 'Invalid source ID' }, { status: 400 });
    }

    const result = await testSource(id);

    return json({
      ...result,
    });
  } catch (error) {
    console.error('Error testing source:', error);
    return json(
      { success: false, message: 'Failed to test source' },
      { status: 500 }
    );
  }
};
