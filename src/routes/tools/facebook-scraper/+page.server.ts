import type { PageServerLoad } from './$types';
import * as facebookService from '$lib/server/services/facebook';

export const load: PageServerLoad = async () => {
  const status = facebookService.getStatus();

  return {
    status,
  };
};
