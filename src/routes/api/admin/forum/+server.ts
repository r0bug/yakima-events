import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { communicationMessages, communicationChannels, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'moderator')) {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	const body = await request.json();
	const { action } = body;

	switch (action) {
		case 'deleteMessage': {
			const { messageId } = body;
			if (!messageId) return json({ error: 'Message ID required' }, { status: 400 });
			await db.update(communicationMessages)
				.set({ isDeleted: true })
				.where(eq(communicationMessages.id, messageId));
			return json({ success: true });
		}

		case 'pinMessage': {
			const { messageId, pinned } = body;
			if (!messageId) return json({ error: 'Message ID required' }, { status: 400 });
			await db.update(communicationMessages)
				.set({ isPinned: !!pinned })
				.where(eq(communicationMessages.id, messageId));
			return json({ success: true });
		}

		case 'banUser': {
			const { userId } = body;
			if (!userId) return json({ error: 'User ID required' }, { status: 400 });
			await db.update(users)
				.set({ status: 'banned' })
				.where(eq(users.id, userId));
			return json({ success: true });
		}

		case 'archiveChannel': {
			const { channelId, archived } = body;
			if (!channelId) return json({ error: 'Channel ID required' }, { status: 400 });
			await db.update(communicationChannels)
				.set({ isArchived: !!archived })
				.where(eq(communicationChannels.id, channelId));
			return json({ success: true });
		}

		default:
			return json({ error: 'Unknown action' }, { status: 400 });
	}
};
