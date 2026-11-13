import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMock = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock('$env/dynamic/private', () => ({ env: envMock }));
vi.mock('@sveltejs/kit', () => ({
  json: (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string>) },
    }),
}));

import {
  requireScraperAuth,
  presentedSecret,
  secretMatches,
  safeEqual,
  consumeLegacyBudget,
  _resetLegacyBudget,
} from './scraper-guard';

const SECRET = 'a'.repeat(20) + 'B1c2D3e4F5g6';

function ev(headers: Record<string, string> = {}, user: any = null) {
  return {
    locals: { user },
    request: new Request('http://localhost/api/scrape', { method: 'POST', headers }),
  } as any;
}

beforeEach(() => {
  for (const k of Object.keys(envMock)) delete envMock[k];
  _resetLegacyBudget();
});

describe('secret parsing and comparison', () => {
  it('reads Bearer and X-API-Key', () => {
    expect(presentedSecret(new Headers({ authorization: `Bearer ${SECRET}` }))).toBe(SECRET);
    expect(presentedSecret(new Headers({ authorization: `bearer   ${SECRET} ` }))).toBe(SECRET);
    expect(presentedSecret(new Headers({ 'x-api-key': ` ${SECRET} ` }))).toBe(SECRET);
    expect(presentedSecret(new Headers({ authorization: 'Basic abc' }))).toBeNull();
    expect(presentedSecret(new Headers())).toBeNull();
  });

  it('never matches an unset or weak configured secret', () => {
    expect(secretMatches('', '')).toBe(false);
    expect(secretMatches('short', 'short')).toBe(false);
    expect(secretMatches(null, SECRET)).toBe(false);
    expect(secretMatches(SECRET, undefined)).toBe(false);
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches(SECRET + 'x', SECRET)).toBe(false);
  });

  it('safeEqual handles different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('requireScraperAuth', () => {
  it('rejects anonymous requests', async () => {
    envMock.SCRAPER_SECRET = SECRET;
    const r = requireScraperAuth(ev());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('rejects everything when no secret is configured and there is no session', () => {
    expect(requireScraperAuth(ev({ authorization: 'Bearer ' })).ok).toBe(false);
    expect(requireScraperAuth(ev({ authorization: 'Bearer undefined' })).ok).toBe(false);
    expect(requireScraperAuth(ev({ 'x-api-key': '' })).ok).toBe(false);
  });

  it('accepts the secret via either header', () => {
    envMock.SCRAPER_SECRET = SECRET;
    expect(requireScraperAuth(ev({ authorization: `Bearer ${SECRET}` }))).toEqual({ ok: true, mode: 'secret' });
    expect(requireScraperAuth(ev({ 'x-api-key': SECRET }))).toEqual({ ok: true, mode: 'secret' });
    expect(requireScraperAuth(ev({ authorization: `Bearer ${SECRET}x` })).ok).toBe(false);
  });

  it('accepts admin and moderator sessions only', () => {
    expect(requireScraperAuth(ev({}, { id: 1, role: 'admin' }))).toEqual({ ok: true, mode: 'admin' });
    expect(requireScraperAuth(ev({}, { id: 2, role: 'moderator' }))).toEqual({ ok: true, mode: 'admin' });
    expect(requireScraperAuth(ev({}, { id: 3, role: 'user' })).ok).toBe(false);
  });

  it('legacy mode needs both the env switch and the endpoint opt-in', () => {
    expect(requireScraperAuth(ev(), { allowLegacy: true }).ok).toBe(false);
    envMock.SCRAPER_LEGACY_EXTENSION = '1';
    expect(requireScraperAuth(ev()).ok).toBe(false);
    expect(requireScraperAuth(ev(), { allowLegacy: true })).toEqual({ ok: true, mode: 'legacy' });
    envMock.SCRAPER_LEGACY_EXTENSION = '0';
    expect(requireScraperAuth(ev(), { allowLegacy: true }).ok).toBe(false);
  });

  it('a wrong key is rejected even in legacy mode', () => {
    envMock.SCRAPER_SECRET = SECRET;
    envMock.SCRAPER_LEGACY_EXTENSION = '1';
    expect(requireScraperAuth(ev({ 'x-api-key': 'nope' }), { allowLegacy: true }).ok).toBe(false);
    expect(requireScraperAuth(ev({ 'x-api-key': SECRET }), { allowLegacy: true })).toEqual({ ok: true, mode: 'secret' });
  });
});

describe('legacy budget', () => {
  it('caps requests and events per window, then resets', () => {
    const t0 = 1_000_000;
    expect(consumeLegacyBudget(1500, t0)).toBe(true);
    expect(consumeLegacyBudget(600, t0 + 1)).toBe(false);
    expect(consumeLegacyBudget(500, t0 + 2)).toBe(true);
    expect(consumeLegacyBudget(1, t0 + 3)).toBe(false);
    expect(consumeLegacyBudget(1, t0 + 61 * 60 * 1000)).toBe(true);
  });
});
