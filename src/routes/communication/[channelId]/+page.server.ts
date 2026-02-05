import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import {
  getChannelById,
  canUserAccessChannel,
  getChannelParticipants,
  isUserParticipant,
  canUserManageChannel,
} from '$lib/server/services/communication/channels';
import { getChannelMessages, getUnreadCount, getPinnedMessages } from '$lib/server/services/communication/messages';

export const load: PageServerLoad = async ({ params, locals }) => {
  // Require authentication
  if (!locals.user) {
    redirect(302, `/login?return=/communication/${params.channelId}`);
  }

  const channelId = parseInt(params.channelId);
  if (isNaN(channelId)) {
    error(400, 'Invalid channel ID');
  }

  // Get channel
  const channel = await getChannelById(channelId);
  if (!channel) {
    error(404, 'Channel not found');
  }

  // Check access
  const canAccess = await canUserAccessChannel(channelId, locals.user.id);
  if (!canAccess) {
    error(403, 'You do not have access to this channel');
  }

  // Load channel data
  const [participants, messages, pinnedMessages, isParticipant, canManage] = await Promise.all([
    getChannelParticipants(channelId),
    getChannelMessages(channelId, 50, 0),
    getPinnedMessages(channelId),
    isUserParticipant(channelId, locals.user.id),
    canUserManageChannel(channelId, locals.user.id),
  ]);

  // Get unread count
  const unreadCount = isParticipant ? await getUnreadCount(channelId, locals.user.id) : 0;

  return {
    user: locals.user,
    channel,
    participants,
    messages: messages.reverse(), // Oldest first for chat display
    pinnedMessages,
    isParticipant,
    canManage,
    unreadCount,
  };
};
