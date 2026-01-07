/**
 * Intelligent Scraper
 * LLM-powered event extraction with method learning and reuse
 */

import { db } from '$server/db';
import {
  intelligentScraperMethods,
  intelligentScraperSessions,
  intelligentScraperCache,
  intelligentScraperPatterns,
  intelligentScraperLogs,
  events,
  calendarSources,
} from '$server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { ScrapedEvent, IntelligentMethod, IntelligentSession } from './types';
import * as llm from '$server/services/llm';
import { geocodeYakimaArea } from '$server/services/geocode';

interface AnalyzeResult {
  success: boolean;
  sessionId?: number;
  events?: ScrapedEvent[];
  method?: IntelligentMethod;
  analysis?: llm.EventAnalysis;
  eventsSaved?: number;
  error?: string;
  usedExisting?: boolean;
}

interface ApproveResult {
  methodId: number;
  sourceId: number;
}

/**
 * Start a new intelligent scraping session
 */
export async function startSession(url: string, userId?: number): Promise<number> {
  const result = await db.insert(intelligentScraperSessions).values({
    url,
    createdBy: userId,
    status: 'analyzing',
  });

  return Number(result[0].insertId);
}

/**
 * Analyze a URL for events
 */
export async function analyzeUrl(url: string, userId?: number): Promise<AnalyzeResult> {
  let sessionId: number | undefined;

  try {
    // Check for existing method for this domain
    const existingMethod = await findExistingMethod(url);
    if (existingMethod) {
      const result = await applyExistingMethod(url, existingMethod);
      return {
        ...result,
        usedExisting: true,
      };
    }

    // Start new session
    sessionId = await startSession(url, userId);

    // Fetch webpage content
    const htmlContent = await fetchWebpage(url);
    if (!htmlContent) {
      await updateSession(sessionId, {
        status: 'error',
        errorMessage: 'Failed to fetch webpage content',
      });
      return {
        success: false,
        sessionId,
        error: 'Failed to fetch webpage content',
      };
    }

    // Store content in session
    await updateSession(sessionId, {
      pageContent: htmlContent.substring(0, 100000), // Limit storage
    });

    // Analyze with LLM
    const analysis = await llm.findEventPatterns(htmlContent, url);
    await updateSession(sessionId, {
      llmAnalysis: analysis as Record<string, unknown>,
    });

    if (!analysis || !analysis.hasEvents) {
      await updateSession(sessionId, { status: 'no_events' });
      return {
        success: false,
        sessionId,
        analysis: analysis || undefined,
        error: 'No events found on this page',
      };
    }

    // Extract events
    let events = extractEventsFromAnalysis(analysis, url);

    // If we found event links but no direct events, follow them
    if (events.length === 0 && analysis.eventLinks && analysis.eventLinks.length > 0) {
      events = await followEventLinks(analysis.eventLinks, url);
    }

    if (events.length === 0) {
      await updateSession(sessionId, { status: 'no_events' });
      return {
        success: false,
        sessionId,
        analysis,
        error: 'Could not extract event details',
      };
    }

    // Save events to database
    const savedCount = await saveEventsToDatabase(events, url);

    // Generate extraction method
    const method = await llm.generateExtractionMethod(htmlContent, analysis.eventsFound, url);

    await updateSession(sessionId, {
      foundEvents: events as unknown as Record<string, unknown>,
      status: 'events_found',
    });

    await logActivity(null, sessionId, 'info', `Found ${events.length} events`, url);

    return {
      success: true,
      sessionId,
      events,
      method: method ? {
        id: 0,
        name: `Auto-generated for ${new URL(url).hostname}`,
        domain: new URL(url).hostname,
        urlPattern: method.urlPattern,
        methodType: (method.type as IntelligentMethod['methodType']) || 'event_list',
        extractionRules: method as Record<string, unknown>,
        selectorMappings: method.selectors,
        active: false,
        usageCount: 0,
        successRate: 0,
        confidenceScore: method.confidence,
      } : undefined,
      analysis,
      eventsSaved: savedCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (sessionId) {
      await updateSession(sessionId, {
        status: 'error',
        errorMessage,
      });
    }

    await logActivity(null, sessionId, 'error', errorMessage, url);

    return {
      success: false,
      sessionId,
      error: errorMessage,
    };
  }
}

/**
 * Find existing method for URL domain
 */
async function findExistingMethod(url: string): Promise<IntelligentMethod | null> {
  const domain = new URL(url).hostname;

  const results = await db
    .select()
    .from(intelligentScraperMethods)
    .where(
      and(
        eq(intelligentScraperMethods.domain, domain),
        eq(intelligentScraperMethods.active, true)
      )
    )
    .orderBy(desc(intelligentScraperMethods.successRate))
    .limit(1);

  if (results.length === 0) return null;

  const row = results[0];
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    urlPattern: row.urlPattern || undefined,
    methodType: row.methodType,
    extractionRules: (row.extractionRules || {}) as Record<string, unknown>,
    selectorMappings: (row.selectorMappings || undefined) as Record<string, string> | undefined,
    postProcessing: (row.postProcessing || undefined) as Record<string, unknown> | undefined,
    llmModel: row.llmModel || undefined,
    confidenceScore: row.confidenceScore ? Number(row.confidenceScore) : undefined,
    testResults: (row.testResults || undefined) as Record<string, unknown> | undefined,
    active: row.active || false,
    approvedBy: row.approvedBy || undefined,
    usageCount: row.usageCount || 0,
    successRate: row.successRate ? Number(row.successRate) : 0,
  };
}

/**
 * Apply existing extraction method to URL
 */
async function applyExistingMethod(
  url: string,
  method: IntelligentMethod
): Promise<AnalyzeResult> {
  const htmlContent = await fetchWebpage(url);
  if (!htmlContent) {
    return {
      success: false,
      error: 'Failed to fetch webpage',
    };
  }

  // Use stored selectors/rules to extract events
  const analysis: llm.EventAnalysis = {
    hasEvents: true,
    eventType: method.methodType === 'event_list' ? 'list' : 'calendar',
    eventsFound: [],
    selectors: method.selectorMappings as llm.EventAnalysis['selectors'],
    patterns: method.postProcessing as llm.EventAnalysis['patterns'],
  };

  const events = extractEventsFromAnalysis(analysis, url);

  // Update method usage stats
  await updateMethodStats(method.id, events.length > 0);

  // Save events
  const savedCount = events.length > 0 ? await saveEventsToDatabase(events, url) : 0;

  return {
    success: events.length > 0,
    events,
    method,
    eventsSaved: savedCount,
    usedExisting: true,
  };
}

/**
 * Update method usage statistics
 */
async function updateMethodStats(methodId: number, success: boolean): Promise<void> {
  // Fetch current stats
  const results = await db
    .select({
      usageCount: intelligentScraperMethods.usageCount,
      successRate: intelligentScraperMethods.successRate,
    })
    .from(intelligentScraperMethods)
    .where(eq(intelligentScraperMethods.id, methodId))
    .limit(1);

  if (results.length === 0) return;

  const current = results[0];
  const usageCount = (current.usageCount || 0) + 1;
  const oldRate = Number(current.successRate || 0);
  const newRate = ((oldRate * (usageCount - 1)) + (success ? 100 : 0)) / usageCount;

  await db
    .update(intelligentScraperMethods)
    .set({
      usageCount,
      successRate: String(newRate.toFixed(2)),
      lastUsed: new Date(),
    })
    .where(eq(intelligentScraperMethods.id, methodId));
}

/**
 * Extract events from LLM analysis
 */
function extractEventsFromAnalysis(
  analysis: llm.EventAnalysis,
  baseUrl: string
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  if (!analysis.eventsFound || analysis.eventsFound.length === 0) {
    return events;
  }

  for (const rawEvent of analysis.eventsFound) {
    const event = normalizeEvent(rawEvent, baseUrl);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Normalize event data to standard format
 */
function normalizeEvent(
  rawEvent: llm.EventAnalysis['eventsFound'][0],
  baseUrl: string
): ScrapedEvent | null {
  if (!rawEvent.title) return null;

  // Parse date/time
  let startDatetime: Date | undefined;
  let endDatetime: Date | undefined;

  if (rawEvent.date) {
    const dateStr = rawEvent.time
      ? `${rawEvent.date} ${rawEvent.time}`
      : rawEvent.date;
    startDatetime = parseDateTime(dateStr);
  }

  if (!startDatetime) {
    // Default to tomorrow if no date found
    startDatetime = new Date();
    startDatetime.setDate(startDatetime.getDate() + 1);
    startDatetime.setHours(12, 0, 0, 0);
  }

  // Resolve relative URL
  let externalUrl = rawEvent.link || '';
  if (externalUrl && !externalUrl.startsWith('http')) {
    try {
      externalUrl = new URL(externalUrl, baseUrl).href;
    } catch {
      externalUrl = baseUrl;
    }
  }

  return {
    title: rawEvent.title,
    description: rawEvent.description,
    startDatetime,
    endDatetime,
    location: rawEvent.location,
    externalUrl: externalUrl || baseUrl,
  };
}

/**
 * Follow event links to get full details
 */
async function followEventLinks(
  links: string[],
  baseUrl: string
): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];
  const maxLinks = 5; // Limit to prevent too many requests

  for (const link of links.slice(0, maxLinks)) {
    try {
      const fullUrl = link.startsWith('http') ? link : new URL(link, baseUrl).href;
      const eventHtml = await fetchWebpage(fullUrl);

      if (eventHtml) {
        const eventData = await llm.analyzeEventPage(eventHtml, fullUrl);
        if (eventData) {
          const normalized = normalizeEvent({ ...eventData, link: fullUrl }, baseUrl);
          if (normalized) {
            events.push(normalized);
          }
        }
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`[IntelligentScraper] Error following link ${link}:`, error);
    }
  }

  return events;
}

/**
 * Save events to database
 */
async function saveEventsToDatabase(
  eventList: ScrapedEvent[],
  sourceUrl: string
): Promise<number> {
  let savedCount = 0;

  for (const event of eventList) {
    try {
      // Check for duplicates
      const existing = await db
        .select({ id: events.id })
        .from(events)
        .where(
          and(
            eq(events.title, event.title),
            eq(events.startDatetime, event.startDatetime)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        continue; // Skip duplicate
      }

      // Geocode if we have a location
      let latitude: string | undefined;
      let longitude: string | undefined;

      if (event.location || event.address) {
        const coords = await geocodeYakimaArea(event.address || event.location || '');
        if (coords) {
          latitude = String(coords.lat);
          longitude = String(coords.lng);
        }
      }

      // Insert event
      await db.insert(events).values({
        title: event.title,
        description: event.description || null,
        startDatetime: event.startDatetime,
        endDatetime: event.endDatetime || null,
        location: event.location || null,
        address: event.address || event.location || null,
        latitude: latitude || null,
        longitude: longitude || null,
        contactInfo: event.contactInfo ? JSON.stringify(event.contactInfo) : null,
        externalUrl: event.externalUrl || sourceUrl,
        status: 'pending', // AI-scraped events start as pending
      });

      savedCount++;
    } catch (error) {
      console.error('[IntelligentScraper] Error saving event:', error);
    }
  }

  return savedCount;
}

/**
 * Approve session and create calendar source
 */
export async function approveSession(
  sessionId: number,
  userId?: number
): Promise<ApproveResult> {
  // Get session data
  const sessions = await db
    .select()
    .from(intelligentScraperSessions)
    .where(eq(intelligentScraperSessions.id, sessionId))
    .limit(1);

  if (sessions.length === 0 || sessions[0].status !== 'events_found') {
    throw new Error('Invalid session or no events found');
  }

  const session = sessions[0];
  const analysis = session.llmAnalysis as llm.EventAnalysis | null;
  const foundEvents = session.foundEvents as ScrapedEvent[] | null;

  // Generate method from session data
  const domain = new URL(session.url).hostname;
  const methodName = `Auto-generated method for ${domain}`;

  // Save method
  const methodResult = await db.insert(intelligentScraperMethods).values({
    name: methodName,
    domain,
    urlPattern: generateUrlPattern(session.url),
    methodType: 'event_list',
    extractionRules: analysis || {},
    selectorMappings: analysis?.selectors || null,
    postProcessing: analysis?.patterns || null,
    llmModel: 'kimi-k2',
    confidenceScore: '0.80',
    testResults: { eventsFound: foundEvents?.length || 0 },
    active: true,
    approvedBy: userId,
  });

  const methodId = Number(methodResult[0].insertId);

  // Update session
  await db
    .update(intelligentScraperSessions)
    .set({
      methodId,
      status: 'approved',
      completedAt: new Date(),
    })
    .where(eq(intelligentScraperSessions.id, sessionId));

  // Create calendar source
  const sourceResult = await db.insert(calendarSources).values({
    name: methodName,
    url: session.url,
    scrapeType: 'intelligent',
    intelligentMethodId: methodId,
    active: true,
    createdBy: userId,
  });

  const sourceId = Number(sourceResult[0].insertId);

  await logActivity(null, sessionId, 'info', `Approved session, created source ${sourceId}`, session.url);

  return {
    methodId,
    sourceId,
  };
}

/**
 * Update session data
 */
async function updateSession(
  sessionId: number,
  data: Partial<{
    pageContent: string;
    llmAnalysis: Record<string, unknown>;
    foundEvents: Record<string, unknown>;
    status: string;
    errorMessage: string;
    methodId: number;
    completedAt: Date;
  }>
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (data.pageContent !== undefined) updateData.pageContent = data.pageContent;
  if (data.llmAnalysis !== undefined) updateData.llmAnalysis = data.llmAnalysis;
  if (data.foundEvents !== undefined) updateData.foundEvents = data.foundEvents;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
  if (data.methodId !== undefined) updateData.methodId = data.methodId;
  if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

  await db
    .update(intelligentScraperSessions)
    .set(updateData)
    .where(eq(intelligentScraperSessions.id, sessionId));
}

/**
 * Log activity
 */
async function logActivity(
  batchId: number | null,
  sessionId: number | null | undefined,
  level: 'debug' | 'info' | 'warning' | 'error',
  message: string,
  url?: string
): Promise<void> {
  await db.insert(intelligentScraperLogs).values({
    batchId,
    sessionId,
    level,
    message,
    url,
  });
}

/**
 * Fetch webpage content
 */
async function fetchWebpage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(`[IntelligentScraper] HTTP ${response.status} for ${url}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`[IntelligentScraper] Fetch error for ${url}:`, error);
    return null;
  }
}

/**
 * Parse datetime string
 */
function parseDateTime(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  // Try native parsing
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try common formats
  const formats = [
    /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\s*(?:at\s*)?(\d{1,2}):?(\d{2})?\s*(am|pm)?/i,
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i,
  ];

  for (const pattern of formats) {
    const match = dateStr.match(pattern);
    if (match) {
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {
        // Continue trying
      }
    }
  }

  return undefined;
}

/**
 * Generate URL pattern from example
 */
function generateUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    let pattern = `${parsed.protocol}//${parsed.hostname}`;

    if (parsed.pathname) {
      const path = parsed.pathname.replace(/\d+/g, '*');
      pattern += path;
    }

    return pattern;
  } catch {
    return url;
  }
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: number): Promise<IntelligentSession | null> {
  const results = await db
    .select()
    .from(intelligentScraperSessions)
    .where(eq(intelligentScraperSessions.id, sessionId))
    .limit(1);

  if (results.length === 0) return null;

  const row = results[0];
  return {
    id: row.id,
    url: row.url,
    pageContent: row.pageContent || undefined,
    llmAnalysis: (row.llmAnalysis || undefined) as Record<string, unknown> | undefined,
    foundEvents: (row.foundEvents || undefined) as ScrapedEvent[] | undefined,
    methodId: row.methodId || undefined,
    status: row.status || 'analyzing',
    errorMessage: row.errorMessage || undefined,
    userFeedback: row.userFeedback || undefined,
    createdBy: row.createdBy || undefined,
    createdAt: row.createdAt || new Date(),
    completedAt: row.completedAt || undefined,
  };
}

/**
 * Get recent sessions
 */
export async function getRecentSessions(
  limit: number = 20
): Promise<IntelligentSession[]> {
  const results = await db
    .select()
    .from(intelligentScraperSessions)
    .orderBy(desc(intelligentScraperSessions.createdAt))
    .limit(limit);

  return results.map((row) => ({
    id: row.id,
    url: row.url,
    status: row.status || 'analyzing',
    createdAt: row.createdAt || new Date(),
    completedAt: row.completedAt || undefined,
    foundEvents: (row.foundEvents || undefined) as ScrapedEvent[] | undefined,
  }));
}

/**
 * Check if intelligent scraping is available
 */
export function isAvailable(): boolean {
  return llm.isAvailable();
}
