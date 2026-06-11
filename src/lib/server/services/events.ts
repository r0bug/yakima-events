import { db, events, eventCategories, eventCategoryMapping, eventImages, calendarSources, eventShopParticipants, localShops } from '$server/db';
import { eq, and, gte, lte, sql, desc, asc, like, or, inArray } from 'drizzle-orm';
import type { Event, NewEvent } from '$server/db/schema';
import { toPacificDatetime, pacificToday } from '$server/datetime';

export interface EventFilters {
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'approved' | 'rejected';
  category?: string;
  includeCategories?: string[]; // slugs — only show events in these categories
  excludeCategories?: string[]; // slugs — hide events in these categories
  featured?: boolean;
  search?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // in miles
  limit?: number;
  offset?: number;
  includeUnapproved?: boolean;
}

export interface CategoryDetail {
  name: string;
  slug: string;
  color: string | null;
}

export interface ShopLink {
  id: number;
  name: string;
  slug?: string;
  imageUrl?: string | null;
}

export interface EventWithDetails extends Event {
  categories?: string;
  categoryDetails?: CategoryDetail[];
  sourceName?: string;
  sourceUrl?: string;
  primaryImageUrl?: string;
  distance?: number;
  linkedShop?: ShopLink;
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

  // Date range filter - dates stored as Pacific time strings (YYYY-MM-DD HH:MM:SS)
  if (filters.startDate) {
    const startDateStr = toPacificDatetime(new Date(filters.startDate));
    conditions.push(gte(events.startDatetime, startDateStr));
  }
  if (filters.endDate) {
    const endDateStr = toPacificDatetime(new Date(filters.endDate));
    conditions.push(lte(events.startDatetime, endDateStr));
  }

  // Featured filter
  if (filters.featured !== undefined) {
    conditions.push(eq(events.featured, filters.featured));
  }

  // Search filter — title, location, description, address
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(or(
      like(events.title, searchTerm),
      like(events.location, searchTerm),
      like(events.description, searchTerm),
      like(events.address, searchTerm)
    ));
  }

  // Category filter — match by slug via subquery on mapping table
  if (filters.category) {
    conditions.push(
      inArray(
        events.id,
        db.select({ eventId: eventCategoryMapping.eventId })
          .from(eventCategoryMapping)
          .innerJoin(eventCategories, eq(eventCategoryMapping.categoryId, eventCategories.id))
          .where(eq(eventCategories.slug, filters.category))
      )
    );
  }

  // Include categories — event must be in at least one of these
  if (filters.includeCategories?.length) {
    conditions.push(
      inArray(
        events.id,
        db.select({ eventId: eventCategoryMapping.eventId })
          .from(eventCategoryMapping)
          .innerJoin(eventCategories, eq(eventCategoryMapping.categoryId, eventCategories.id))
          .where(inArray(eventCategories.slug, filters.includeCategories))
      )
    );
  }

  // Exclude categories — event must NOT be in any of these
  if (filters.excludeCategories?.length) {
    conditions.push(
      sql`${events.id} NOT IN (
        SELECT ecm.event_id FROM event_category_mapping ecm
        JOIN event_categories ec ON ecm.category_id = ec.id
        WHERE ec.slug IN (${sql.join(filters.excludeCategories.map(s => sql`${s}`), sql`,`)})
      )`
    );
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

  // Enrich with category details (colors) via batch query
  if (results.length > 0) {
    const eventIds = results.map((r: any) => r.id);
    const categoryRows = await db
      .select({
        eventId: eventCategoryMapping.eventId,
        name: eventCategories.name,
        slug: eventCategories.slug,
        color: eventCategories.color,
      })
      .from(eventCategoryMapping)
      .innerJoin(eventCategories, eq(eventCategoryMapping.categoryId, eventCategories.id))
      .where(inArray(eventCategoryMapping.eventId, eventIds));

    // Group by event ID
    const catsByEvent = new Map<number, CategoryDetail[]>();
    for (const row of categoryRows) {
      if (!catsByEvent.has(row.eventId)) catsByEvent.set(row.eventId, []);
      catsByEvent.get(row.eventId)!.push({ name: row.name, slug: row.slug, color: row.color });
    }

    // Attach to results
    for (const event of results as any[]) {
      const cats = catsByEvent.get(event.id);
      if (cats) {
        event.categoryDetails = cats;
        event.categories = cats.map((c: CategoryDetail) => c.name).join(', ');
      }
    }

    // Enrich with linked shop data
    const shopLinks = await db
      .select({
        eventId: eventShopParticipants.eventId,
        shopId: localShops.id,
        shopName: localShops.name,
        shopImage: localShops.imageUrl,
      })
      .from(eventShopParticipants)
      .innerJoin(localShops, eq(eventShopParticipants.shopId, localShops.id))
      .where(and(
        inArray(eventShopParticipants.eventId, eventIds),
        eq(eventShopParticipants.approvalStatus, 'approved')
      ));

    if (shopLinks.length > 0) {
      const shopByEvent = new Map<number, ShopLink>();
      for (const row of shopLinks) {
        if (!shopByEvent.has(row.eventId)) {
          shopByEvent.set(row.eventId, {
            id: row.shopId,
            name: row.shopName,
            imageUrl: row.shopImage,
          });
        }
      }
      for (const event of results as any[]) {
        const shop = shopByEvent.get(event.id);
        if (shop) event.linkedShop = shop;
      }
    }
  }

  return results as EventWithDetails[];
}

/**
 * Get today's events (Pacific time)
 */
export async function getTodaysEvents(): Promise<EventWithDetails[]> {
  const { start, end } = pacificToday();

  return getEvents({
    startDate: start,
    endDate: end,
    status: 'approved',
  });
}

export interface TonightFilters {
  latitude?: number;
  longitude?: number;
  radius?: number; // miles, default 50
  limit?: number; // default 20
  category?: string;
}

/**
 * Get tonight's events, optionally sorted by proximity.
 *
 * "Tonight" in Pacific time:
 *   After 5am: now through 23:59 today
 *   Before 5am: 00:00 through 23:59 today (late-night use)
 */
export async function getTonightEvents(filters: TonightFilters = {}): Promise<EventWithDetails[]> {
  const now = new Date();
  const nowPacific = toPacificDatetime(now);
  const todayDate = nowPacific.slice(0, 10);
  const hour = parseInt(nowPacific.slice(11, 13), 10);

  // After 5am: from now to end of day. Before 5am: from midnight to end of day.
  const startStr = hour >= 5 ? nowPacific : `${todayDate} 00:00:00`;
  const endStr = `${todayDate} 23:59:59`;

  const limit = filters.limit || 20;
  const hasGeo = filters.latitude != null && filters.longitude != null;
  const radiusKm = (filters.radius || 50) * 1.60934;

  if (hasGeo) {
    // Proximity-sorted query with Haversine
    const results = await db.execute(sql`
      SELECT
        e.*,
        cs.name as source_name,
        cs.url as source_url,
        (6371 * acos(
          cos(radians(${filters.latitude!})) * cos(radians(e.latitude)) *
          cos(radians(e.longitude) - radians(${filters.longitude!})) +
          sin(radians(${filters.latitude!})) * sin(radians(e.latitude))
        )) AS distance
      FROM events e
      LEFT JOIN calendar_sources cs ON e.source_id = cs.id
      WHERE e.status = 'approved'
        AND e.start_datetime >= ${startStr}
        AND e.start_datetime <= ${endStr}
        ${filters.category ? sql`AND e.id IN (
          SELECT ecm.event_id FROM event_category_mapping ecm
          JOIN event_categories ec ON ecm.category_id = ec.id
          WHERE ec.slug = ${filters.category}
        )` : sql``}
      HAVING distance <= ${radiusKm} OR e.latitude IS NULL
      ORDER BY distance ASC, e.start_datetime ASC
      LIMIT ${limit}
    `);

    return (results[0] as any[]).map(r => ({
      ...r,
      startDatetime: r.start_datetime,
      endDatetime: r.end_datetime,
      contactInfo: r.contact_info,
      externalUrl: r.external_url,
      sourceId: r.source_id,
      externalEventId: r.external_event_id,
      sourceName: r.source_name,
      sourceUrl: r.source_url,
      distance: r.distance,
    })) as EventWithDetails[];
  }

  // No geo: time-sorted via getEvents
  return getEvents({
    startDate: startStr,
    endDate: endStr,
    status: 'approved',
    category: filters.category,
    limit,
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
      AND e.start_datetime >= ${toPacificDatetime(new Date())}
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
    .orderBy(asc(eventCategories.name));
}

/**
 * Find duplicate events
 */
export async function findDuplicates(
  title: string,
  startDatetime: Date | string,
  latitude?: number,
  longitude?: number
): Promise<Event[]> {
  const dateStr = typeof startDatetime === 'string'
    ? startDatetime
    : toPacificDatetime(startDatetime);

  const results = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.title, title),
        eq(events.startDatetime, dateStr)
      )
    );

  return results;
}
