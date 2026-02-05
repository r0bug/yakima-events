/**
 * Collaborative Events Service
 * Handles multi-shop event proposals and approval workflows
 */

import { db } from '$lib/server/db';
import { events, eventShopParticipants, localShops, users, shopStaff } from '$lib/server/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import type { Event, EventShopParticipant } from '$lib/server/db/schema';

export interface EventProposal {
  title: string;
  description?: string;
  startDatetime: Date;
  endDatetime?: Date;
  location?: string;
  address?: string;
  externalUrl?: string;
  contactInfo?: Record<string, unknown>;
  primaryShopId: number;
  participantShopIds: number[];
}

export interface ShopParticipant {
  id: number;
  eventId: number;
  shopId: number;
  status: 'pending' | 'approved' | 'rejected';
  shopName: string;
  respondedAt: Date | null;
  respondedByUserId: number | null;
}

export interface CollaborativeEvent {
  id: number;
  title: string;
  description: string | null;
  startDatetime: Date;
  endDatetime: Date | null;
  location: string | null;
  address: string | null;
  primaryShopId: number | null;
  primaryShopName: string | null;
  createdByUserId: number | null;
  isCollaborative: boolean;
  proposalStatus: string | null;
  status: string;
  participants: ShopParticipant[];
  createdAt: Date;
}

/**
 * Create a collaborative event proposal
 */
export async function proposeCollaborativeEvent(
  proposal: EventProposal,
  userId: number
): Promise<Event> {
  // Verify user has permission for primary shop
  const hasPermission = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, proposal.primaryShopId),
        eq(shopStaff.userId, userId),
        eq(shopStaff.canCreateEvents, true),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  if (hasPermission.length === 0) {
    throw new Error('You do not have permission to create events for this shop');
  }

  // Create the event
  const eventResult = await db.insert(events).values({
    title: proposal.title,
    description: proposal.description || null,
    startDatetime: proposal.startDatetime,
    endDatetime: proposal.endDatetime || null,
    location: proposal.location || null,
    address: proposal.address || null,
    externalUrl: proposal.externalUrl || null,
    contactInfo: proposal.contactInfo || null,
    primaryShopId: proposal.primaryShopId,
    createdByUserId: userId,
    isCollaborative: proposal.participantShopIds.length > 0,
    proposalStatus: proposal.participantShopIds.length > 0 ? 'pending' : null,
    status: proposal.participantShopIds.length > 0 ? 'pending' : 'approved',
  });

  const eventId = eventResult[0].insertId;

  // Add primary shop as approved participant
  await db.insert(eventShopParticipants).values({
    eventId,
    shopId: proposal.primaryShopId,
    approvalStatus: 'approved',
    approvedAt: new Date(),
    approvedByUserId: userId,
  });

  // Add other shops as pending participants
  if (proposal.participantShopIds.length > 0) {
    const participantValues = proposal.participantShopIds.map(shopId => ({
      eventId,
      shopId,
      approvalStatus: 'pending' as const,
    }));
    await db.insert(eventShopParticipants).values(participantValues);
  }

  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  return event[0];
}

/**
 * Approve shop participation in an event
 */
export async function approveShopParticipation(
  eventId: number,
  shopId: number,
  userId: number
): Promise<void> {
  // Verify user has permission for this shop
  const hasPermission = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        eq(shopStaff.canCreateEvents, true),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  if (hasPermission.length === 0) {
    throw new Error('You do not have permission to approve events for this shop');
  }

  // Update participation status
  await db
    .update(eventShopParticipants)
    .set({
      approvalStatus: 'approved',
      approvedAt: new Date(),
      approvedByUserId: userId,
    })
    .where(
      and(
        eq(eventShopParticipants.eventId, eventId),
        eq(eventShopParticipants.shopId, shopId)
      )
    );

  // Check if all participants have approved
  await checkAndPublishEvent(eventId);
}

/**
 * Reject shop participation in an event
 */
export async function rejectShopParticipation(
  eventId: number,
  shopId: number,
  userId: number
): Promise<void> {
  // Verify user has permission for this shop
  const hasPermission = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        eq(shopStaff.canCreateEvents, true),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  if (hasPermission.length === 0) {
    throw new Error('You do not have permission to reject events for this shop');
  }

  // Update participation status
  await db
    .update(eventShopParticipants)
    .set({
      approvalStatus: 'rejected',
      approvedAt: new Date(),
      approvedByUserId: userId,
    })
    .where(
      and(
        eq(eventShopParticipants.eventId, eventId),
        eq(eventShopParticipants.shopId, shopId)
      )
    );

  // Mark event as partially rejected
  await db
    .update(events)
    .set({ proposalStatus: 'partial' })
    .where(eq(events.id, eventId));
}

/**
 * Check if all shops approved and publish the event
 */
async function checkAndPublishEvent(eventId: number): Promise<void> {
  const participants = await db
    .select()
    .from(eventShopParticipants)
    .where(eq(eventShopParticipants.eventId, eventId));

  const allApproved = participants.every(p => p.approvalStatus === 'approved');

  if (allApproved) {
    await db
      .update(events)
      .set({
        status: 'approved',
        proposalStatus: 'approved',
      })
      .where(eq(events.id, eventId));
  }
}

/**
 * Get pending proposals for a shop
 */
export async function getPendingProposalsForShop(shopId: number): Promise<CollaborativeEvent[]> {
  const participations = await db
    .select({
      participant: eventShopParticipants,
      event: events,
    })
    .from(eventShopParticipants)
    .innerJoin(events, eq(eventShopParticipants.eventId, events.id))
    .where(
      and(
        eq(eventShopParticipants.shopId, shopId),
        eq(eventShopParticipants.approvalStatus, 'pending')
      )
    )
    .orderBy(desc(events.createdAt));

  return Promise.all(participations.map(async ({ event }) => {
    const allParticipants = await getEventParticipants(event.id);
    const primaryShop = event.primaryShopId
      ? await db.select().from(localShops).where(eq(localShops.id, event.primaryShopId)).limit(1)
      : [];

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startDatetime: event.startDatetime!,
      endDatetime: event.endDatetime,
      location: event.location,
      address: event.address,
      primaryShopId: event.primaryShopId,
      primaryShopName: primaryShop[0]?.name || null,
      createdByUserId: event.createdByUserId,
      isCollaborative: event.isCollaborative ?? false,
      proposalStatus: event.proposalStatus,
      status: event.status!,
      participants: allParticipants,
      createdAt: event.createdAt!,
    };
  }));
}

/**
 * Get all events for a shop (including collaborative)
 */
export async function getEventsForShop(shopId: number): Promise<CollaborativeEvent[]> {
  // Get events where this shop is the primary or a participant
  const primaryEvents = await db
    .select()
    .from(events)
    .where(eq(events.primaryShopId, shopId))
    .orderBy(desc(events.startDatetime));

  const participantEvents = await db
    .select({ event: events })
    .from(eventShopParticipants)
    .innerJoin(events, eq(eventShopParticipants.eventId, events.id))
    .where(
      and(
        eq(eventShopParticipants.shopId, shopId),
        eq(eventShopParticipants.approvalStatus, 'approved')
      )
    )
    .orderBy(desc(events.startDatetime));

  // Combine and deduplicate
  const allEvents = [...primaryEvents];
  for (const { event } of participantEvents) {
    if (!allEvents.find(e => e.id === event.id)) {
      allEvents.push(event);
    }
  }

  return Promise.all(allEvents.map(async (event) => {
    const allParticipants = await getEventParticipants(event.id);
    const primaryShop = event.primaryShopId
      ? await db.select().from(localShops).where(eq(localShops.id, event.primaryShopId)).limit(1)
      : [];

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startDatetime: event.startDatetime!,
      endDatetime: event.endDatetime,
      location: event.location,
      address: event.address,
      primaryShopId: event.primaryShopId,
      primaryShopName: primaryShop[0]?.name || null,
      createdByUserId: event.createdByUserId,
      isCollaborative: event.isCollaborative ?? false,
      proposalStatus: event.proposalStatus,
      status: event.status!,
      participants: allParticipants,
      createdAt: event.createdAt!,
    };
  }));
}

/**
 * Get participants for an event
 */
async function getEventParticipants(eventId: number): Promise<ShopParticipant[]> {
  const results = await db
    .select({
      participant: eventShopParticipants,
      shop: localShops,
    })
    .from(eventShopParticipants)
    .innerJoin(localShops, eq(eventShopParticipants.shopId, localShops.id))
    .where(eq(eventShopParticipants.eventId, eventId));

  return results.map(({ participant, shop }) => ({
    id: participant.id,
    eventId: participant.eventId,
    shopId: participant.shopId,
    status: participant.approvalStatus || 'pending',
    shopName: shop.name,
    respondedAt: participant.approvedAt,
    respondedByUserId: participant.approvedByUserId,
  }));
}

/**
 * Get approval status for an event
 */
export async function getEventApprovalStatus(eventId: number): Promise<{
  event: Event;
  participants: ShopParticipant[];
  allApproved: boolean;
  anyRejected: boolean;
}> {
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (event.length === 0) {
    throw new Error('Event not found');
  }

  const participants = await getEventParticipants(eventId);
  const allApproved = participants.every(p => p.status === 'approved');
  const anyRejected = participants.some(p => p.status === 'rejected');

  return {
    event: event[0],
    participants,
    allApproved,
    anyRejected,
  };
}

/**
 * Create a simple (non-collaborative) shop event
 */
export async function createShopEvent(
  shopId: number,
  userId: number,
  eventData: {
    title: string;
    description?: string;
    startDatetime: Date;
    endDatetime?: Date;
    location?: string;
    address?: string;
    externalUrl?: string;
    contactInfo?: Record<string, unknown>;
  }
): Promise<Event> {
  // Verify user has permission
  const hasPermission = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        eq(shopStaff.canCreateEvents, true),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  if (hasPermission.length === 0) {
    throw new Error('You do not have permission to create events for this shop');
  }

  const result = await db.insert(events).values({
    title: eventData.title,
    description: eventData.description || null,
    startDatetime: eventData.startDatetime,
    endDatetime: eventData.endDatetime || null,
    location: eventData.location || null,
    address: eventData.address || null,
    externalUrl: eventData.externalUrl || null,
    contactInfo: eventData.contactInfo || null,
    primaryShopId: shopId,
    createdByUserId: userId,
    isCollaborative: false,
    status: 'approved',
  });

  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, result[0].insertId))
    .limit(1);

  return event[0];
}
