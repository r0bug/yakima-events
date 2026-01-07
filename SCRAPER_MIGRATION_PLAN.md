# Scraper Migration Execution Plan

## Overview

This plan extracts the complete scraper system from YFEvents (PHP) and migrates it to the Yakima SvelteKit project (TypeScript), including all advanced features like AI-powered intelligent scraping.

---

## Current State Analysis

### YFEvents Scraper System (Source - PHP)

**Core Components:**
1. **EventScraper.php** (~800 lines) - Main orchestrator supporting:
   - iCal parsing
   - HTML scraping with CSS selectors
   - JSON API parsing
   - Yakima Valley custom scraper
   - **Intelligent (LLM-based) scraping**
   - Firecrawl enhanced scraping

2. **LLMScraper.php** (~830 lines) - AI-powered scraper using:
   - Segmind API (uses Kimi K2 model for Claude-like analysis)
   - Automatic pattern detection from any webpage
   - Method generation and reuse
   - Session tracking and approval workflow

3. **SegmindAPI.php** (~290 lines) - LLM integration:
   - HTML content analysis
   - Event pattern detection
   - Extraction method generation

4. **FirecrawlEnhancedScraper.php** (~480 lines) - Web scraping API:
   - Structured data extraction
   - Search-based scraping
   - Fallback to traditional methods

5. **Supporting Files:**
   - YakimaValleyEventScraper.php - Custom parser for visityakima.com
   - GeocodeService.php - Google Maps geocoding with caching
   - Cron job (scrape-events.php) for scheduled execution

**Database Tables (already exist in yakima_finds):**
- `intelligent_scraper_methods` - Stores LLM-generated extraction patterns
- `intelligent_scraper_sessions` - Tracks analysis sessions
- `intelligent_scraper_cache` - Caches successful extractions
- `intelligent_scraper_patterns` - URL patterns discovered by LLM
- `intelligent_scraper_batches` - Batch processing jobs
- `intelligent_scraper_batch_items` - Individual batch items
- `intelligent_scraper_logs` - Detailed logging

### Yakima Scraper System (Target - TypeScript)

**Currently Implemented:**
- Basic scraper.ts (~330 lines) - Orchestrator for:
  - iCal, HTML, JSON, RSS parsers
- Parser modules (ical.ts, html.ts, json.ts, rss.ts)
- Types defined (types.ts)

**Missing:**
- Intelligent (LLM) scraping
- Firecrawl integration
- Yakima Valley custom scraper
- Geocoding service
- Admin UI for scraper management
- Cron/scheduled execution

---

## Secrets to Migrate

From `/home/robug/YFEvents/www/html/.env`:
```
FIRECRAWL_API_KEY=REDACTED_FIRECRAWL_KEY
GOOGLE_MAPS_API_KEY=REDACTED_GOOGLE_KEY
GMAIL_USERNAME=yakimafinds@gmail.com
GMAIL_APP_PASSWORD=REDACTED_PASSWORD
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

Note: The Segmind API key is in `/home/robug/YFEvents/config/api_keys.php` (not in .env)

---

## Execution Plan

### Phase 1: Database Schema Updates (30 min)
**Add intelligent scraper tables to yakima project**

1. Create migration for intelligent scraper tables:
   - `intelligent_scraper_methods`
   - `intelligent_scraper_sessions`
   - `intelligent_scraper_cache`
   - `intelligent_scraper_patterns`
   - `intelligent_scraper_batches`
   - `intelligent_scraper_batch_items`
   - `intelligent_scraper_logs`

2. Add `scrape_type` column expansion to `calendar_sources`:
   - Add 'intelligent', 'yakima_valley', 'firecrawl_enhanced' types

3. Add `intelligent_method_id` foreign key to `calendar_sources`

### Phase 2: Core Services (2-3 hours)

1. **Geocoding Service** (`src/lib/server/services/geocode.ts`)
   - Google Maps geocoding integration
   - File-based caching
   - Yakima area bias

2. **LLM Service** (`src/lib/server/services/llm.ts`)
   - Segmind API integration
   - Event pattern detection prompts
   - Method generation prompts
   - JSON response parsing

3. **Firecrawl Service** (`src/lib/server/services/firecrawl.ts`)
   - Web scraping API integration
   - Structured extraction
   - Search functionality

### Phase 3: Scraper Enhancements (2-3 hours)

1. **Update types.ts**
   - Add 'intelligent', 'yakima_valley', 'firecrawl_enhanced' scrape types
   - Add intelligent scraper interfaces
   - Add session/method types

2. **Yakima Valley Parser** (`src/lib/server/scrapers/parsers/yakima-valley.ts`)
   - Port from YakimaValleyEventScraper.php
   - Custom parsing for visityakima.com format

3. **Intelligent Scraper** (`src/lib/server/scrapers/intelligent.ts`)
   - Port LLMScraper.php logic to TypeScript
   - Session management
   - Method generation and storage
   - Approval workflow

4. **Firecrawl Scraper** (`src/lib/server/scrapers/firecrawl.ts`)
   - Port FirecrawlEnhancedScraper.php
   - Fallback to basic parsers

5. **Update main scraper.ts**
   - Add new scraper type cases
   - Integrate geocoding
   - Add logging to scraping_logs table

### Phase 4: API Endpoints (1-2 hours)

1. **Intelligent Scraper API** (`src/routes/api/scraper/intelligent/+server.ts`)
   - POST /api/scraper/intelligent/analyze - Analyze URL
   - POST /api/scraper/intelligent/approve - Approve method
   - GET /api/scraper/intelligent/stats - Get statistics
   - GET /api/scraper/intelligent/sessions - List sessions
   - POST /api/scraper/intelligent/batch - Batch CSV upload

2. **Scraping Logs API** (`src/routes/api/scraper/logs/+server.ts`)
   - GET /api/scraper/logs - View logs
   - GET /api/scraper/logs/[sourceId] - Source-specific logs

### Phase 5: Admin Interface (2-3 hours)

1. **Scraper Management Page** (`src/routes/admin/scrapers/+page.svelte`)
   - List all calendar sources
   - Add/edit/delete sources
   - Manual scrape triggers
   - View scrape history

2. **Intelligent Scraper Page** (`src/routes/admin/scrapers/intelligent/+page.svelte`)
   - URL input for analysis
   - Real-time progress display
   - Event preview cards
   - Approve/reject workflow
   - CSV batch upload
   - Recent sessions list
   - Statistics dashboard

3. **Source Editor** (`src/routes/admin/scrapers/[id]/+page.svelte`)
   - Edit source configuration
   - Test scraper
   - View history

### Phase 6: Scheduled Execution (30 min)

1. **Cron API Endpoint** (`src/routes/api/cron/scrape/+server.ts`)
   - Protected endpoint for scheduled scraping
   - Run all active sources
   - Email notification on failures

2. **System Cron Setup**
   - Add crontab entry to call the endpoint
   - Or use external scheduler (cron-job.org)

### Phase 7: Environment & Testing (1 hour)

1. **Update .env**
   ```
   SEGMIND_API_KEY=<from config/api_keys.php>
   FIRECRAWL_API_KEY=REDACTED_FIRECRAWL_KEY
   GOOGLE_MAPS_API_KEY=REDACTED_GOOGLE_KEY
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yakimafinds@gmail.com
   SMTP_PASS=REDACTED_PASSWORD
   ```

2. **Testing**
   - Test each parser with sample data
   - Test intelligent scraper with real URLs
   - Test batch processing
   - Verify geocoding works

---

## File Structure After Migration

```
src/lib/server/
├── scrapers/
│   ├── types.ts              # Updated with new types
│   ├── scraper.ts            # Updated main orchestrator
│   ├── intelligent.ts        # NEW: LLM-based scraper
│   ├── firecrawl.ts          # NEW: Firecrawl integration
│   └── parsers/
│       ├── index.ts
│       ├── ical.ts
│       ├── html.ts
│       ├── json.ts
│       ├── rss.ts
│       └── yakima-valley.ts  # NEW: Custom parser
├── services/
│   ├── events.ts
│   ├── shops.ts
│   ├── sources.ts
│   ├── geocode.ts            # NEW: Geocoding service
│   ├── llm.ts                # NEW: Segmind API
│   └── email.ts              # NEW: Email notifications
└── db/
    └── schema.ts             # Updated with new tables

src/routes/
├── api/
│   ├── scraper/
│   │   ├── intelligent/
│   │   │   └── +server.ts    # NEW: Intelligent scraper API
│   │   └── logs/
│   │       └── +server.ts    # NEW: Logging API
│   └── cron/
│       └── scrape/
│           └── +server.ts    # NEW: Cron endpoint
└── admin/
    └── scrapers/
        ├── +page.svelte       # NEW: Scraper management
        ├── intelligent/
        │   └── +page.svelte   # NEW: AI scraper UI
        └── [id]/
            └── +page.svelte   # NEW: Source editor
```

---

## Estimated Total Time

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Database Schema | 30 min |
| 2 | Core Services | 2-3 hours |
| 3 | Scraper Enhancements | 2-3 hours |
| 4 | API Endpoints | 1-2 hours |
| 5 | Admin Interface | 2-3 hours |
| 6 | Scheduled Execution | 30 min |
| 7 | Environment & Testing | 1 hour |
| **Total** | | **9-13 hours** |

---

## Risk Assessment

1. **Segmind API Compatibility** - The PHP code uses specific model endpoints that may need adjustment for Node.js
2. **Database Compatibility** - Existing intelligent scraper tables may need migration if structure differs
3. **Firecrawl Rate Limits** - Need to handle API limits gracefully
4. **LLM Response Parsing** - JSON extraction from LLM responses can be unreliable

---

## Approval Required

Please review this plan and let me know:
1. Should I proceed with this plan?
2. Any phases you'd like to prioritize or skip?
3. Any concerns about the API keys or secrets handling?
4. Preference for admin UI styling (matching current Tailwind theme)?

Once approved, I'll begin with Phase 1 (Database Schema).
