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
  startDatetime: datetime('start_datetime', { mode: 'string' }).notNull(),
  endDatetime: datetime('end_datetime', { mode: 'string' }),
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
  // Collaboration fields
  primaryShopId: int('primary_shop_id'),
  createdByUserId: int('created_by_user_id'),
  isCollaborative: boolean('is_collaborative').default(false),
  proposalStatus: varchar('proposal_status', { length: 30 }),
  proposalCreatedAt: timestamp('proposal_created_at'),
  proposalApprovedAt: timestamp('proposal_approved_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  statusIdx: index('idx_events_status').on(table.status),
  startDatetimeIdx: index('idx_events_start').on(table.startDatetime),
  locationIdx: index('idx_events_location').on(table.latitude, table.longitude),
  primaryShopIdx: index('idx_primary_shop').on(table.primaryShopId),
  createdByIdx: index('idx_created_by').on(table.createdByUserId),
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
// Users Table
// ============================================================================
export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  username: varchar('username', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  firstName: varchar('first_name', { length: 50 }),
  lastName: varchar('last_name', { length: 50 }),
  role: mysqlEnum('role', ['admin', 'moderator', 'user']).default('user'),
  isSeller: boolean('is_seller').default(false),
  isBusinessOwner: boolean('is_business_owner').default(false),
  isYfVendor: boolean('is_yf_vendor').default(false),
  isYfStaff: boolean('is_yf_staff').default(false),
  isYfAssociate: boolean('is_yf_associate').default(false),
  isWebcatUser: boolean('is_webcat_user').default(false),
  sellerId: int('seller_id'),
  shopId: int('shop_id'),
  status: mysqlEnum('status', ['active', 'inactive', 'banned']).default('active'),
  emailVerified: boolean('email_verified').default(false),
  verificationToken: varchar('verification_token', { length: 255 }),
  resetToken: varchar('reset_token', { length: 255 }),
  resetExpires: datetime('reset_expires'),
  lastLogin: datetime('last_login'),
  loginAttempts: int('login_attempts').default(0),
  lockedUntil: datetime('locked_until'),
  // Google OAuth fields
  googleId: varchar('google_id', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  authProvider: varchar('auth_provider', { length: 20 }).default('local'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  usernameIdx: index('idx_username').on(table.username),
  emailIdx: index('idx_email').on(table.email),
  statusIdx: index('idx_status').on(table.status),
  roleIdx: index('idx_role').on(table.role),
  googleIdIdx: index('idx_google_id').on(table.googleId),
}));

// ============================================================================
// User Sessions Table
// ============================================================================
export const userSessions = mysqlTable('user_sessions', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: int('user_id').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  isActive: boolean('is_active').default(true),
}, (table) => ({
  userIdx: index('idx_user').on(table.userId),
  expiresIdx: index('idx_expires').on(table.expiresAt),
}));

// ============================================================================
// Shop Staff Table
// ============================================================================
export const shopStaff = mysqlTable('shop_staff', {
  id: int('id').primaryKey().autoincrement(),
  shopId: int('shop_id').notNull(),
  userId: int('user_id').notNull(),
  role: mysqlEnum('role', ['admin', 'staff']).default('staff').notNull(),
  canEditShop: boolean('can_edit_shop').default(true),
  canCreateEvents: boolean('can_create_events').default(true),
  canPostDiscussions: boolean('can_post_discussions').default(true),
  canManageStaff: boolean('can_manage_staff').default(false),
  invitedByUserId: int('invited_by_user_id'),
  inviteEmail: varchar('invite_email', { length: 255 }),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  revokedAt: timestamp('revoked_at'),
  revokedByUserId: int('revoked_by_user_id'),
}, (table) => ({
  shopIdx: index('idx_shop').on(table.shopId),
  userIdx: index('idx_user').on(table.userId),
  roleIdx: index('idx_role').on(table.role),
  revokedIdx: index('idx_revoked').on(table.revokedAt),
}));

// ============================================================================
// Shop Staff Invites Table
// ============================================================================
export const shopStaffInvites = mysqlTable('shop_staff_invites', {
  id: int('id').primaryKey().autoincrement(),
  shopId: int('shop_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['admin', 'staff']).default('staff').notNull(),
  canEditShop: boolean('can_edit_shop').default(true),
  canCreateEvents: boolean('can_create_events').default(true),
  canPostDiscussions: boolean('can_post_discussions').default(true),
  canManageStaff: boolean('can_manage_staff').default(false),
  inviteToken: varchar('invite_token', { length: 100 }).notNull(),
  invitedByUserId: int('invited_by_user_id').notNull(),
  message: text('message'),
  status: mysqlEnum('status', ['pending', 'accepted', 'expired', 'cancelled']).default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  acceptedByUserId: int('accepted_by_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  shopIdx: index('idx_shop').on(table.shopId),
  emailIdx: index('idx_email').on(table.email),
  tokenIdx: index('idx_token').on(table.inviteToken),
  statusIdx: index('idx_status').on(table.status),
  expiresIdx: index('idx_expires').on(table.expiresAt),
}));

// ============================================================================
// Shop Claim Requests Table
// ============================================================================
export const shopClaimRequests = mysqlTable('shop_claim_requests', {
  id: int('id').primaryKey().autoincrement(),
  shopId: int('shop_id'),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  businessAddress: varchar('business_address', { length: 500 }),
  businessDescription: text('business_description'),
  businessWebsite: varchar('business_website', { length: 500 }),
  businessPhone: varchar('business_phone', { length: 50 }),
  requesterName: varchar('requester_name', { length: 255 }).notNull(),
  requesterEmail: varchar('requester_email', { length: 255 }).notNull(),
  requesterPhone: varchar('requester_phone', { length: 50 }),
  relationshipToBusiness: varchar('relationship_to_business', { length: 100 }),
  ownershipProof: text('ownership_proof'),
  applicantNotes: text('applicant_notes'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  referrerUrl: varchar('referrer_url', { length: 500 }),
  claimType: mysqlEnum('claim_type', ['existing', 'new', 'existing_shop', 'new_shop']).default('existing_shop'),
  status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending'),
  adminNotes: text('admin_notes'),
  reviewedAt: datetime('reviewed_at'),
  reviewedBy: varchar('reviewed_by', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  shopIdx: index('idx_shop').on(table.shopId),
  statusIdx: index('idx_status').on(table.status),
}));

// ============================================================================
// Event Shop Participants Table (Collaborative Events)
// ============================================================================
export const eventShopParticipants = mysqlTable('event_shop_participants', {
  id: int('id').primaryKey().autoincrement(),
  eventId: int('event_id').notNull(),
  shopId: int('shop_id').notNull(),
  approvalStatus: mysqlEnum('approval_status', ['pending', 'approved', 'rejected']).default('pending'),
  approvedByUserId: int('approved_by_user_id'),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  participationRole: mysqlEnum('participation_role', ['co_host', 'sponsor', 'venue', 'partner']).default('co_host'),
  displayOrder: int('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  eventIdx: index('idx_event').on(table.eventId),
  shopIdx: index('idx_shop').on(table.shopId),
  statusIdx: index('idx_status').on(table.approvalStatus),
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
  // Collaboration relations
  primaryShop: one(localShops, {
    fields: [events.primaryShopId],
    references: [localShops.id],
  }),
  createdByUser: one(users, {
    fields: [events.createdByUserId],
    references: [users.id],
  }),
  participantShops: many(eventShopParticipants),
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
  // Collaboration relations
  owner: one(users, {
    fields: [localShops.ownerId],
    references: [users.id],
  }),
  staff: many(shopStaff),
  staffInvites: many(shopStaffInvites),
  claimRequests: many(shopClaimRequests),
  eventParticipations: many(eventShopParticipants),
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
// User Relations
// ============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSessions),
  shopStaffMemberships: many(shopStaff),
  eventsCreated: many(events),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// Shop Staff Relations
// ============================================================================
export const shopStaffRelations = relations(shopStaff, ({ one }) => ({
  shop: one(localShops, {
    fields: [shopStaff.shopId],
    references: [localShops.id],
  }),
  user: one(users, {
    fields: [shopStaff.userId],
    references: [users.id],
  }),
  invitedBy: one(users, {
    fields: [shopStaff.invitedByUserId],
    references: [users.id],
  }),
  revokedBy: one(users, {
    fields: [shopStaff.revokedByUserId],
    references: [users.id],
  }),
}));

export const shopStaffInvitesRelations = relations(shopStaffInvites, ({ one }) => ({
  shop: one(localShops, {
    fields: [shopStaffInvites.shopId],
    references: [localShops.id],
  }),
  invitedBy: one(users, {
    fields: [shopStaffInvites.invitedByUserId],
    references: [users.id],
  }),
  acceptedBy: one(users, {
    fields: [shopStaffInvites.acceptedByUserId],
    references: [users.id],
  }),
}));

// ============================================================================
// Shop Claim Relations
// ============================================================================
export const shopClaimRequestsRelations = relations(shopClaimRequests, ({ one }) => ({
  shop: one(localShops, {
    fields: [shopClaimRequests.shopId],
    references: [localShops.id],
  }),
}));

// ============================================================================
// Event Shop Participants Relations
// ============================================================================
export const eventShopParticipantsRelations = relations(eventShopParticipants, ({ one }) => ({
  event: one(events, {
    fields: [eventShopParticipants.eventId],
    references: [events.id],
  }),
  shop: one(localShops, {
    fields: [eventShopParticipants.shopId],
    references: [localShops.id],
  }),
  approvedBy: one(users, {
    fields: [eventShopParticipants.approvedByUserId],
    references: [users.id],
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

// User types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

// Shop staff types
export type ShopStaff = typeof shopStaff.$inferSelect;
export type NewShopStaff = typeof shopStaff.$inferInsert;
export type ShopStaffInvite = typeof shopStaffInvites.$inferSelect;
export type NewShopStaffInvite = typeof shopStaffInvites.$inferInsert;

// Shop claim types
export type ShopClaimRequest = typeof shopClaimRequests.$inferSelect;
export type NewShopClaimRequest = typeof shopClaimRequests.$inferInsert;

// Collaborative event types
export type EventShopParticipant = typeof eventShopParticipants.$inferSelect;
export type NewEventShopParticipant = typeof eventShopParticipants.$inferInsert;
