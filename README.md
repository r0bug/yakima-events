# Yakima Events Calendar

A modern event calendar and local shops directory for Yakima, WA with Google Maps integration. Built with SvelteKit, TypeScript, and MySQL.

**Live Site**: [https://yfevents.yakimafinds.com](https://yfevents.yakimafinds.com)

## Features

- **Event Calendar**: View events by day, week, month, or list
- **Interactive Map**: See events and shops on a Google Map
- **Local Shops Directory**: Browse local businesses with categories
- **Junk Runs**: Branded, config-driven shop-crawl pages (map, filters, route planner)
- **Printable Flyers**: Five templates per junk run, including a landscape
  double-sided newspaper ("Junk Run Gazette") with per-shop QR codes
- **Shareable Cards**: Generated 1200x630 Open Graph images so links posted to
  Facebook arrive with a real preview
- **Browser Capture**: Chrome extension that captures Facebook events while you browse
- **Intelligent Scraping**: AI-powered event extraction using LLM
- **Feeds**: JSON and RSS feeds, per-event `.ics`, and per-day share pages
- **Search & Filter**: Find events by keyword, category, or location
- **Responsive Design**: Works on desktop and mobile devices
- **API-First**: RESTful API endpoints for all data

## Tech Stack

- **Frontend**: SvelteKit 2, TailwindCSS, TypeScript
- **Backend**: Node.js, MySQL
- **ORM**: Drizzle ORM
- **Maps**: Google Maps JavaScript API
- **Date Handling**: date-fns
- **Process Manager**: PM2

## Project Structure

```
yakima/
├── src/
│   ├── lib/
│   │   ├── components/     # Svelte UI components
│   │   ├── server/         # Server-side code
│   │   │   ├── db/         # Database schema & connection
│   │   │   ├── scrapers/   # Event scraping logic
│   │   │   └── services/   # Business logic services
│   │   └── utils/          # Helper functions
│   └── routes/
│       ├── api/            # REST API endpoints
│       │   ├── events/     # Events API
│       │   ├── shops/      # Shops API
│       │   └── scraper/    # Scraper API
│       ├── admin/          # Admin interface
│       └── (app)/          # Page routes
├── data/
│   └── junk-runs/          # Junk run configs (runtime-editable, gitignored)
├── extension/              # Chrome extension (Facebook event capture)
├── migrations/             # SQL migrations
├── static/                 # Static assets (incl. the packaged extension)
├── tools/                  # Dev/ops scripts (see Tools)
└── uploads/                # User uploads, served directly by nginx at /uploads
```

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Google Maps API Key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/r0bug/yakima-events.git
cd yakima-events
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
```

4. Create the database and run migrations:
```bash
mysql -u root -p -e "CREATE DATABASE yakima_events"
mysql -u root -p yakima_events < migrations/0001_initial_schema.sql
mysql -u root -p yakima_events < migrations/002_intelligent_scraper.sql
```

5. Start the development server:
```bash
npm run dev
```

6. Open http://localhost:5173 in your browser

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_HOST | MySQL host | Yes |
| DATABASE_PORT | MySQL port | Yes |
| DATABASE_NAME | Database name | Yes |
| DATABASE_USER | Database user | Yes |
| DATABASE_PASSWORD | Database password | Yes |
| GOOGLE_MAPS_API_KEY | Google Maps API key | Yes |
| PUBLIC_APP_NAME | Application name | No |
| PUBLIC_DEFAULT_LAT | Default map latitude | No |
| PUBLIC_DEFAULT_LNG | Default map longitude | No |
| PUBLIC_DEFAULT_ZOOM | Default map zoom | No |
| SMTP_HOST | SMTP server for emails | No |
| SMTP_USER | SMTP username | No |
| SMTP_PASS | SMTP password | No |
| ADMIN_EMAIL | Admin notification email | No |
| SEGMIND_API_KEY | Segmind API for LLM scraping | No |
| FIRECRAWL_API_KEY | Firecrawl API for web scraping | No |

## API Endpoints

### Events

- `GET /api/events` - List events with filtering
- `GET /api/events/:id` - Get single event
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `GET /api/events/today` - Get today's events
- `GET /api/events/nearby` - Get events near coordinates
- `GET /api/events/categories` - Get event categories

### Shops

- `GET /api/shops` - List shops with filtering
- `GET /api/shops/:id` - Get single shop
- `POST /api/shops` - Create new shop
- `PUT /api/shops/:id` - Update shop
- `DELETE /api/shops/:id` - Delete shop
- `GET /api/shops/nearby` - Get shops near coordinates
- `GET /api/shops/categories` - Get shop categories

### Scraper

- `GET /api/sources` - List event sources
- `POST /api/scrape/:id` - Trigger scrape for source
- `POST /api/scraper/intelligent` - Run intelligent scraper
- `POST /api/scraper/facebook-browser` - Ingest events captured by the Chrome extension

### Share Cards

Open Graph images are rendered server-side (SVG -> PNG) so shared links preview well:

- `GET /day/:date/og.png` - Card listing that day's events
- `GET /events/:id/og.png` - Card for one event (used when it has no photo)
- `GET /junk-run/:slug/og.png` - Card for a junk run, themed from its own config

## Query Parameters

Events and shops endpoints support:

- `start_date` / `end_date` - Date range filter
- `category` - Category slug filter
- `featured` - Featured items only (true/false)
- `search` - Text search
- `latitude` / `longitude` / `radius` - Location-based search
- `limit` / `offset` - Pagination

## Junk Runs

A junk run is a branded shop-crawl page at `/junk-run/<slug>`, driven entirely by one
JSON config - no code per run. Configs live in `data/junk-runs/<slug>.json` and are read
**per request**, so content changes need no rebuild or restart. `src/lib/config/junk-runs/`
is a legacy fallback.

A config carries the name, tagline, theme colours, map centre/zoom, which shop categories
to include, an optional `notice` banner, an optional `venue` pin, an optional `shareImage`
override, and a `flyer` block selecting one of five templates:

| Template | Shape |
|----------|-------|
| `map-focus` | Full-width map, 2-column directory on page 2 |
| `directory-focus` | Half-page map, categorised list with addresses |
| `postcard` | Single-page handout |
| `vintage-guide` | Kraft-paper guide, tall map + region ledger |
| `gazette` | Landscape 11x8.5 double-sided newspaper, classifieds with per-shop QR codes |

`/junk-run` redirects to whichever run is currently featured (set in
`src/routes/junk-run/+page.server.ts`).

## Chrome Extension

`extension/` is a Manifest V3 extension that captures Facebook events while you browse
and posts them to `/api/scraper/facebook-browser`. This - not the cron scraper - is how
Facebook events reach the calendar; its `calendar_sources` row is deliberately inactive
so the scheduler never touches it.

`static/extension.zip` is what `/extension` offers for download. It is a build artifact,
so `npm run build` refuses to run while it differs from `extension/`. After changing the
extension, regenerate both archives:

```bash
python3 tools/pack-extension.py
```

## Tools

| Script | Purpose |
|--------|---------|
| `tools/pack-extension.py` | Rebuild `static/extension.{zip,tar.gz}` from `extension/` |
| `tools/check-extension-fresh.mjs` | Build guard: fails if the packaged zip is stale (runs as `prebuild`) |
| `tools/render-flyer.mjs` | Headlessly drive a junk-run flyer and capture PNGs or a print-accurate PDF (needs an ad-hoc `puppeteer-core`) |

## Development

```bash
# Run development server
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Preview production build
npm run preview

# Database management
npm run db:push      # Push schema changes
npm run db:generate  # Generate migrations
npm run db:studio    # Open Drizzle Studio
```

## Production Deployment

### Build and Deploy

```bash
# Build the application
npm run build

# Start with PM2
pm2 start build/index.js --name yakima-events

# Or restart existing
pm2 restart yakima-events
```

### Nginx Configuration

The app runs on port 3002 internally. Nginx proxies HTTPS traffic to it.

```nginx
location / {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Related Projects

This project is a modern rewrite of [YFEvents](https://github.com/r0bug/YFEvents) (PHP), sharing the same database.

Key improvements:
- SvelteKit instead of PHP
- TypeScript for type safety
- Drizzle ORM instead of raw PDO
- TailwindCSS for styling
- Component-based architecture
- Intelligent AI-powered event scraping

## License

MIT
