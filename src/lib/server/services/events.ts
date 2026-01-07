import { db, events, eventCategories, eventCategoryMapping, eventImages, calendarSources } from '$server/db';
import { eq, and, gte, lte, sql, desc, asc, like, or, inArray } from 'drizzle-orm';
import type { Event, NewEvent } from '$server/db/schema';

export interface EventFilters {
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'approved' | 'rejected';
  category?: string;
  featured?: boolean;
  search?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // in miles
  limit?: number;
  offset?: number;
  includeUnapproved?: boolean;
}

export interface EventWithDetails extends Event {
  categories?: string;
  sourceName?: string;
  sourceUrl?: string;
  primaryImageUrl?: string;
  distance?: number;
}

/**
 * Get events with optional filtering
 */
export async function getEvents(filters: EventFilters = {}): Promise<EventWithDetails[]> {
  const conditions = [];

  // Status filter
  if (filters.status) {
    conditions.push(eq(events.status, filters.status));
  } else if (filters.includeUnapproved) {
    conditions.push(or(eq(events.status, 'approved'), eq(events.status, 'pending')));
  } else {
    conditions.push(eq(events.status, 'approved'));
  }

  // Date range filter
  if (filters.startDate) {
    conditions.push(gte(events.startDatetime, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(events.startDatetime, new Date(filters.endDate)));
  }

  // Featured filter
  if (filters.featured !== undefined) {
    conditions.push(eq(events.featured, filters.featured));
  }

  // Build base query
  let query = db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startDatetime: events.startDatetime,
      endDatetime: events.endDatetime,
      location: events.location,
      address: events.address,
      latitude: events.latitude,
      longitude: events.longitude,
      contactInfo: events.contactInfo,
      externalUrl: events.externalUrl,
      sourceId: events.sourceId,
      externalEventId: events.externalEventId,
      status: events.status,
      featured: events.featured,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      sourceName: calendarSources.name,
      sourceUrl: calendarSources.url,
    })
    .from(events)
    .leftJoin(calendarSources, eq(events.sourceId, calendarSources.id))
    .where(and(...conditions))
    .orderBy(asc(events.startDatetime));

  // Apply pagination
  if (filters.limit) {
    query = query.limit(filters.limit) as typeof query;
  }
  if (filters.offset) {
    query = query.offset(filters.offset) as typeof query;
  }

  const results = await query;

  return results as EventWithDetails[];
}

/**
 * Get today's events
 */
export async function getTodaysEvents(): Promise<EventWithDetails[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getEvents({
    startDate: today.toISOString(),
    endDate: tomorrow.toISOString(),
    status: 'approved',
  });
}

/**
 * Get events near a location
 */
export async function getNearbyEvents(
  latitude: number,
  longitude: number,
  radiusMiles: number = 10
): Promise<EventWithDetails[]> {
  // Haversine formula for distance calculation
  const radiusKm = radiusMiles * 1.60934;

  const results = await db.execute(sql`
    SELECT
      e.*,
      cs.name as source_name,
      cs.url as source_url,
      (6371 * acos(
        cos(radians(${latitude})) * cos(radians(e.latitude)) *
        cos(radians(e.longitude) - radians(${longitude})) +
        sin(radians(${latitude})) * sin(radians(e.latitude))
      )) AS distance
    FROM events e
    LEFT JOIN calendar_sources cs ON e.source_id = cs.id
    WHERE e.status = 'approved'
      AND e.latitude IS NOT NULL
      AND e.longitude IS NOT NULL
      AND e.start_datetime >= NOW()
    HAVING distance <= ${radiusKm}
    ORDER BY distance ASC, e.start_datetime ASC
  `);

  return results[0] as EventWithDetails[];
}

/**
 * Get event by ID
 */
export async function getEventById(id: number): Promise<EventWithDetails | null> {
  const result = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startDatetime: events.startDatetime,
      endDatetime: events.endDatetime,
      location: events.location,
      address: events.address,
      latitude: events.latitude,
      longitude: events.longitude,
      contactInfo: events.contactInfo,
      externalUrl: events.externalUrl,
      sourceId: events.sourceId,
      externalEventId: events.externalEventId,
      status: events.status,
      featured: events.featured,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      sourceName: calendarSources.name,
      sourceUrl: calendarSources.url,
    })
    .from(events)
    .leftJoin(calendarSources, eq(events.sourceId, calendarSources.id))
    .where(eq(events.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const event = result[0];

  // Get categories
  const categoryMappings = await db
    .select({ name: eventCategories.name })
    .from(eventCategoryMapping)
    .innerJoin(eventCategories, eq(eventCategoryMapping.categoryId, eventCategories.id))
    .where(eq(eventCategoryMapping.eventId, id));

  return {
    ...event,
    categories: categoryMappings.map(c => c.name).join(', '),
  } as EventWithDetails;
}

/**
 * Create a new event
 */
export async function createEvent(data: NewEvent): Promise<number> {
  const result = await db.insert(events).values({
    ...data,
    status: data.status || 'pending',
  });

  return Number(result[0].insertId);
}

/**
 * Update an event
 */
export async function updateEvent(id: number, data: Partial<NewEvent>): Promise<boolean> {
  const result = await db
    .update(events)
    .set(data)
    .where(eq(events.id, id));

  return result[0].affectedRows > 0;
}

/**
 * Delete an event
 */
export async function deleteEvent(id: number): Promise<boolean> {
  // Delete category mappings first
  await db.delete(eventCategoryMapping).where(eq(eventCategoryMapping.eventId, id));

  // Delete images
  await db.delete(eventImages).where(eq(eventImages.eventId, id));

  // Delete event
  const result = await db.delete(events).where(eq(events.id, id));

  return result[0].affectedRows > 0;
}

/**
 * Approve an event
 */
export async function approveEvent(id: number): Promise<boolean> {
  return updateEvent(id, { status: 'approved' });
}

/**
 * Reject an event
 */
export async function rejectEvent(id: number): Promise<boolean> {
  return updateEvent(id, { status: 'rejected' });
}

/**
 * Get all event categories
 */
export async function getEventCategories() {
  return db
    .select()
    .from(eventCategories)
    .where(eq(eventCategories.active, true))
    .orderBy(asc(eventCategories.sortOrder), asc(eventCategories.name));
}

/**
 * Find duplicate events
 */
export async function findDuplicates(
  title: string,
  startDatetime: Date,
  latitude?: number,
  longitude?: number
): Promise<Event[]> {
  const results = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.title, title),
        eq(events.startDatetime, startDatetime)
      )
    );

  return results;
}
