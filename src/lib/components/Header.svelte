<script lang="ts">
  import { PUBLIC_APP_NAME } from '$env/static/public';
  import UserMenu from './UserMenu.svelte';
  import type { SessionUser } from '$lib/server/auth/session';

  export let user: SessionUser | null = null;

  let mobileMenuOpen = false;

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
</script>

<header class="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-900 text-white shadow-lg texture-overlay">
  <div class="max-w-7xl mx-auto px-4 py-4 relative z-10">
    <div class="flex justify-between items-center">
      <a href="/" class="flex items-center gap-3 hover:opacity-90 group">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg group-hover:shadow-amber-500/25 transition-shadow">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <div class="text-xl font-display font-bold tracking-tight hidden sm:block">{PUBLIC_APP_NAME || 'Yakima Events'}</div>
          <div class="text-xl font-display font-bold tracking-tight sm:hidden">YFE</div>
          <div class="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-medium hidden sm:block">Yakima Valley Community Calendar</div>
        </div>
      </a>

      <!-- Desktop nav -->
      <nav class="hidden md:flex items-center gap-2">
        <a
          href="/calendar"
          class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 transition-all flex items-center gap-2 text-sm font-medium"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendar
        </a>

        <a
          href="/shops"
          class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 transition-all flex items-center gap-2 text-sm font-medium"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Shops
        </a>

        <a
          href="/map"
          class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 transition-all flex items-center gap-2 text-sm font-medium"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Map
        </a>

        <a
          href="/events/submit"
          class="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 transition-all flex items-center gap-2 text-sm font-semibold shadow-lg shadow-amber-900/20"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </a>

        <div class="ml-2 pl-2 border-l border-white/20">
          <UserMenu {user} />
        </div>
      </nav>

      <!-- Mobile: user menu + hamburger -->
      <div class="flex items-center gap-2 md:hidden">
        <UserMenu {user} />
        <button
          on:click={toggleMobileMenu}
          class="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {#if mobileMenuOpen}
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          {:else}
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          {/if}
        </button>
      </div>
    </div>

    <!-- Mobile nav dropdown -->
    {#if mobileMenuOpen}
      <nav class="md:hidden mt-4 pt-4 border-t border-white/20 space-y-2">
        <a
          href="/calendar"
          on:click={closeMobileMenu}
          class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendar
        </a>
        <a
          href="/shops"
          on:click={closeMobileMenu}
          class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Shops
        </a>
        <a
          href="/map"
          on:click={closeMobileMenu}
          class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Map
        </a>
        <a
          href="/events/submit"
          on:click={closeMobileMenu}
          class="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors text-amber-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </a>
      </nav>
    {/if}
  </div>
</header>
