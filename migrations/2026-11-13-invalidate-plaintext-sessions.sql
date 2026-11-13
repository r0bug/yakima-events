-- Session tokens are now stored as SHA-256 digests (src/lib/server/auth/session.ts).
--
-- NO SCHEMA CHANGE IS NEEDED: the 64-char hex digest lives in the existing
-- user_sessions.id column (varchar 128).
--
-- This file is OPTIONAL hygiene. Rows written before the change hold raw
-- tokens. They can no longer authenticate anyone (the app only ever looks up
-- SHA-256(cookie)), but there is no reason to keep old raw tokens lying around.
--
-- Run it once, right AFTER the new build is live. It is safe to re-run: the
-- statements are idempotent, and the only side effect of running it later is
-- that people who signed in since the deploy are asked to sign in again.
--
--   mysql yakima_finds < migrations/2026-11-13-invalidate-plaintext-sessions.sql

-- 1. Nothing issued before now may be used again.
UPDATE user_sessions
   SET is_active = 0
 WHERE is_active = 1
   AND created_at <= NOW();

-- 2. Drop sessions that are dead anyway (expired or revoked), raw tokens included.
DELETE FROM user_sessions
 WHERE is_active = 0
    OR expires_at < NOW();
