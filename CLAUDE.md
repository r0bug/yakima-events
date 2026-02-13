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

### Utilities
- `src/lib/server/api-utils.ts` - Shared API helper functions
- `src/lib/types/index.ts` - Shared TypeScript type definitions

### Scrapers
- `src/lib/server/scrapers/scraper.ts` - Main scraper orchestration
- `src/lib/server/scrapers/intelligent.ts` - AI-powered scraping
- `src/lib/server/scrapers/parsers/` - Format-specific parsers (ical, rss, html, json)

### UI Components
- `src/lib/components/Calendar.svelte` - Calendar view
- `src/lib/components/MapView.svelte` - Google Maps
- `src/lib/components/Header.svelte` - Navigation
- `src/lib/components/EventModal.svelte` - Event details modal
- `src/lib/components/Footer.svelte` - Page footer
- `src/lib/components/Skeleton.svelte` - Loading skeleton placeholders
- `src/lib/components/ShareButton.svelte` - Social sharing dropdown
- `src/lib/components/Toast.svelte` - Toast notifications
- `src/lib/components/UserMenu.svelte` - Auth user menu dropdown

### Routes
- `src/routes/+page.svelte` - Homepage
- `src/routes/+error.svelte` - Error page
- `src/routes/calendar/` - Calendar page
- `src/routes/shops/` - Shops directory (list, detail, claim, manage)
- `src/routes/map/` - Map view
- `src/routes/events/submit/` - Public event submission
- `src/routes/login/` - Login page
- `src/routes/invites/` - Staff invite acceptance
- `src/routes/tools/facebook-scraper/` - Facebook scraper admin tool
- `src/routes/tools/eventbrite-scraper/` - Eventbrite scraper admin tool
- `src/routes/admin/` - Admin panel (events, shops, users, scrapers, claims, communication)
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
- `POST /api/scraper/facebook` - Facebook event scraper
- `POST /api/scraper/eventbrite` - Eventbrite event scraper

### Shop Collaboration
- `POST /api/shops/:id/claim` - Submit shop claim request
- `GET /api/shops/:id/team` - Shop team members
- `PUT /api/shops/:id/team/:userId` - Update team member
- `DELETE /api/shops/:id/team/:userId` - Remove team member
- `GET /api/shops/:id/invites` - Shop invites
- `POST /api/shops/:id/invites` - Create invite
- `DELETE /api/shops/:id/invites/:inviteId` - Revoke invite

### Communication
- `GET /api/communication/channels` - List channels
- `POST /api/communication/channels` - Create channel
- `GET /api/communication/channels/:id/messages` - Get messages
- `POST /api/communication/channels/:id/messages` - Post message
- `GET /api/communication/notifications` - Get notifications

### User
- `GET /api/user/shops` - User's managed shops
- `GET /api/invites/info` - Get invite info by code
- `POST /api/invites/accept` - Accept invite
- `POST /api/events/propose` - Propose collaborative event

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
