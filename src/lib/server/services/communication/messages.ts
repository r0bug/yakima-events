import { db } from '$lib/server/db';
import {
  communicationMessages,
  communicationParticipants,
  communicationChannels,
  users,
  type CommunicationMessage,
  type NewCommunicationMessage,
} from '$lib/server/db/schema';
import { eq, and, desc, gt, lt, sql, like, isNull } from 'drizzle-orm';
import { incrementMessageCount, updateChannelActivity } from './channels';

export type MessageContentType = 'text' | 'system' | 'announcement';

export interface CreateMessageInput {
  channelId: number;
  content: string;
  parentMessageId?: number;
  contentType?: MessageContentType;
  metadata?: Record<string, unknown>;
}

export interface MessageWithUser extends CommunicationMessage {
  user: {
    id: number;
    username: string;
    avatarUrl: string | null;
  };
  mentions?: string[];
}

/**
 * Extract @username mentions from message content
 */
function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.matchAll(mentionRegex);
  return [...new Set([...matches].map((m) => m[1]))];
}

/**
 * Create a new message in a channel
 */
export async function createMessage(
  userId: number,
  input: CreateMessageInput
): Promise<MessageWithUser> {
  // Verify user is a participant (or channel is public)
  const [participant] = await db
    .select()
    .from(communicationParticipants)
    .where(
      and(
        eq(communicationParticipants.channelId, input.channelId),
        eq(communicationParticipants.userId, userId)
      )
    );

  // Check if channel is public
  const [channel] = await db
    .select()
    .from(communicationChannels)
    .where(eq(communicationChannels.id, input.channelId));

  if (!channel) {
    throw new Error('Channel not found');
  }

  if (!participant && channel.type !== 'public') {
    throw new Error('User is not a participant in this channel');
  }

  // Extract mentions for metadata
  const mentions = extractMentions(input.content);

  const [message] = await db
    .insert(communicationMessages)
    .values({
      channelId: input.channelId,
      userId,
      content: input.content,
      parentMessageId: input.parentMessageId || null,
      contentType: input.contentType || 'text',
      metadata: mentions.length > 0 ? { mentions, ...input.metadata } : input.metadata || null,
    })
    .$returningId();

  // Update channel message count and activity
  await incrementMessageCount(input.channelId);

  // If this is a reply, increment parent's reply count
  if (input.parentMessageId) {
    await db
      .update(communicationMessages)
      .set({
        replyCount: sql`${communicationMessages.replyCount} + 1`,
      })
      .where(eq(communicationMessages.id, input.parentMessageId));
  }

  // Fetch the created message with user info
  const result = await getMessageById(message.id);
  if (!result) {
    throw new Error('Failed to create message');
  }

  return result;
}

/**
 * Get a message by ID with user info
 */
export async function getMessageById(messageId: number): Promise<MessageWithUser | null> {
  const [result] = await db
    .select({
      message: communicationMessages,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationMessages)
    .innerJoin(users, eq(communicationMessages.userId, users.id))
    .where(eq(communicationMessages.id, messageId));

  if (!result) return null;

  const metadata = result.message.metadata as Record<string, unknown> | null;

  return {
    ...result.message,
    user: result.user,
    mentions: (metadata?.mentions as string[]) || [],
  };
}

/**
 * Get messages for a channel with pagination
 */
export async function getChannelMessages(
  channelId: number,
  limit = 50,
  offset = 0
): Promise<MessageWithUser[]> {
  const results = await db
    .select({
      message: communicationMessages,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationMessages)
    .innerJoin(users, eq(communicationMessages.userId, users.id))
    .where(
      and(
        eq(communicationMessages.channelId, channelId),
        eq(communicationMessages.isDeleted, false)
      )
    )
    .orderBy(desc(communicationMessages.createdAt))
    .limit(limit)
    .offset(offset);

  return results.map((r) => {
    const metadata = r.message.metadata as Record<string, unknown> | null;
    return {
      ...r.message,
      user: r.user,
      mentions: (metadata?.mentions as string[]) || [],
    };
  });
}

/**
 * Get replies to a message (thread)
 */
export async function getMessageReplies(
  parentMessageId: number,
  limit = 50
): Promise<MessageWithUser[]> {
  const results = await db
    .select({
      message: communicationMessages,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationMessages)
    .innerJoin(users, eq(communicationMessages.userId, users.id))
    .where(
      and(
        eq(communicationMessages.parentMessageId, parentMessageId),
        eq(communicationMessages.isDeleted, false)
      )
    )
    .orderBy(communicationMessages.createdAt)
    .limit(limit);

  return results.map((r) => {
    const metadata = r.message.metadata as Record<string, unknown> | null;
    return {
      ...r.message,
      user: r.user,
      mentions: (metadata?.mentions as string[]) || [],
    };
  });
}

/**
 * Update a message's content
 */
export async function updateMessage(
  messageId: number,
  userId: number,
  content: string
): Promise<MessageWithUser | null> {
  // Verify ownership and not deleted
  const [existing] = await db
    .select()
    .from(communicationMessages)
    .where(eq(communicationMessages.id, messageId));

  if (!existing) {
    throw new Error('Message not found');
  }

  if (existing.userId !== userId) {
    throw new Error('Cannot edit another user\'s message');
  }

  if (existing.isDeleted) {
    throw new Error('Cannot edit a deleted message');
  }

  // Extract new mentions
  const mentions = extractMentions(content);
  const existingMetadata = (existing.metadata as Record<string, unknown>) || {};

  await db
    .update(communicationMessages)
    .set({
      content,
      isEdited: true,
      metadata: { ...existingMetadata, mentions },
      updatedAt: new Date(),
    })
    .where(eq(communicationMessages.id, messageId));

  return getMessageById(messageId);
}

/**
 * Soft delete a message
 */
export async function deleteMessage(messageId: number, userId: number): Promise<void> {
  // Verify ownership
  const [existing] = await db
    .select()
    .from(communicationMessages)
    .where(eq(communicationMessages.id, messageId));

  if (!existing) {
    throw new Error('Message not found');
  }

  if (existing.userId !== userId) {
    throw new Error('Cannot delete another user\'s message');
  }

  await db
    .update(communicationMessages)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
    })
    .where(eq(communicationMessages.id, messageId));
}

/**
 * Pin a message
 */
export async function pinMessage(messageId: number): Promise<void> {
  await db
    .update(communicationMessages)
    .set({ isPinned: true })
    .where(eq(communicationMessages.id, messageId));
}

/**
 * Unpin a message
 */
export async function unpinMessage(messageId: number): Promise<void> {
  await db
    .update(communicationMessages)
    .set({ isPinned: false })
    .where(eq(communicationMessages.id, messageId));
}

/**
 * Get pinned messages for a channel
 */
export async function getPinnedMessages(channelId: number): Promise<MessageWithUser[]> {
  const results = await db
    .select({
      message: communicationMessages,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationMessages)
    .innerJoin(users, eq(communicationMessages.userId, users.id))
    .where(
      and(
        eq(communicationMessages.channelId, channelId),
        eq(communicationMessages.isPinned, true),
        eq(communicationMessages.isDeleted, false)
      )
    )
    .orderBy(desc(communicationMessages.createdAt));

  return results.map((r) => ({
    ...r.message,
    user: r.user,
  }));
}

/**
 * Search messages in a channel
 */
export async function searchMessages(
  channelId: number,
  query: string,
  limit = 50
): Promise<MessageWithUser[]> {
  const searchTerm = `%${query}%`;

  const results = await db
    .select({
      message: communicationMessages,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationMessages)
    .innerJoin(users, eq(communicationMessages.userId, users.id))
    .where(
      and(
        eq(communicationMessages.channelId, channelId),
        eq(communicationMessages.isDeleted, false),
        like(communicationMessages.content, searchTerm)
      )
    )
    .orderBy(desc(communicationMessages.createdAt))
    .limit(limit);

  return results.map((r) => ({
    ...r.message,
    user: r.user,
  }));
}

/**
 * Get unread message count for a user in a channel
 */
export async function getUnreadCount(
  channelId: number,
  userId: number
): Promise<number> {
  const [participant] = await db
    .select()
    .from(communicationParticipants)
    .where(
      and(
        eq(communicationParticipants.channelId, channelId),
        eq(communicationParticipants.userId, userId)
      )
    );

  if (!participant) return 0;

  const lastReadId = participant.lastReadMessageId || 0;

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(communicationMessages)
    .where(
      and(
        eq(communicationMessages.channelId, channelId),
        eq(communicationMessages.isDeleted, false),
        gt(communicationMessages.id, lastReadId)
      )
    );

  return result?.count || 0;
}

/**
 * Mark a channel as read for a user
 */
export async function markChannelAsRead(
  channelId: number,
  userId: number
): Promise<void> {
  // Get the latest message ID
  const [latestMessage] = await db
    .select({ id: communicationMessages.id })
    .from(communicationMessages)
    .where(eq(communicationMessages.channelId, channelId))
    .orderBy(desc(communicationMessages.id))
    .limit(1);

  if (!latestMessage) return;

  await db
    .update(communicationParticipants)
    .set({
      lastReadMessageId: latestMessage.id,
      lastReadAt: new Date(),
    })
    .where(
      and(
        eq(communicationParticipants.channelId, channelId),
        eq(communicationParticipants.userId, userId)
      )
    );
}

/**
 * Get messages after a specific message ID (for real-time updates)
 */
export async function getMessagesAfter(
  channelId: number,
  afterMessageId: number,
  limit = 50
): Promise<MessageWithUser[]> {
  const results = await db
    .select({
      message: communicationMessages,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationMessages)
    .innerJoin(users, eq(communicationMessages.userId, users.id))
    .where(
      and(
        eq(communicationMessages.channelId, channelId),
        eq(communicationMessages.isDeleted, false),
        gt(communicationMessages.id, afterMessageId)
      )
    )
    .orderBy(communicationMessages.createdAt)
    .limit(limit);

  return results.map((r) => ({
    ...r.message,
    user: r.user,
  }));
}

/**
 * Get messages before a specific message ID (for infinite scroll)
 */
export async function getMessagesBefore(
  channelId: number,
  beforeMessageId: number,
  limit = 50
): Promise<MessageWithUser[]> {
  const results = await db
    .select({
      message: communicationMessages,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationMessages)
    .innerJoin(users, eq(communicationMessages.userId, users.id))
    .where(
      and(
        eq(communicationMessages.channelId, channelId),
        eq(communicationMessages.isDeleted, false),
        lt(communicationMessages.id, beforeMessageId)
      )
    )
    .orderBy(desc(communicationMessages.createdAt))
    .limit(limit);

  return results.map((r) => ({
    ...r.message,
    user: r.user,
  }));
}

/**
 * Create a system message (e.g., "User joined the channel")
 */
export async function createSystemMessage(
  channelId: number,
  content: string
): Promise<MessageWithUser> {
  // System messages use user ID 1 (system user)
  const SYSTEM_USER_ID = 1;

  const [message] = await db
    .insert(communicationMessages)
    .values({
      channelId,
      userId: SYSTEM_USER_ID,
      content,
      contentType: 'system',
    })
    .$returningId();

  await incrementMessageCount(channelId);

  const result = await getMessageById(message.id);
  if (!result) {
    throw new Error('Failed to create system message');
  }

  return result;
}

/**
 * Get mentions for a user across all channels
 */
export async function getUserMentions(
  userId: number,
  limit = 50
): Promise<MessageWithUser[]> {
  // Get user's username
  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) return [];

  const mentionPattern = `%@${user.username}%`;

  const results = await db
    .select({
      message: communicationMessages,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communicationMessages)
    .innerJoin(users, eq(communicationMessages.userId, users.id))
    .where(
      and(
        eq(communicationMessages.isDeleted, false),
        like(communicationMessages.content, mentionPattern)
      )
    )
    .orderBy(desc(communicationMessages.createdAt))
    .limit(limit);

  return results.map((r) => ({
    ...r.message,
    user: r.user,
  }));
}
