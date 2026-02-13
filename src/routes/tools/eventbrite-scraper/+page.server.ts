import type { PageServerLoad } from './$types';
import * as eventbriteService from '$lib/server/services/eventbrite';

export const load: PageServerLoad = async () => {
  const status = eventbriteService.getStatus();

  return {
    status,
  };
};
