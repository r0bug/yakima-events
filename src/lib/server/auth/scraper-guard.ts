/**
 * Shared guard for the scraper / ingestion endpoints.
 *
 * A request is allowed when ANY of these holds:
 *   1. it carries an admin (or moderator) session cookie - the admin UI
 *   2. it carries the shared scraper secret, env `SCRAPER_SECRET`, as
 *        Authorization: Bearer <secret>      (cron, scripts, extension >= 1.4.0)
 *      or X-API-Key: <secret>                (the "API Key" field that every
 *                                             released extension already sends)
 *   3. LEGACY TRANSITION ONLY - the endpoint opted in with `allowLegacy` and env
 *      `SCRAPER_LEGACY_EXTENSION=1` is set. The request is then accepted with no
 *      credentials at all, flagged `mode: 'legacy'`, and the endpoint is expected
 *      to treat it as untrusted (strict validation, events land as `pending`).
 *      Turn the switch off once every extension copy has a key configured.
 *
 * The secret is compared in constant time. If `SCRAPER_SECRET` is unset or
 * shorter than 24 characters, the secret path is disabled (nothing matches).
 */

import { createHash, timingSafeEqual } from 'crypto';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isAdminUser } from '$lib/server/api-utils';

export type ScraperAuthMode = 'admin' | 'secret' | 'legacy';

export type ScraperAuthResult =
  | { ok: true; mode: ScraperAuthMode }
  | { ok: false; response: Response };

const MIN_SECRET_LENGTH = 24;

/** Constant-time string comparison (hash first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/** Pull the presented secret out of `Authorization: Bearer` or `X-API-Key`. */
export function presentedSecret(headers: Headers): string | null {
  const auth = headers.get('authorization');
  if (auth) {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(auth);
    if (m) return m[1];
  }
  const apiKey = headers.get('x-api-key');
  if (apiKey && apiKey.trim()) return apiKey.trim();
  return null;
}

export function secretMatches(presented: string | null, configured: string | undefined): boolean {
  if (!presented || !configured || configured.length < MIN_SECRET_LENGTH) return false;
  return safeEqual(presented, configured);
}

export function legacyExtensionEnabled(): boolean {
  const v = (env.SCRAPER_LEGACY_EXTENSION || '').trim().toLowerCase();
  return v === '1' || v === 'true';
}

/**
 * Authorize a scraper/ingestion request. Usage:
 *
 *   const auth = requireScraperAuth(event);
 *   if (!auth.ok) return auth.response;
 */
export function requireScraperAuth(
  event: Pick<RequestEvent, 'locals' | 'request'>,
  opts: { allowLegacy?: boolean } = {}
): ScraperAuthResult {
  if (isAdminUser(event.locals.user)) {
    return { ok: true, mode: 'admin' };
  }

  const presented = presentedSecret(event.request.headers);
  if (secretMatches(presented, env.SCRAPER_SECRET)) {
    return { ok: true, mode: 'secret' };
  }

  // A wrong key is always an error, even in legacy mode: silently downgrading
  // a mistyped key to "legacy" would hide the typo from the operator.
  if (!presented && opts.allowLegacy && legacyExtensionEnabled()) {
    return { ok: true, mode: 'legacy' };
  }

  return {
    ok: false,
    response: json(
      {
        success: false,
        error: presented
          ? 'Invalid API key. Check the API Key in the extension Config tab.'
          : 'Authentication required. Open the extension Config tab and paste the YFEvents API key (ask the site admin), or sign in as an admin.',
      },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="yfevents-scraper"' } }
    ),
  };
}

// ---------------------------------------------------------------------------
// Legacy (unauthenticated) throttle
// ---------------------------------------------------------------------------

const LEGACY_WINDOW_MS = 60 * 60 * 1000;
const LEGACY_MAX_REQUESTS = 40;
const LEGACY_MAX_EVENTS = 2000;
let legacyWindowStart = 0;
let legacyRequests = 0;
let legacyEvents = 0;

/**
 * Global (not per-IP: the client address is not trustworthy behind the proxy)
 * cap on what unauthenticated legacy posts may submit per hour. Returns false
 * when the budget is exhausted.
 */
export function consumeLegacyBudget(eventCount: number, now = Date.now()): boolean {
  if (now - legacyWindowStart > LEGACY_WINDOW_MS) {
    legacyWindowStart = now;
    legacyRequests = 0;
    legacyEvents = 0;
  }
  if (legacyRequests + 1 > LEGACY_MAX_REQUESTS || legacyEvents + eventCount > LEGACY_MAX_EVENTS) {
    return false;
  }
  legacyRequests += 1;
  legacyEvents += eventCount;
  return true;
}

/** Test hook */
export function _resetLegacyBudget(): void {
  legacyWindowStart = 0;
  legacyRequests = 0;
  legacyEvents = 0;
}
