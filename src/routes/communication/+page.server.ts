import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserChannels, getPublicChannels } from '$lib/server/services/communication';

export const load: PageServerLoad = async ({ locals }) => {
  // Require authentication for Communication Hub
  if (!locals.user) {
    redirect(302, '/login?return=/communication');
  }

  // Get user's channels and public channels they can join
  const [userChannels, publicChannels] = await Promise.all([
    getUserChannels(locals.user.id, false),
    getPublicChannels(20, 0),
  ]);

  // Filter out channels user is already in
  const userChannelIds = new Set(userChannels.map(c => c.id));
  const availablePublicChannels = publicChannels.filter(c => !userChannelIds.has(c.id));

  return {
    user: locals.user,
    userChannels,
    publicChannels: availablePublicChannels,
  };
};
