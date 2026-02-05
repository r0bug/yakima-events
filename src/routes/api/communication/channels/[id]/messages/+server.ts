import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  canUserAccessChannel,
  getChannelById,
} from '$lib/server/services/communication/channels';
import {
  createMessage,
  getChannelMessages,
  getMessagesAfter,
  getMessagesBefore,
  searchMessages,
  markChannelAsRead,
  getUnreadCount,
  getPinnedMessages,
} from '$lib/server/services/communication/messages';
import {
  notifyMentionedUsers,
  notifyReply,
} from '$lib/server/services/communication/notifications';
import { db } from '$lib/server/db';
import { communicationMessages } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/communication/channels/[id]/messages
 * Get messages for a channel
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = locals.user;
  const channelId = parseInt(params.id);

  if (isNaN(channelId)) {
    return json({ error: 'Invalid channel ID' }, { status: 400 });
  }

  try {
    // Check access
    const channel = await getChannelById(channelId);
    if (!channel) {
      return json({ error: 'Channel not found' }, { status: 404 });
    }

    const canAccess = user
      ? await canUserAccessChannel(channelId, user.id)
      : channel.type === 'public';

    if (!canAccess) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const search = url.searchParams.get('search');
    const after = url.searchParams.get('after');
    const before = url.searchParams.get('before');
    const pinned = url.searchParams.get('pinned') === 'true';

    // Get pinned messages
    if (pinned) {
      const messages = await getPinnedMessages(channelId);
      return json({ messages });
    }

    // Search messages
    if (search) {
      const messages = await searchMessages(channelId, search, limit);
      return json({ messages });
    }

    // Get messages after a specific ID (real-time updates)
    if (after) {
      const afterId = parseInt(after);
      if (!isNaN(afterId)) {
        const messages = await getMessagesAfter(channelId, afterId, limit);
        return json({ messages });
      }
    }

    // Get messages before a specific ID (infinite scroll)
    if (before) {
      const beforeId = parseInt(before);
      if (!isNaN(beforeId)) {
        const messages = await getMessagesBefore(channelId, beforeId, limit);
        return json({ messages });
      }
    }

    // Get recent messages
    const messages = await getChannelMessages(channelId, limit, 0);

    // Get unread count if authenticated
    let unreadCount = 0;
    if (user) {
      unreadCount = await getUnreadCount(channelId, user.id);
    }

    return json({ messages, unreadCount });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
};

/**
 * POST /api/communication/channels/[id]/messages
 * Post a new message
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  const user = locals.user;
  const channelId = parseInt(params.id);

  if (!user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  if (isNaN(channelId)) {
    return json({ error: 'Invalid channel ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { content, parentMessageId } = body;

    if (!content || content.trim().length === 0) {
      return json({ error: 'Message content is required' }, { status: 400 });
    }

    // Create the message
    const message = await createMessage(user.id, {
      channelId,
      content: content.trim(),
      parentMessageId: parentMessageId ? parseInt(parentMessageId) : undefined,
    });

    // Handle notifications for mentions
    if (message.mentions && message.mentions.length > 0) {
      await notifyMentionedUsers(
        message.mentions,
        channelId,
        message.id,
        user.id,
        user.username,
        content.trim()
      );
    }

    // Handle reply notification
    if (parentMessageId) {
      const parentId = parseInt(parentMessageId);
      // Get parent message user
      const [parentMessage] = await db
        .select({ userId: communicationMessages.userId })
        .from(communicationMessages)
        .where(eq(communicationMessages.id, parentId));

      if (parentMessage) {
        await notifyReply(
          parentMessage.userId,
          channelId,
          message.id,
          user.id,
          user.username,
          content.trim()
        );
      }
    }

    return json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create message';
    return json({ error: errorMessage }, { status: 500 });
  }
};

/**
 * PUT /api/communication/channels/[id]/messages
 * Mark channel as read
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const user = locals.user;
  const channelId = parseInt(params.id);

  if (!user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  if (isNaN(channelId)) {
    return json({ error: 'Invalid channel ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'mark_read') {
      await markChannelAsRead(channelId, user.id);
      return json({ success: true, message: 'Channel marked as read' });
    }

    return json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error marking channel as read:', error);
    return json({ error: 'Failed to mark channel as read' }, { status: 500 });
  }
};
