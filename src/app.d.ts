// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

import type { SessionUser } from '$lib/server/auth/session';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user: SessionUser | null;
    }
    interface PageData {
      user?: SessionUser | null;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
