import type { PageServerLoad } from './$types';
import { isGoogleOAuthConfigured } from '$lib/server/auth/google';

export const load: PageServerLoad = async () => {
  return {
    googleAuthEnabled: isGoogleOAuthConfigured(),
  };
};
