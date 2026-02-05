/**
 * Admin Claims API
 * GET - Get all claims (with optional status filter)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllClaims } from '$lib/server/services/shopClaim';

// TODO: Add proper admin role check when user roles are fully implemented
async function isAdmin(user: { id: number } | null): Promise<boolean> {
  // For now, allow authenticated users to view claims
  // In production, check user.isAdmin or similar
  return user !== null;
}

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await isAdmin(locals.user);
  if (!admin) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const status = url.searchParams.get('status') || undefined;
    const claims = await getAllClaims(status);

    return json({
      success: true,
      claims,
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    return json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
};
