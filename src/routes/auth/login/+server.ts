import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import { compare } from 'bcryptjs';
import { createSession } from '$lib/server/auth/session';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { username, password } = await request.json();

  if (!username || !password) {
    return json({ error: 'Username and password are required' }, { status: 400 });
  }

  // Find user by username or email
  const result = await db
    .select()
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, username)))
    .limit(1);

  if (result.length === 0) {
    return json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const user = result[0];

  if (user.status !== 'active') {
    return json({ error: 'Account is disabled' }, { status: 403 });
  }

  // Check lockout
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return json({ error: 'Account temporarily locked. Try again later.' }, { status: 429 });
  }

  // PHP bcrypt uses $2y$ prefix, bcryptjs expects $2a$ — they're compatible, just swap
  const hash = user.passwordHash.replace(/^\$2y\$/, '$2a$');
  const valid = await compare(password, hash);

  if (!valid) {
    // Increment login attempts
    const attempts = (user.loginAttempts || 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db.update(users).set({
      loginAttempts: attempts,
      lockedUntil: lockUntil,
    }).where(eq(users.id, user.id));

    return json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Reset login attempts on success
  await db.update(users).set({
    loginAttempts: 0,
    lockedUntil: null,
    lastLogin: new Date(),
  }).where(eq(users.id, user.id));

  // Create session
  const session = await createSession(user.id);

  cookies.set('session', session.token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
};
