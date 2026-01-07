import { db } from '$lib/server/db';
import { users, userSessions } from '$lib/server/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { User, UserSession } from '$lib/server/db/schema';

const SESSION_EXPIRY_DAYS = 7;

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'admin' | 'moderator' | 'user';
  avatarUrl: string | null;
  isSeller: boolean;
  isBusinessOwner: boolean;
  isYfVendor: boolean;
  isYfStaff: boolean;
  isYfAssociate: boolean;
}

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  await db.insert(userSessions).values({
    id: token,
    userId,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    expiresAt,
    isActive: true,
  });

  return { token, expiresAt };
}

/**
 * Validate a session token and return the user if valid
 */
export async function validateSession(token: string): Promise<SessionUser | null> {
  if (!token) return null;

  const now = new Date();

  // Get session with user data
  const sessionResults = await db
    .select({
      session: userSessions,
      user: users,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      and(
        eq(userSessions.id, token),
        eq(userSessions.isActive, true),
        gt(userSessions.expiresAt, now)
      )
    )
    .limit(1);

  if (sessionResults.length === 0) return null;

  const { user } = sessionResults[0];

  // Check if user is active
  if (user.status !== 'active') return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role || 'user',
    avatarUrl: user.avatarUrl,
    isSeller: user.isSeller || false,
    isBusinessOwner: user.isBusinessOwner || false,
    isYfVendor: user.isYfVendor || false,
    isYfStaff: user.isYfStaff || false,
    isYfAssociate: user.isYfAssociate || false,
  };
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(token: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ isActive: false })
    .where(eq(userSessions.id, token));
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(userId: number): Promise<void> {
  await db
    .update(userSessions)
    .set({ isActive: false })
    .where(eq(userSessions.userId, userId));
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(userSessions)
    .set({ isActive: false })
    .where(
      and(
        eq(userSessions.isActive, true),
        lt(userSessions.expiresAt, now)
      )
    );

  return result[0]?.affectedRows || 0;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<User | null> {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return results[0] || null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return results[0] || null;
}

/**
 * Get user by Google ID
 */
export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleId))
    .limit(1);

  return results[0] || null;
}
