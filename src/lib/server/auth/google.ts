/**
 * Google OAuth Service
 * Handles Google OAuth authentication flow
 */

import { env } from '$env/dynamic/private';
import { randomBytes } from 'crypto';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createSession } from './session';

import type { User } from '$lib/server/db/schema';

// Get env vars with fallbacks for development
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || '';
const PUBLIC_APP_URL = env.PUBLIC_APP_URL || 'http://localhost:5173';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// State tokens expire after 10 minutes
const STATE_EXPIRY_MS = 10 * 60 * 1000;

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  sub: string; // Google's unique user ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Generate a secure state token for CSRF protection
 * Encodes the redirect URL and timestamp directly in the token
 */
export function generateStateToken(redirectTo?: string): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  const redirect = redirectTo ? Buffer.from(redirectTo).toString('base64url') : '';

  // Format: nonce.timestamp.redirect
  return `${nonce}.${timestamp}.${redirect}`;
}

/**
 * Validate a state token and return associated data
 */
export function validateStateToken(token: string): { valid: boolean; redirectTo?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false };
    }

    const [nonce, timestamp, redirect] = parts;

    // Validate nonce format (32 hex chars)
    if (!/^[a-f0-9]{32}$/.test(nonce)) {
      return { valid: false };
    }

    // Check expiration
    const createdAt = parseInt(timestamp, 36);
    if (isNaN(createdAt) || Date.now() - createdAt > STATE_EXPIRY_MS) {
      return { valid: false };
    }

    // Decode redirect URL
    let redirectTo: string | undefined;
    if (redirect) {
      try {
        redirectTo = Buffer.from(redirect, 'base64url').toString('utf8');
      } catch {
        // Invalid base64, ignore redirect
      }
    }

    return { valid: true, redirectTo };
  } catch {
    return { valid: false };
  }
}

/**
 * Get the redirect URI for OAuth callback
 */
export function getRedirectUri(): string {
  return `${PUBLIC_APP_URL}/auth/google/callback`;
}

/**
 * Generate Google OAuth authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Get user info from Google using access token
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info from Google');
  }

  return response.json();
}

/**
 * Find or create a user from Google OAuth data
 */
export async function findOrCreateGoogleUser(googleUser: GoogleUserInfo): Promise<User> {
  // First, try to find by Google ID
  const existingByGoogleId = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleUser.sub))
    .limit(1);

  if (existingByGoogleId.length > 0) {
    // Update avatar URL if changed
    if (googleUser.picture && existingByGoogleId[0].avatarUrl !== googleUser.picture) {
      await db
        .update(users)
        .set({ avatarUrl: googleUser.picture, updatedAt: new Date() })
        .where(eq(users.id, existingByGoogleId[0].id));
    }
    return existingByGoogleId[0];
  }

  // Check if user with this email exists (link accounts)
  const existingByEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, googleUser.email))
    .limit(1);

  if (existingByEmail.length > 0) {
    // Link Google account to existing user
    await db
      .update(users)
      .set({
        googleId: googleUser.sub,
        avatarUrl: googleUser.picture || existingByEmail[0].avatarUrl,
        emailVerified: true, // Google verified the email
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail[0].id));

    // Return updated user
    const updated = await db
      .select()
      .from(users)
      .where(eq(users.id, existingByEmail[0].id))
      .limit(1);

    return updated[0];
  }

  // Create new user
  const username = googleUser.email.split('@')[0] + '_' + randomBytes(4).toString('hex');

  const result = await db.insert(users).values({
    username,
    email: googleUser.email,
    firstName: googleUser.given_name || null,
    lastName: googleUser.family_name || null,
    googleId: googleUser.sub,
    avatarUrl: googleUser.picture || null,
    authProvider: 'google',
    emailVerified: true,
    status: 'active',
    role: 'user',
  });

  const newUserId = result[0].insertId;

  const newUser = await db
    .select()
    .from(users)
    .where(eq(users.id, newUserId))
    .limit(1);

  return newUser[0];
}

/**
 * Complete the OAuth flow: exchange code, get user info, create session
 */
export async function completeOAuthFlow(
  code: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: User; sessionToken: string; expiresAt: Date }> {
  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);

  // Get user info
  const googleUser = await getUserInfo(tokens.access_token);

  // Verify email is verified
  if (!googleUser.email_verified) {
    throw new Error('Email not verified with Google');
  }

  // Find or create user
  const user = await findOrCreateGoogleUser(googleUser);

  // Check if user is banned
  if (user.status === 'banned') {
    throw new Error('This account has been banned');
  }

  // Create session
  const { token, expiresAt } = await createSession(user.id, ipAddress, userAgent);

  // Update last login
  await db
    .update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id));

  return { user, sessionToken: token, expiresAt };
}

/**
 * Check if Google OAuth is configured
 */
export function isGoogleOAuthConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
