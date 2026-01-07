<script lang="ts">
  import type { SessionUser } from '$lib/server/auth/session';

  export let user: SessionUser | null = null;

  let isOpen = false;

  function toggleMenu() {
    isOpen = !isOpen;
  }

  function closeMenu() {
    isOpen = false;
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      closeMenu();
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

{#if user}
  <div class="relative user-menu">
    <button
      on:click|stopPropagation={toggleMenu}
      class="flex items-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
    >
      {#if user.avatarUrl}
        <img
          src={user.avatarUrl}
          alt={user.username}
          class="h-8 w-8 rounded-full"
        />
      {:else}
        <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
          {user.firstName?.[0] || user.username[0].toUpperCase()}
        </div>
      {/if}
      <span class="hidden sm:inline text-gray-700">{user.firstName || user.username}</span>
      <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {#if isOpen}
      <div class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
        <div class="py-1">
          <div class="px-4 py-2 text-sm text-gray-700 border-b">
            <p class="font-medium">{user.firstName} {user.lastName}</p>
            <p class="text-gray-500 text-xs truncate">{user.email}</p>
          </div>

          {#if user.isBusinessOwner || user.role === 'admin'}
            <a
              href="/shops/manage"
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              on:click={closeMenu}
            >
              My Shops
            </a>
          {/if}

          {#if user.role === 'admin'}
            <a
              href="/admin/scrapers"
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              on:click={closeMenu}
            >
              Admin Dashboard
            </a>
          {/if}

          <div class="border-t">
            <a
              href="/auth/logout"
              class="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              on:click={closeMenu}
            >
              Sign out
            </a>
          </div>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <a
    href="/login"
    class="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100"
  >
    Sign in
  </a>
{/if}
