import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '$lib/server/services/communication/notifications';

/**
 * GET /api/communication/notifications
 * Get notifications for the authenticated user
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const countOnly = url.searchParams.get('count') === 'true';

    // Just get the count
    if (countOnly) {
      const count = await getUnreadNotificationCount(user.id);
      return json({ unreadCount: count });
    }

    // Get notifications
    const notifications = await getUserNotifications(user.id, limit, offset, unreadOnly);
    const unreadCount = await getUnreadNotificationCount(user.id);

    return json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
};

/**
 * POST /api/communication/notifications
 * Mark notifications as read
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, notificationId } = body;

    if (action === 'read' && notificationId) {
      await markNotificationAsRead(parseInt(notificationId));
      return json({ success: true, message: 'Notification marked as read' });
    }

    if (action === 'read_all') {
      await markAllNotificationsAsRead(user.id);
      return json({ success: true, message: 'All notifications marked as read' });
    }

    if (action === 'delete' && notificationId) {
      await deleteNotification(parseInt(notificationId));
      return json({ success: true, message: 'Notification deleted' });
    }

    return json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing notification action:', error);
    return json({ error: 'Failed to process action' }, { status: 500 });
  }
};
