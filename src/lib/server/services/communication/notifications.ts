import { db } from '$lib/server/db';
import {
  communicationNotifications,
  communicationParticipants,
  communicationChannels,
  users,
  type CommunicationNotification,
} from '$lib/server/db/schema';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';

export type NotificationType = 'mention' | 'reply' | 'new_message' | 'announcement' | 'channel_invite';

export interface CreateNotificationInput {
  userId: number;
  channelId?: number;
  messageId?: number;
  type: NotificationType;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationWithChannel extends CommunicationNotification {
  channel?: {
    id: number;
    name: string;
    slug: string;
  };
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<CommunicationNotification> {
  const [notification] = await db
    .insert(communicationNotifications)
    .values({
      userId: input.userId,
      channelId: input.channelId || null,
      messageId: input.messageId || null,
      type: input.type,
      title: input.title,
      content: input.content || null,
      metadata: input.metadata || null,
      isRead: false,
      isEmailed: false,
    })
    .$returningId();

  const [created] = await db
    .select()
    .from(communicationNotifications)
    .where(eq(communicationNotifications.id, notification.id));

  return created;
}

/**
 * Create notifications for mentioned users in a message
 */
export async function notifyMentionedUsers(
  mentions: string[],
  channelId: number,
  messageId: number,
  senderUserId: number,
  senderUsername: string,
  messagePreview: string
): Promise<void> {
  if (mentions.length === 0) return;

  // Get user IDs for mentioned usernames
  const mentionedUsers = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(sql`${users.username} IN ${mentions}`);

  for (const user of mentionedUsers) {
    // Don't notify the sender
    if (user.id === senderUserId) continue;

    await createNotification({
      userId: user.id,
      channelId,
      messageId,
      type: 'mention',
      title: `${senderUsername} mentioned you`,
      content: messagePreview.substring(0, 200),
    });
  }
}

/**
 * Create a reply notification
 */
export async function notifyReply(
  parentMessageUserId: number,
  channelId: number,
  replyMessageId: number,
  replierUserId: number,
  replierUsername: string,
  messagePreview: string
): Promise<void> {
  // Don't notify if replying to own message
  if (parentMessageUserId === replierUserId) return;

  await createNotification({
    userId: parentMessageUserId,
    channelId,
    messageId: replyMessageId,
    type: 'reply',
    title: `${replierUsername} replied to your message`,
    content: messagePreview.substring(0, 200),
  });
}

/**
 * Create channel invite notification
 */
export async function notifyChannelInvite(
  userId: number,
  channelId: number,
  inviterUsername: string,
  channelName: string
): Promise<void> {
  await createNotification({
    userId,
    channelId,
    type: 'channel_invite',
    title: `${inviterUsername} invited you to ${channelName}`,
    content: `You've been invited to join the channel "${channelName}"`,
  });
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: number,
  limit = 50,
  offset = 0,
  unreadOnly = false
): Promise<NotificationWithChannel[]> {
  const conditions = [eq(communicationNotifications.userId, userId)];

  if (unreadOnly) {
    conditions.push(eq(communicationNotifications.isRead, false));
  }

  const results = await db
    .select({
      notification: communicationNotifications,
      channel: {
        id: communicationChannels.id,
        name: communicationChannels.name,
        slug: communicationChannels.slug,
      },
    })
    .from(communicationNotifications)
    .leftJoin(
      communicationChannels,
      eq(communicationNotifications.channelId, communicationChannels.id)
    )
    .where(and(...conditions))
    .orderBy(desc(communicationNotifications.createdAt))
    .limit(limit)
    .offset(offset);

  return results.map((r) => ({
    ...r.notification,
    channel: r.channel || undefined,
  }));
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(communicationNotifications)
    .where(
      and(
        eq(communicationNotifications.userId, userId),
        eq(communicationNotifications.isRead, false)
      )
    );

  return result?.count || 0;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: number): Promise<void> {
  await db
    .update(communicationNotifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(eq(communicationNotifications.id, notificationId));
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: number): Promise<void> {
  await db
    .update(communicationNotifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(communicationNotifications.userId, userId),
        eq(communicationNotifications.isRead, false)
      )
    );
}

/**
 * Mark notifications as read for a specific channel
 */
export async function markChannelNotificationsAsRead(
  userId: number,
  channelId: number
): Promise<void> {
  await db
    .update(communicationNotifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(communicationNotifications.userId, userId),
        eq(communicationNotifications.channelId, channelId),
        eq(communicationNotifications.isRead, false)
      )
    );
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: number): Promise<void> {
  await db
    .delete(communicationNotifications)
    .where(eq(communicationNotifications.id, notificationId));
}

/**
 * Delete old read notifications (cleanup)
 */
export async function cleanupOldNotifications(daysOld = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await db
    .delete(communicationNotifications)
    .where(
      and(
        eq(communicationNotifications.isRead, true),
        sql`${communicationNotifications.createdAt} < ${cutoffDate}`
      )
    );

  return 0; // Drizzle doesn't return affected rows for MySQL deletes
}

/**
 * Get users who should be notified for a channel message
 * Based on their notification preferences
 */
export async function getUsersToNotify(
  channelId: number,
  excludeUserId?: number
): Promise<number[]> {
  const conditions = [
    eq(communicationParticipants.channelId, channelId),
    eq(communicationParticipants.isMuted, false),
    eq(communicationParticipants.notificationPreference, 'all'),
  ];

  const participants = await db
    .select({ userId: communicationParticipants.userId })
    .from(communicationParticipants)
    .where(and(...conditions));

  return participants
    .map((p) => p.userId)
    .filter((id) => id !== excludeUserId);
}

/**
 * Update participant notification preferences
 */
export async function updateNotificationPreferences(
  channelId: number,
  userId: number,
  preferences: {
    notificationPreference?: 'all' | 'mentions' | 'none';
    emailDigestFrequency?: 'real-time' | 'daily' | 'weekly' | 'none';
    isMuted?: boolean;
  }
): Promise<void> {
  await db
    .update(communicationParticipants)
    .set(preferences)
    .where(
      and(
        eq(communicationParticipants.channelId, channelId),
        eq(communicationParticipants.userId, userId)
      )
    );
}

/**
 * Mark notification as emailed
 */
export async function markNotificationAsEmailed(notificationId: number): Promise<void> {
  await db
    .update(communicationNotifications)
    .set({ isEmailed: true })
    .where(eq(communicationNotifications.id, notificationId));
}

/**
 * Get notifications pending email delivery
 */
export async function getPendingEmailNotifications(
  limit = 100
): Promise<CommunicationNotification[]> {
  return db
    .select()
    .from(communicationNotifications)
    .where(
      and(
        eq(communicationNotifications.isEmailed, false),
        eq(communicationNotifications.isRead, false)
      )
    )
    .orderBy(communicationNotifications.createdAt)
    .limit(limit);
}
