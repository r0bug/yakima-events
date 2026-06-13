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

# IMPORTANT: PM2 must be started via ecosystem.config.cjs to load .env
# If restarting from scratch: pm2 start ecosystem.config.cjs
```

## Auth
- Google OAuth via `/auth/google` → Google → `/auth/google/callback`
- `PUBLIC_APP_URL` must be imported from `$env/dynamic/public` (not `$env/dynamic/private`)
- Session cookies validated in `src/hooks.server.ts`

## Database

**IMPORTANT**: This app is now the sole frontend — PHP routes have been removed from nginx. Legacy PHP URLs are 301-redirected to SvelteKit equivalents via nginx rules.

### Tables Used by This App
- `events` - Event listings
- `event_categories`, `event_category_mapping` - Event categorization
- `event_images` - Event photos
- `calendar_sources` - Event scraping sources
- `local_shops` - Shop directory
- `shop_categories`, `shop_images` - Shop categorization
- `intelligent_scraper_*` - AI scraping tables (methods, sessions, cache, patterns, batches, logs)
- `scraping_logs` - Scraping history

- `users`, `user_sessions` - User authentication (Google OAuth)
- `shop_staff`, `shop_staff_invites` - Shop team management
- `shop_claim_requests` - Shop claiming
- `event_shop_participants` - Collaborative events
- `communication_channels`, `communication_messages`, `communication_participants` - Messaging
- `communication_attachments`, `communication_notifications`, `communication_reactions` - Messaging support
- `communication_email_addresses` - Channel email integration

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
- `src/lib/server/services/facebook.ts` - Facebook event scraping (RapidAPI)
- `src/lib/server/services/eventbrite.ts` - Eventbrite event scraping
- `src/lib/server/services/shopClaim.ts` - Shop claim workflow
- `src/lib/server/services/shopStaff.ts` - Shop staff management
- `src/lib/server/services/social.ts` - Social sharing
- `src/lib/server/services/collaborativeEvents.ts` - Collaborative events
- `src/lib/server/services/communication/` - Communication hub (channels, messages, notifications)

### Junk Run Configs
- `src/lib/config/junk-runs/vintiques.json` - Branded junk run config (name, tagline, theme, map center/zoom)

### Utilities
- `src/lib/server/api-utils.ts` - Shared API helper functions
- `src/lib/types/index.ts` - Shared TypeScript type definitions
- `src/lib/utils/geo.ts` - Geocoding utils, region detection, distance calculations

### Scrapers
- `src/lib/server/scrapers/scraper.ts` - Main scraper orchestration
- `src/lib/server/scrapers/intelligent.ts` - AI-powered scraping
- `src/lib/server/scrapers/parsers/` - Format-specific parsers (ical, rss, html, json, cityspark)

### UI Components
- `src/lib/components/Calendar.svelte` - Calendar view (agenda/month/week/day/map). ‹ / › arrows step one day at a time in every view; selected day highlighted in month/week grids. Map view plots the selected day's events.
- `src/lib/components/MapView.svelte` - Google Maps. Event markers show details on hover (time/location/description); click opens the full event.
- `src/lib/components/Header.svelte` - Navigation
- `src/lib/components/EventModal.svelte` - Event details modal
- `src/lib/components/Footer.svelte` - Page footer
- `src/lib/components/Skeleton.svelte` - Loading skeleton placeholders
- `src/lib/components/ShareButton.svelte` - Social sharing dropdown
- `src/lib/components/Toast.svelte` - Toast notifications
- `src/lib/components/UserMenu.svelte` - Auth user menu dropdown
- `src/lib/components/JunkRunFlyer.svelte` - Printable flyer with map, QR codes, area selector

### Routes
- `src/routes/+page.svelte` - Homepage with Event Pulse widget (today/tomorrow/week/month counts)
- `src/routes/+page.server.ts` - Homepage SSR loader (event counts query)
- `src/routes/+error.svelte` - Error page
- `src/routes/calendar/` - Calendar page
- `src/routes/shops/` - Shops directory (list, detail, claim, manage)
- `src/routes/shops/[id]/` - Shop detail with SSR + OG/Twitter/JSON-LD SEO tags
- `src/routes/events/[id]/` - Event detail with SSR + OG/Twitter/JSON-LD SEO tags
- `src/routes/events/submit/` - Public event submission
- `src/routes/map/` - Map view
- `src/routes/login/` - Login page
- `src/routes/invites/` - Staff invite acceptance
- `src/routes/communication/` - Communication hub (auth required)
- `src/routes/communication/propose-event/` - Collaborative event proposal
- `src/routes/communication/proposal/[id]/` - View/approve proposal
- `src/routes/tools/facebook-scraper/` - Facebook scraper admin tool
- `src/routes/tools/eventbrite-scraper/` - Eventbrite scraper admin tool
- `src/routes/tools/facebook-browser-scraper/` - Facebook browser scraper tool
- `src/routes/junk-run/` - Redirects to default junk run config
- `src/routes/junk-run/[slug]/` - Branded junk run map page (Leaflet, category/region filters, route planner, printable flyer)
- `src/routes/admin/` - Admin panel (events, shops, users, scrapers, claims, communication, forum, settings, geocode-fix, system-checkup, validate-urls)
- `src/routes/api/` - REST API endpoints

## API Endpoints

### Events
- `GET /api/events` - List events (params: `include_categories`, `exclude_categories` as comma-separated slugs)
- `GET /api/events/:id` - Get event
- `GET /api/events/:id/calendar.ics` - ICS calendar download
- `GET /api/events/:id/share` - Share metadata
- `GET /api/events/:id/participants` - Event participants
- `GET /api/events/today` - Today's events
- `GET /api/events/nearby` - Events near location (params: `latitude`, `longitude`, `radius`)
- `GET /api/events/categories` - Categories
- `POST /api/events/propose` - Propose collaborative event

### Shops
- `GET /api/shops` - List shops
- `GET /api/shops/:id` - Get shop
- `GET /api/shops/:id/share` - Share metadata
- `GET /api/shops/:id/events` - Shop events (staff only)
- `GET /api/shops/nearby` - Shops near location (params: `latitude`, `longitude`, `radius`)
- `GET /api/shops/categories` - Categories

### Scraper
- `GET /api/sources` - List sources
- `GET /api/sources/:id` - Get source
- `POST /api/sources/:id/test` - Test source
- `POST /api/scrape/:id` - Run scraper
- `POST /api/scraper/intelligent` - AI scraper
- `POST /api/scraper/facebook` - Facebook event scraper
- `POST /api/scraper/eventbrite` - Eventbrite event scraper
- `POST /api/scraper/facebook-browser` - Facebook browser scraper

### Shop Collaboration
- `POST /api/shops/:id/claim` - Submit shop claim request
- `GET /api/shops/:id/team` - Shop team members
- `PUT /api/shops/:id/team/:userId` - Update team member
- `DELETE /api/shops/:id/team/:userId` - Remove team member
- `GET /api/shops/:id/invites` - Shop invites
- `POST /api/shops/:id/invites` - Create invite
- `DELETE /api/shops/:id/invites/:inviteId` - Revoke invite

### Communication
- `GET /api/communication/channels` - List channels (public without auth)
- `POST /api/communication/channels` - Create channel
- `GET /api/communication/channels/:id/messages` - Get messages
- `POST /api/communication/channels/:id/messages` - Post message
- `GET /api/communication/notifications` - Get notifications

### User & Auth
- `GET /api/auth/status` - Authentication status
- `GET /api/user/shops` - User's managed shops
- `GET /api/invites/info` - Get invite info by code
- `POST /api/invites/accept` - Accept invite

### Admin API
- `GET /api/admin/claims` - List claims
- `PUT /api/admin/claims/:id` - Update claim
- `GET /api/admin/forum` - Forum stats and management
- `GET /api/admin/system-checkup` - System health check
- `POST /api/admin/validate-url` - Validate URL

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
