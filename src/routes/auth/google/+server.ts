/**
 * Google OAuth - Initiate Login
 * GET /auth/google
 *
 * Redirects user to Google's OAuth consent screen
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateStateToken, getAuthorizationUrl, isGoogleOAuthConfigured } from '$lib/server/auth/google';

export const GET: RequestHandler = async ({ url, cookies }) => {
  // Check if Google OAuth is configured
  if (!isGoogleOAuthConfigured()) {
    return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get optional redirect URL from query params
  const redirectTo = url.searchParams.get('redirect') || '/';

  // Generate CSRF state token
  const state = generateStateToken(redirectTo);

  // Store state in cookie for validation
  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  });

  // Redirect to Google
  const authUrl = getAuthorizationUrl(state);
  throw redirect(302, authUrl);
};
