import {
  mysqlTable,
  varchar,
  int,
  text,
  datetime,
  decimal,
  boolean,
  json,
  timestamp,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Events Table
// ============================================================================
export const events = mysqlTable('events', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  startDatetime: timestamp('start_datetime').notNull(),
  endDatetime: timestamp('end_datetime'),
  location: varchar('location', { length: 255 }),
  address: text('address'),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  contactInfo: json('contact_info'),
  externalUrl: varchar('external_url', { length: 500 }),
  sourceId: int('source_id'),
  externalEventId: varchar('external_event_id', { length: 255 }),
  status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending'),
  featured: boolean('featured').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  statusIdx: index('idx_events_status').on(table.status),
  startDatetimeIdx: index('idx_events_start').on(table.startDatetime),
  locationIdx: index('idx_events_location').on(table.latitude, table.longitude),
}));

// ============================================================================
// Event Categories Table
// ============================================================================
export const eventCategories = mysqlTable('event_categories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  color: varchar('color', { length: 7 }),
  icon: varchar('icon', { length: 100 }),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// Event Category Mapping (Many-to-Many)
// ============================================================================
export const eventCategoryMapping = mysqlTable('event_category_mapping', {
  id: int('id').primaryKey().autoincrement(),
  eventId: int('event_id').notNull(),
  categoryId: int('category_id').notNull(),
}, (table) => ({
  eventIdx: index('event_idx').on(table.eventId),
  categoryIdx: index('category_idx').on(table.categoryId),
}));

// ============================================================================
// Event Images Table
// ============================================================================
export const eventImages = mysqlTable('event_images', {
  id: int('id').primaryKey().autoincrement(),
  eventId: int('event_id').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  altText: varchar('alt_text', { length: 255 }),
  isPrimary: boolean('is_primary').default(false),
  sortOrder: int('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  eventIdx: index('event_idx').on(table.eventId),
}));

// ============================================================================
// Calendar Sources Table (for event scraping)
// ============================================================================
export const calendarSources = mysqlTable('calendar_sources', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  scrapeType: mysqlEnum('scrape_type', ['ical', 'html', 'json', 'eventbrite', 'facebook', 'yakima_valley', 'intelligent', 'firecrawl']).notNull(),
  scrapeConfig: json('scrape_config'),
  intelligentMethodId: int('intelligent_method_id'),
  lastScraped: timestamp('last_scraped'),
  active: boolean('active').default(true),
  createdBy: int('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  lastScrapedIdx: index('idx_last_scraped').on(table.lastScraped),
  activeIdx: index('idx_active').on(table.active),
}));

// ============================================================================
// Intelligent Scraper Methods Table
// ============================================================================
export const intelligentScraperMethods = mysqlTable('intelligent_scraper_methods', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  urlPattern: varchar('url_pattern', { length: 500 }),
  methodType: mysqlEnum('method_type', ['event_list', 'event_detail', 'combined']).notNull(),
  extractionRules: json('extraction_rules').notNull(),
  selectorMappings: json('selector_mappings'),
  postProcessing: json('post_processing'),
  llmModel: varchar('llm_model', { length: 100 }),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  testResults: json('test_results'),
  active: boolean('active').default(true),
  approvedBy: int('approved_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  lastUsed: timestamp('last_used'),
  usageCount: int('usage_count').default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }).default('0.00'),
}, (table) => ({
  domainIdx: index('idx_domain').on(table.domain),
  activeIdx: index('idx_active').on(table.active),
  confidenceIdx: index('idx_confidence').on(table.confidenceScore),
  lastUsedIdx: index('idx_last_used').on(table.lastUsed),
}));

// ============================================================================
// Intelligent Scraper Sessions Table
// ============================================================================
export const intelligentScraperSessions = mysqlTable('intelligent_scraper_sessions', {
  id: int('id').primaryKey().autoincrement(),
  url: varchar('url', { length: 500 }).notNull(),
  pageContent: text('page_content'),
  llmAnalysis: json('llm_analysis'),
  foundEvents: json('found_events'),
  methodId: int('method_id'),
  status: mysqlEnum('status', ['analyzing', 'events_found', 'no_events', 'error', 'approved']).default('analyzing'),
  errorMessage: text('error_message'),
  userFeedback: text('user_feedback'),
  createdBy: int('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('idx_status').on(table.status),
  createdAtIdx: index('idx_created_at').on(table.createdAt),
}));

// ============================================================================
// Intelligent Scraper Cache Table
// ============================================================================
export const intelligentScraperCache = mysqlTable('intelligent_scraper_cache', {
  id: int('id').primaryKey().autoincrement(),
  url: varchar('url', { length: 500 }).notNull(),
  methodId: int('method_id').notNull(),
  extractedData: json('extracted_data').notNull(),
  extractionTime: decimal('extraction_time', { precision: 10, scale: 3 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  urlIdx: index('idx_url').on(table.url),
  methodIdx: index('idx_method').on(table.methodId),
  createdAtIdx: index('idx_created_at').on(table.createdAt),
}));

// ============================================================================
// Intelligent Scraper Patterns Table
// ============================================================================
export const intelligentScraperPatterns = mysqlTable('intelligent_scraper_patterns', {
  id: int('id').primaryKey().autoincrement(),
  domain: varchar('domain', { length: 255 }).notNull(),
  patternType: mysqlEnum('pattern_type', ['event_list', 'event_detail', 'calendar', 'api']).notNull(),
  urlPattern: varchar('url_pattern', { length: 500 }).notNull(),
  patternRegex: varchar('pattern_regex', { length: 500 }),
  exampleUrls: json('example_urls'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  discoveredBySession: int('discovered_by_session'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  domainIdx: index('idx_domain').on(table.domain),
  patternTypeIdx: index('idx_pattern_type').on(table.patternType),
}));

// ============================================================================
// Intelligent Scraper Batches Table
// ============================================================================
export const intelligentScraperBatches = mysqlTable('intelligent_scraper_batches', {
  id: int('id').primaryKey().autoincrement(),
  filename: varchar('filename', { length: 255 }),
  totalUrls: int('total_urls').default(0),
  processedUrls: int('processed_urls').default(0),
  successCount: int('success_count').default(0),
  errorCount: int('error_count').default(0),
  totalEvents: int('total_events').default(0),
  status: mysqlEnum('status', ['pending', 'processing', 'completed', 'failed']).default('pending'),
  createdBy: int('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('idx_status').on(table.status),
}));

// ============================================================================
// Intelligent Scraper Batch Items Table
// ============================================================================
export const intelligentScraperBatchItems = mysqlTable('intelligent_scraper_batch_items', {
  id: int('id').primaryKey().autoincrement(),
  batchId: int('batch_id').notNull(),
  title: varchar('title', { length: 255 }),
  url: varchar('url', { length: 500 }).notNull(),
  sessionId: int('session_id'),
  status: mysqlEnum('status', ['pending', 'processing', 'completed', 'failed']).default('pending'),
  eventsFound: int('events_found').default(0),
  errorMessage: text('error_message'),
  processedAt: timestamp('processed_at'),
}, (table) => ({
  batchIdx: index('idx_batch').on(table.batchId),
  statusIdx: index('idx_status').on(table.status),
}));

// ============================================================================
// Intelligent Scraper Logs Table
// ============================================================================
export const intelligentScraperLogs = mysqlTable('intelligent_scraper_logs', {
  id: int('id').primaryKey().autoincrement(),
  batchId: int('batch_id'),
  sessionId: int('session_id'),
  level: mysqlEnum('level', ['debug', 'info', 'warning', 'error']).default('info'),
  message: text('message').notNull(),
  details: text('details'),
  url: varchar('url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  batchIdx: index('idx_batch').on(table.batchId),
  levelIdx: index('idx_level').on(table.level),
}));

// ============================================================================
// Scraping Logs Table
// ============================================================================
export const scrapingLogs = mysqlTable('scraping_logs', {
  id: int('id').primaryKey().autoincrement(),
  sourceId: int('source_id').notNull(),
  startTime: timestamp('start_time').defaultNow(),
  endTime: timestamp('end_time'),
  status: mysqlEnum('status', ['running', 'success', 'failed']).default('running'),
  eventsFound: int('events_found').default(0),
  eventsAdded: int('events_added').default(0),
  duplicatesSkipped: int('duplicates_skipped').default(0),
  errorMessage: text('error_message'),
  durationMs: int('duration_ms'),
}, (table) => ({
  sourceIdx: index('source_idx').on(table.sourceId),
  statusIdx: index('status_idx').on(table.status),
}));

// ============================================================================
// Local Shops Table
// ============================================================================
export const localShops = mysqlTable('local_shops', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  address: text('address').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  website: varchar('website', { length: 500 }),
  imageUrl: varchar('image_url', { length: 500 }),
  categoryId: int('category_id'),
  hours: json('hours'),
  operatingHours: json('operating_hours'),
  paymentMethods: json('payment_methods'),
  amenities: json('amenities'),
  featured: boolean('featured').default(false),
  verified: boolean('verified').default(false),
  ownerId: int('owner_id'),
  status: mysqlEnum('status', ['active', 'pending', 'inactive']).default('pending'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  statusIdx: index('status_idx').on(table.status),
  categoryIdx: index('category_idx').on(table.categoryId),
  locationIdx: index('location_idx').on(table.latitude, table.longitude),
}));

// ============================================================================
// Shop Categories Table
// ============================================================================
export const shopCategories = mysqlTable('shop_categories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  parentId: int('parent_id'),
  icon: varchar('icon', { length: 100 }),
  sortOrder: int('sort_order').default(0),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// Shop Images Table
// ============================================================================
export const shopImages = mysqlTable('shop_images', {
  id: int('id').primaryKey().autoincrement(),
  shopId: int('shop_id').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  altText: varchar('alt_text', { length: 255 }),
  isPrimary: boolean('is_primary').default(false),
  sortOrder: int('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  shopIdx: index('shop_idx').on(table.shopId),
}));

// ============================================================================
// Relations
// ============================================================================
export const eventsRelations = relations(events, ({ one, many }) => ({
  source: one(calendarSources, {
    fields: [events.sourceId],
    references: [calendarSources.id],
  }),
  categoryMappings: many(eventCategoryMapping),
  images: many(eventImages),
}));

export const eventCategoriesRelations = relations(eventCategories, ({ many }) => ({
  mappings: many(eventCategoryMapping),
}));

export const eventCategoryMappingRelations = relations(eventCategoryMapping, ({ one }) => ({
  event: one(events, {
    fields: [eventCategoryMapping.eventId],
    references: [events.id],
  }),
  category: one(eventCategories, {
    fields: [eventCategoryMapping.categoryId],
    references: [eventCategories.id],
  }),
}));

export const eventImagesRelations = relations(eventImages, ({ one }) => ({
  event: one(events, {
    fields: [eventImages.eventId],
    references: [events.id],
  }),
}));

export const localShopsRelations = relations(localShops, ({ one, many }) => ({
  category: one(shopCategories, {
    fields: [localShops.categoryId],
    references: [shopCategories.id],
  }),
  images: many(shopImages),
}));

export const shopCategoriesRelations = relations(shopCategories, ({ many }) => ({
  shops: many(localShops),
}));

export const shopImagesRelations = relations(shopImages, ({ one }) => ({
  shop: one(localShops, {
    fields: [shopImages.shopId],
    references: [localShops.id],
  }),
}));

// ============================================================================
// Intelligent Scraper Relations
// ============================================================================
export const intelligentScraperMethodsRelations = relations(intelligentScraperMethods, ({ many }) => ({
  sessions: many(intelligentScraperSessions),
  cache: many(intelligentScraperCache),
}));

export const intelligentScraperSessionsRelations = relations(intelligentScraperSessions, ({ one }) => ({
  method: one(intelligentScraperMethods, {
    fields: [intelligentScraperSessions.methodId],
    references: [intelligentScraperMethods.id],
  }),
}));

export const intelligentScraperCacheRelations = relations(intelligentScraperCache, ({ one }) => ({
  method: one(intelligentScraperMethods, {
    fields: [intelligentScraperCache.methodId],
    references: [intelligentScraperMethods.id],
  }),
}));

export const intelligentScraperBatchesRelations = relations(intelligentScraperBatches, ({ many }) => ({
  items: many(intelligentScraperBatchItems),
  logs: many(intelligentScraperLogs),
}));

export const intelligentScraperBatchItemsRelations = relations(intelligentScraperBatchItems, ({ one }) => ({
  batch: one(intelligentScraperBatches, {
    fields: [intelligentScraperBatchItems.batchId],
    references: [intelligentScraperBatches.id],
  }),
  session: one(intelligentScraperSessions, {
    fields: [intelligentScraperBatchItems.sessionId],
    references: [intelligentScraperSessions.id],
  }),
}));

// ============================================================================
// Type exports
// ============================================================================
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventCategory = typeof eventCategories.$inferSelect;
export type LocalShop = typeof localShops.$inferSelect;
export type NewLocalShop = typeof localShops.$inferInsert;
export type ShopCategory = typeof shopCategories.$inferSelect;
export type CalendarSource = typeof calendarSources.$inferSelect;
export type NewCalendarSource = typeof calendarSources.$inferInsert;
export type ScrapingLog = typeof scrapingLogs.$inferSelect;
export type IntelligentScraperMethod = typeof intelligentScraperMethods.$inferSelect;
export type NewIntelligentScraperMethod = typeof intelligentScraperMethods.$inferInsert;
export type IntelligentScraperSession = typeof intelligentScraperSessions.$inferSelect;
export type NewIntelligentScraperSession = typeof intelligentScraperSessions.$inferInsert;
export type IntelligentScraperBatch = typeof intelligentScraperBatches.$inferSelect;
export type IntelligentScraperBatchItem = typeof intelligentScraperBatchItems.$inferSelect;
export type IntelligentScraperLog = typeof intelligentScraperLogs.$inferSelect;
