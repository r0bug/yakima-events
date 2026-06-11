import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { events, localShops, calendarSources, users, communicationChannels, communicationMessages } from '$lib/server/db/schema';
import { sql, desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login?return=/admin/system-checkup');
	}

	// Table counts
	const [
		[eventCount],
		[shopCount],
		[sourceCount],
		[userCount],
		[channelCount],
		[messageCount],
	] = await Promise.all([
		db.select({ count: sql<number>`COUNT(*)` }).from(events),
		db.select({ count: sql<number>`COUNT(*)` }).from(localShops),
		db.select({ count: sql<number>`COUNT(*)` }).from(calendarSources),
		db.select({ count: sql<number>`COUNT(*)` }).from(users),
		db.select({ count: sql<number>`COUNT(*)` }).from(communicationChannels),
		db.select({ count: sql<number>`COUNT(*)` }).from(communicationMessages),
	]);

	const tableCounts = {
		events: eventCount?.count || 0,
		shops: shopCount?.count || 0,
		sources: sourceCount?.count || 0,
		users: userCount?.count || 0,
		channels: channelCount?.count || 0,
		messages: messageCount?.count || 0,
	};

	// Recent events created
	const recentEvents = await db
		.select({ id: events.id, title: events.title, createdAt: events.createdAt, status: events.status })
		.from(events)
		.orderBy(desc(events.createdAt))
		.limit(5);

	// Active scraper sources
	const activeSources = await db
		.select({ id: calendarSources.id, name: calendarSources.name, url: calendarSources.url })
		.from(calendarSources)
		.where(eq(calendarSources.active, true));

	// Database connection test
	let dbConnected = true;
	try {
		await db.execute(sql`SELECT 1`);
	} catch {
		dbConnected = false;
	}

	return {
		user: locals.user,
		dbConnected,
		tableCounts,
		recentEvents,
		activeSources,
		serverTime: new Date().toISOString(),
	};
};
