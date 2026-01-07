# Yakima Events - Project Context

## Quick Reference

| Item | Value |
|------|-------|
| **Live URL** | https://yfevents.yakimafinds.com |
| **Directory** | `/home/robug/yakima` |
| **PM2 Process** | `yakima-events` |
| **Internal Port** | 3002 |
| **Database** | `yakima_finds` (MySQL) |
| **Stack** | SvelteKit + TypeScript + TailwindCSS + Drizzle ORM |

## Deployment Commands

```bash
# Build and deploy
npm run build && pm2 restart yakima-events

# View logs
pm2 logs yakima-events

# Check status
pm2 status
```

## Database

**IMPORTANT**: This app shares the `yakima_finds` database with the PHP YFEvents application at `/home/robug/YFEvents`.

### Tables Used by This App
- `events` - Event listings
- `event_categories`, `event_category_mapping` - Event categorization
- `event_images` - Event photos
- `calendar_sources` - Event scraping sources
- `local_shops` - Shop directory
- `shop_categories`, `shop_images` - Shop categorization
- `intelligent_scraper_*` - AI scraping tables (methods, sessions, cache, patterns, batches, logs)
- `scraping_logs` - Scraping history

### Tables in DB but NOT in Drizzle Schema (from YFEvents PHP)
- `shop_staff`, `shop_staff_invites` - Shop team management
- `shop_owners`, `shop_claim_requests` - Shop claiming
- `event_shop_participants` - Collaborative events
- `users`, `user_roles`, `user_sessions` - User authentication
- `communication_*` - Internal messaging

## Key Files

### Configuration
- `.env` - Environment variables (DO NOT COMMIT)
- `.env.example` - Template for env vars
- `drizzle.config.ts` - Drizzle ORM config
- `svelte.config.js` - SvelteKit config
- `tailwind.config.js` - TailwindCSS config

### Database Schema
- `src/lib/server/db/schema.ts` - Drizzle table definitions
- `src/lib/server/db/index.ts` - Database connection
- `migrations/*.sql` - SQL migrations

### Services (Business Logic)
- `src/lib/server/services/events.ts` - Event operations
- `src/lib/server/services/shops.ts` - Shop operations
- `src/lib/server/services/sources.ts` - Scraping sources
- `src/lib/server/services/geocode.ts` - Geocoding
- `src/lib/server/services/email.ts` - Email notifications
- `src/lib/server/services/llm.ts` - LLM integration
- `src/lib/server/services/firecrawl.ts` - Firecrawl web scraping

### Scrapers
- `src/lib/server/scrapers/scraper.ts` - Main scraper orchestration
- `src/lib/server/scrapers/intelligent.ts` - AI-powered scraping
- `src/lib/server/scrapers/parsers/` - Format-specific parsers (ical, rss, html, json)

### UI Components
- `src/lib/components/Calendar.svelte` - Calendar view
- `src/lib/components/MapView.svelte` - Google Maps
- `src/lib/components/Header.svelte` - Navigation
- `src/lib/components/EventModal.svelte` - Event details modal

### Routes
- `src/routes/+page.svelte` - Homepage
- `src/routes/calendar/` - Calendar page
- `src/routes/shops/` - Shops directory
- `src/routes/map/` - Map view
- `src/routes/admin/scrapers/` - Scraper admin
- `src/routes/api/` - REST API endpoints

## API Endpoints

### Events
- `GET /api/events` - List events
- `GET /api/events/:id` - Get event
- `GET /api/events/today` - Today's events
- `GET /api/events/nearby` - Events near location
- `GET /api/events/categories` - Categories

### Shops
- `GET /api/shops` - List shops
- `GET /api/shops/:id` - Get shop
- `GET /api/shops/nearby` - Shops near location
- `GET /api/shops/categories` - Categories

### Scraper
- `GET /api/sources` - List sources
- `POST /api/scrape/:id` - Run scraper
- `POST /api/scraper/intelligent` - AI scraper

## Future Work: Shop Collaboration

The database has shop collaboration tables (`shop_staff`, `shop_staff_invites`) populated by the PHP backend. To add this to the SvelteKit app:

1. Add Drizzle schema for `shopStaff` and `shopStaffInvites`
2. Create shop staff service
3. Add API endpoints for invites, permissions
4. Build UI for shop owners to manage team

Reference: `/home/robug/YFEvents/docs/SHOP_STAFF_IMPLEMENTATION.md`

## Common Tasks

### Add a new API endpoint
1. Create file in `src/routes/api/[endpoint]/+server.ts`
2. Export GET/POST/PUT/DELETE handlers
3. Use services from `src/lib/server/services/`

### Add a new page
1. Create `+page.svelte` in `src/routes/[path]/`
2. Add server-side data loading in `+page.server.ts` if needed
3. Use components from `src/lib/components/`

### Modify database schema
1. Update `src/lib/server/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Or manually write SQL in `migrations/`

### Test scraper
1. Go to `/admin/scrapers`
2. Select a source and click "Test"
3. Or use `/admin/scrapers/intelligent` for AI scraping
