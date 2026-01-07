/**
 * Scraper Types
 */

export type ScrapeType = 'ical' | 'html' | 'json' | 'rss' | 'yakima_valley' | 'intelligent' | 'firecrawl' | 'eventbrite' | 'facebook';

export interface ScrapedEvent {
  title: string;
  description?: string;
  startDatetime: Date;
  endDatetime?: Date;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  externalUrl?: string;
  externalEventId?: string;
  categories?: string[];
  contactInfo?: Record<string, unknown>;
}

export interface ScrapeConfig {
  // HTML scraping selectors
  selectors?: {
    eventContainer: string;
    title?: string;
    description?: string;
    datetime?: string;
    location?: string;
    url?: string;
    image?: string;
  };
  // JSON path mappings
  eventsPath?: string;
  fieldMapping?: Record<string, string>;
  // General options
  baseUrl?: string;
  year?: number;
  timezone?: string;
  // Firecrawl options
  firecrawlMethod?: 'structured' | 'search' | 'basic';
  fallbackType?: ScrapeType;
  searchQuery?: string;
}

export interface CalendarSource {
  id: number;
  name: string;
  url: string;
  scrapeType: ScrapeType;
  scrapeConfig: ScrapeConfig | null;
  intelligentMethodId?: number | null;
  active: boolean;
  lastScraped: Date | null;
  createdBy?: number | null;
}

export interface ScrapeResult {
  success: boolean;
  sourceId: number;
  sourceName: string;
  eventsFound: number;
  eventsAdded: number;
  duplicatesSkipped: number;
  error?: string;
  durationMs: number;
}

export interface ScrapingLog {
  id: number;
  sourceId: number;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed';
  eventsFound: number;
  eventsAdded: number;
  duplicatesSkipped: number;
  errorMessage?: string;
  durationMs?: number;
}

// Intelligent Scraper Types
export interface IntelligentMethod {
  id: number;
  name: string;
  domain: string;
  urlPattern?: string;
  methodType: 'event_list' | 'event_detail' | 'combined';
  extractionRules: Record<string, unknown>;
  selectorMappings?: Record<string, string>;
  postProcessing?: Record<string, unknown>;
  llmModel?: string;
  confidenceScore?: number;
  testResults?: Record<string, unknown>;
  active: boolean;
  approvedBy?: number;
  usageCount: number;
  successRate: number;
}

export interface IntelligentSession {
  id: number;
  url: string;
  pageContent?: string;
  llmAnalysis?: Record<string, unknown>;
  foundEvents?: ScrapedEvent[];
  methodId?: number;
  status: 'analyzing' | 'events_found' | 'no_events' | 'error' | 'approved';
  errorMessage?: string;
  userFeedback?: string;
  createdBy?: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface IntelligentBatch {
  id: number;
  filename?: string;
  totalUrls: number;
  processedUrls: number;
  successCount: number;
  errorCount: number;
  totalEvents: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdBy?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IntelligentBatchItem {
  id: number;
  batchId: number;
  title?: string;
  url: string;
  sessionId?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  eventsFound: number;
  errorMessage?: string;
  processedAt?: Date;
}
