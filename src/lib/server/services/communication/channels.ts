import { db } from '$lib/server/db';
import {
  communicationChannels,
  communicationParticipants,
  users,
  type CommunicationChannel,
  type NewCommunicationChannel,
  type CommunicationParticipant,
} from '$lib/server/db/schema';
import { eq, and, or, desc, like, sql, isNull } from 'drizzle-orm';

export type ChannelType = 'public' | 'private' | 'event' | 'vendor' | 'announcement';
export type ParticipantRole = 'member' | 'admin';

export interface CreateChannelInput {
  name: string;
  description?: string;
  type?: ChannelType;
  eventId?: number;
  shopId?: number;
  settings?: Record<string, unknown>;
}

export interface ChannelWithDetails extends CommunicationChannel {
  unreadCount?: number;
  lastMessage?: {
    content: string;
    createdAt: Date;
    userName: string;
  };
}

/**
 * Generate a URL-safe slug from a channel name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * Ensure slug uniqueness by appending a counter if needed
 */
async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: communicationChannels.id })
      .from(communicationChannels)
      .where(eq(communicationChannels.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Create a new communication channel
 */
export async function createChannel(
  createdByUserId: number,
  input: CreateChannelInput
): Promise<CommunicationChannel> {
  const slug = await ensureUniqueSlug(generateSlug(input.name));

  const [channel] = await db
    .insert(communicationChannels)
    .values({
      name: input.name,
      slug,
      description: input.description || null,
      type: input.type || 'public',
      createdByUserId,
      eventId: input.eventId || null,
      shopId: input.shopId || null,
      settings: input.settings || null,
      messageCount: 0,
      participantCount: 1,
      isArchived: false,
    })
    .$returningId();

  // Auto-add creator as admin
  await db.insert(communicationParticipants).values({
    channelId: channel.id,
    userId: createdByUserId,
    role: 'admin',
  });

  const [created] = await db
    .select()
    .from(communicationChannels)
    .where(eq(communicationChannels.id, channel.id));

  return created;
}

/**
 * Get a channel by ID
 */
export async function getChannelById(channelId: number): Promise<CommunicationChannel | null> {
  const [channel] = await db
    .select()
    .from(communicationChannels)
    .where(eq(communicationChannels.id, channelId));

  return channel || null;
}

/**
 * Get a channel by slug
 */
export async function getChannelBySlug(slug: string): Promise<CommunicationChannel | null> {
  const [channel] = await db
    .select()
    .from(communicationChannels)
    .where(eq(communicationChannels.slug, slug));

  return channel || null;
}

/**
 * Update a channel
 */
export async function updateChannel(
  channelId: number,
  updates: Partial<Pick<CommunicationChannel, 'name' | 'description' | 'settings'>>
): Promise<CommunicationChannel | null> {
  await db
    .update(communicationChannels)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(communicationChannels.id, channelId));

  return getChannelById(channelId);
}

/**
 * Archive a channel
 */
export async function archiveChannel(channelId: number): Promise<void> {
  await db
    .update(communicationChannels)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(communicationChannels.id, channelId));
}

/**
 * Unarchive a channel
 */
export async function unarchiveChannel(channelId: number): Promise<void> {
  await db
    .update(communicationChannels)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(communicationChannels.id, channelId));
}

/**
 * Delete a channel (hard delete)
 */
export async function deleteChannel(channelId: number): Promise<void> {
  await db
    .delete(communicationChannels)
    .where(eq(communicationChannels.id, channelId));
}

/**
 * Check if a user can access a channel
 * - Public channels: anyone can access
 * - Private/Event/Vendor channels: must be a participant
 */
export async function canUserAccessChannel(
  channelId: number,
  userId: number
): Promise<boolean> {
  const channel = await getChannelById(channelId);
  if (!channel) return false;

  // Public channels are accessible to everyone
  if (channel.type === 'public') return true;

  // Other channels require participation
  return isUserParticipant(channelId, userId);
}

/**
 * Check if a user can manage a channel (creator or admin)
 */
export async function canUserManageChannel(
  channelId: number,
  userId: number
): Promise<boolean> {
  const channel = await getChannelById(channelId);
  if (!channel) return false;

  // Creator can always manage
  if (channel.createdByUserId === userId) return true;

  // Check if user is an admin participant
  const [participant] = await db
    .select()
    .from(communicationParticipants)
    .where(
      and(
        eq(communicationParticipants.channelId, channelId),
        eq(communicationParticipants.userId, userId),
        eq(communicationParticipants.role, 'admin')
      )
    );

  return !!participant;
}

/**
 * Check if a user is a participant in a channel
 */
export async function isUserParticipant(
  channelId: number,
  userId: number
): Promise<boolean> {
  const [participant] = await db
    .select({ id: communicationParticipants.id })
    .from(communicationParticipants)
    .where(
      and(
        eq(communicationParticipants.channelId, channelId),
        eq(communicationParticipants.userId, userId)
      )
    );

  return !!participant;
}

/**
 * Add a participant to a channel
 */
export async function addParticipant(
  channelId: number,
  userId: number,
  role: ParticipantRole = 'member'
): Promise<CommunicationParticipant> {
  // Check if already a participant
  const existing = await isUserParticipant(channelId, userId);
  if (existing) {
    throw new Error('User is already a participant in this channel');
  }

  const [participant] = await db
    .insert(communicationParticipants)
    .values({
      channelId,
      userId,
      role,
    })
    .$returningId();

  // Update participant count
  await db
    .update(communicationChannels)
    .set({
      participantCount: sql`${communicationChannels.participantCount} + 1`,
    })
    .where(eq(communicationChannels.id, channelId));

  const [created] = await db
    .select()
    .from(communicationParticipants)
    .where(eq(communicationParticipants.id, participant.id));

  return created;
}

/**
 * Remove a participant from a channel
 */
export async function removeParticipant(
  channelId: number,
  userId: number
): Promise<void> {
  await db
    .delete(communicationParticipants)
    .where(
      and(
        eq(communicationParticipants.channelId, channelId),
        eq(communicationParticipants.userId, userId)
      )
    );

  // Update participant count
  await db
    .update(communicationChannels)
    .set({
      participantCount: sql`GREATEST(${communicationChannels.participantCount} - 1, 0)`,
    })
    .where(eq(communicationChannels.id, channelId));
}

/**
 * Update a participant's role
 */
export async function updateParticipantRole(
  channelId: number,
  userId: number,
  role: ParticipantRole
): Promise<void> {
  await db
    .update(communicationParticipants)
    .set({ role })
    .where(
      and(
        eq(communicationParticipants.channelId, channelId),
        eq(communicationParticipants.userId, userId)
      )
    );
}

/**
 * Get a user's participant record for a channel
 */
export async function getParticipant(
  channelId: number,
  userId: number
): Promise<CommunicationParticipant | null> {
  const [participant] = await db
    .select()
    .from(communicationParticipants)
    .where(
      and(
        eq(communicationParticipants.channelId, channelId),
        eq(communicationParticipants.userId, userId)
      )
    );

  return participant || null;
}

/**
 * Get all participants in a channel
 */
export async function getChannelParticipants(
  channelId: number
): Promise<(CommunicationParticipant & { user: { id: number; username: string; avatarUrl: string | null } })[]> {
  const participants = await db
    .select({
      participant: communicationParticipants,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationParticipants)
    .innerJoin(users, eq(communicationParticipants.userId, users.id))
    .where(eq(communicationParticipants.channelId, channelId));

  return participants.map((p) => ({
    ...p.participant,
    user: p.user,
  }));
}

/**
 * Get channels for a user
 */
export async function getUserChannels(
  userId: number,
  includeArchived = false
): Promise<ChannelWithDetails[]> {
  const conditions = [eq(communicationParticipants.userId, userId)];

  if (!includeArchived) {
    conditions.push(eq(communicationChannels.isArchived, false));
  }

  const channels = await db
    .select({
      channel: communicationChannels,
      lastReadMessageId: communicationParticipants.lastReadMessageId,
    })
    .from(communicationParticipants)
    .innerJoin(
      communicationChannels,
      eq(communicationParticipants.channelId, communicationChannels.id)
    )
    .where(and(...conditions))
    .orderBy(desc(communicationChannels.lastActivityAt));

  return channels.map((c) => ({
    ...c.channel,
  }));
}

/**
 * Get public channels with pagination
 */
export async function getPublicChannels(
  limit = 20,
  offset = 0
): Promise<CommunicationChannel[]> {
  return db
    .select()
    .from(communicationChannels)
    .where(
      and(
        eq(communicationChannels.type, 'public'),
        eq(communicationChannels.isArchived, false)
      )
    )
    .orderBy(desc(communicationChannels.lastActivityAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Search channels by name or description
 */
export async function searchChannels(
  query: string,
  limit = 20
): Promise<CommunicationChannel[]> {
  const searchTerm = `%${query}%`;

  return db
    .select()
    .from(communicationChannels)
    .where(
      and(
        eq(communicationChannels.isArchived, false),
        or(
          like(communicationChannels.name, searchTerm),
          like(communicationChannels.description, searchTerm)
        )
      )
    )
    .orderBy(desc(communicationChannels.lastActivityAt))
    .limit(limit);
}

/**
 * Update channel activity timestamp
 */
export async function updateChannelActivity(channelId: number): Promise<void> {
  await db
    .update(communicationChannels)
    .set({ lastActivityAt: new Date() })
    .where(eq(communicationChannels.id, channelId));
}

/**
 * Increment message count for a channel
 */
export async function incrementMessageCount(channelId: number): Promise<void> {
  await db
    .update(communicationChannels)
    .set({
      messageCount: sql`${communicationChannels.messageCount} + 1`,
      lastActivityAt: new Date(),
    })
    .where(eq(communicationChannels.id, channelId));
}
