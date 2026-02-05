<script lang="ts">
  import { page } from '$app/stores';
  import Header from '$lib/components/Header.svelte';
  import type { LayoutData } from './$types';

  export let data: LayoutData;

  const navItems = [
    { href: '/admin/scrapers', label: 'Scrapers', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
    { href: '/admin/claims', label: 'Shop Claims', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  ];

  function isActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<Header user={data.user} />

<div class="flex min-h-[calc(100vh-64px)]">
  <!-- Sidebar -->
  <aside class="w-64 bg-gray-900 text-gray-100 hidden md:block">
    <div class="p-4 border-b border-gray-800">
      <h2 class="text-lg font-semibold">Admin Panel</h2>
    </div>
    <nav class="p-4">
      <ul class="space-y-2">
        {#each navItems as item}
          <li>
            <a
              href={item.href}
              class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors {isActive(item.href) ? 'bg-purple-600 text-white' : 'hover:bg-gray-800'}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
              </svg>
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </aside>

  <!-- Mobile nav -->
  <div class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40">
    <nav class="flex justify-around p-2">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex flex-col items-center gap-1 px-4 py-2 rounded-lg {isActive(item.href) ? 'text-purple-600' : 'text-gray-600'}"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
          </svg>
          <span class="text-xs">{item.label}</span>
        </a>
      {/each}
    </nav>
  </div>

  <!-- Main content -->
  <main class="flex-1 p-6 pb-20 md:pb-6">
    <slot />
  </main>
</div>
