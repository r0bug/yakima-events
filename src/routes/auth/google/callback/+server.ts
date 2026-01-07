/**
 * Google OAuth - Callback Handler
 * GET /auth/google/callback
 *
 * Handles the OAuth callback from Google, exchanges code for tokens,
 * creates/updates user, and establishes session
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateStateToken, completeOAuthFlow

 } from '$lib/server/auth/google';

export const GET: RequestHandler = async ({ url, cookies, request }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('[OAuth] Google returned error:', error);
    throw redirect(302, '/login?error=oauth_denied');
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('[OAuth] Missing code or state');
    throw redirect(302, '/login?error=invalid_request');
  }

  // Validate state token (CSRF protection)
  const storedState = cookies.get('oauth_state');
  if (!storedState || storedState !== state) {
    console.error('[OAuth] State mismatch');
    throw redirect(302, '/login?error=invalid_state');
  }

  // Validate state token and get redirect URL
  const stateResult = validateStateToken(state);
  if (!stateResult.valid) {
    console.error('[OAuth] State token invalid or expired');
    throw redirect(302, '/login?error=expired_state');
  }

  // Clear the state cookie
  cookies.delete('oauth_state', { path: '/' });

  try {
    // Get client info for session
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Complete OAuth flow
    const { user, sessionToken, expiresAt } = await completeOAuthFlow(
      code,
      ipAddress,
      userAgent
    );

    // Set session cookie
    cookies.set('session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      expires: expiresAt
    });

    console.log(`[OAuth] User ${user.email} logged in successfully`);

    // Redirect to original destination or home
    const redirectTo = stateResult.redirectTo || '/';
    throw redirect(302, redirectTo);

  } catch (err) {
    console.error('[OAuth] Error completing OAuth flow:', err);

    // Check for specific error types
    if (err instanceof Error) {
      if (err.message.includes('banned')) {
        throw redirect(302, '/login?error=account_banned');
      }
      if (err.message.includes('not verified')) {
        throw redirect(302, '/login?error=email_not_verified');
      }
    }

    throw redirect(302, '/login?error=oauth_failed');
  }
};
