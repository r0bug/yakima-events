# YFEvents Engineering TODOs

Generated from `/plan-eng-review` on 2026-03-31.
Codebase: `/home/robug/yakima/` (SvelteKit, live at yfevents.yakimafinds.com)

## DONE #1: Fix Timezone Handling in Event Queries
**Status:** Complete
**Files changed:**
- `src/lib/server/datetime.ts` (new) — `toPacificDatetime()`, `pacificToday()`, `toPacificDate()`
- `src/lib/server/services/events.ts` — `getEvents()`, `getTodaysEvents()`, `findDuplicates()`, `getNearbyEvents()`
- `src/routes/+page.server.ts` — homepage event counts
- `src/routes/feed/rss/+server.ts`, `src/routes/feed/+server.ts` — feed date ranges
- `src/routes/junk-run/[slug]/+page.server.ts` — "today's sales"

All `toISOString()` calls in DB query contexts replaced with `toPacificDatetime()` using `Intl.DateTimeFormat` with `America/Los_Angeles`. Handles DST automatically.

**Known remaining issue:** DB connection `timezone: '-08:00'` is hardcoded PST, off by 1hr during PDT. Affects Date object writes only (not string queries). Low priority since most writes go through scrapers that pass strings.

## DONE #2: Install Vitest and Write Core Service Tests
**Status:** Complete — 31 tests passing
**Files changed:**
- `package.json` — added vitest, `test`/`test:watch` scripts
- `vite.config.ts` — added test config with path aliases
- `src/lib/server/datetime.test.ts` — 9 tests (Pacific conversion, DST boundaries)
- `src/lib/server/services/events.test.ts` — 7 tests (date filter logic, Haversine math)
- `src/lib/server/services/venueExtract.test.ts` — 9 tests (venue name extraction)
- `src/lib/server/services/tonight.test.ts` — 6 tests (tonight boundary computation)

Run: `npm test`

## DONE #3: Venue Auto-Discovery Pipeline
**Status:** Already implemented — no work needed
**Discovery:** `venueExtract.ts` and `shopMatch.ts` are already wired into `scraper.ts:418-437`. Every event processed through `processEvent()` (both browser extension and cron scrapers) auto-matches to existing shops or creates venue placeholders. Added test coverage for `extractVenueName()`.

## DONE #4: Build /api/events/tonight Endpoint
**Status:** Complete
**Files changed:**
- `src/lib/server/services/events.ts` — added `getTonightEvents()` with `TonightFilters` interface
- `src/routes/api/events/tonight/+server.ts` (new) — full endpoint per design contract

Supports: `?lat=&lng=` proximity sort, `?radius=` (miles), `?limit=`, `?category=` filter.
"Tonight" = now-to-23:59 Pacific (or midnight-to-23:59 if before 5am). 5min cache, CORS enabled.

## DONE #5: Extract formatEventResponse Helper
**Status:** Complete
**Files changed:**
- `src/lib/server/api-format.ts` (new) — `formatEventResponse()` camelCase→snake_case mapper
- `src/routes/api/events/+server.ts` — uses helper
- `src/routes/api/events/today/+server.ts` — uses helper
- `src/routes/api/events/nearby/+server.ts` — uses helper

## DONE #6: Archive Orphaned Documentation
**Status:** Complete
- Moved `SCRAPER_MIGRATION_PLAN.md` → `docs/archive/SCRAPER_MIGRATION_PLAN.md`
