import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getChannelById,
  updateChannel,
  archiveChannel,
  unarchiveChannel,
  deleteChannel,
  canUserAccessChannel,
  canUserManageChannel,
  addParticipant,
  removeParticipant,
  getChannelParticipants,
  isUserParticipant,
} from '$lib/server/services/communication';

/**
 * GET /api/communication/channels/[id]
 * Get channel details
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = locals.user;
  const channelId = parseInt(params.id);

  if (isNaN(channelId)) {
    return json({ error: 'Invalid channel ID' }, { status: 400 });
  }

  try {
    const channel = await getChannelById(channelId);

    if (!channel) {
      return json({ error: 'Channel not found' }, { status: 404 });
    }

    // Check access permission
    const canAccess = user
      ? await canUserAccessChannel(channelId, user.id)
      : channel.type === 'public';

    if (!canAccess) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // Get participants if user can access
    const participants = await getChannelParticipants(channelId);

    // Check if user is a participant
    const isParticipant = user ? await isUserParticipant(channelId, user.id) : false;
    const canManage = user ? await canUserManageChannel(channelId, user.id) : false;

    return json({
      channel,
      participants,
      isParticipant,
      canManage,
    });
  } catch (error) {
    console.error('Error fetching channel:', error);
    return json({ error: 'Failed to fetch channel' }, { status: 500 });
  }
};

/**
 * PUT /api/communication/channels/[id]
 * Update channel details
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
    // Check management permission
    const canManage = await canUserManageChannel(channelId, user.id);
    if (!canManage) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { action, ...updates } = body;

    // Handle special actions
    if (action === 'archive') {
      await archiveChannel(channelId);
      return json({ success: true, message: 'Channel archived' });
    }

    if (action === 'unarchive') {
      await unarchiveChannel(channelId);
      return json({ success: true, message: 'Channel unarchived' });
    }

    // Regular update
    const channel = await updateChannel(channelId, updates);

    return json({ channel });
  } catch (error) {
    console.error('Error updating channel:', error);
    return json({ error: 'Failed to update channel' }, { status: 500 });
  }
};

/**
 * DELETE /api/communication/channels/[id]
 * Delete a channel
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const user = locals.user;
  const channelId = parseInt(params.id);

  if (!user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  if (isNaN(channelId)) {
    return json({ error: 'Invalid channel ID' }, { status: 400 });
  }

  try {
    // Check management permission
    const canManage = await canUserManageChannel(channelId, user.id);
    if (!canManage) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    await deleteChannel(channelId);

    return json({ success: true, message: 'Channel deleted' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    return json({ error: 'Failed to delete channel' }, { status: 500 });
  }
};

/**
 * POST /api/communication/channels/[id]
 * Join or leave a channel
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
    const { action } = body;

    if (action === 'join') {
      // Check if channel allows joining
      const channel = await getChannelById(channelId);
      if (!channel) {
        return json({ error: 'Channel not found' }, { status: 404 });
      }

      if (channel.type !== 'public') {
        return json(
          { error: 'Cannot join private channels directly' },
          { status: 403 }
        );
      }

      await addParticipant(channelId, user.id, 'member');
      return json({ success: true, message: 'Joined channel' });
    }

    if (action === 'leave') {
      await removeParticipant(channelId, user.id);
      return json({ success: true, message: 'Left channel' });
    }

    return json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing channel action:', error);
    const message = error instanceof Error ? error.message : 'Failed to process action';
    return json({ error: message }, { status: 500 });
  }
};
