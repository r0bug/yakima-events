<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  interface Shop {
    id: number;
    name: string;
    description: string | null;
    address: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    imageUrl: string | null;
    status: string;
  }

  interface UserShopAccess {
    role: 'admin' | 'staff';
    permissions: {
      canEditShop: boolean;
      canCreateEvents: boolean;
      canPostDiscussions: boolean;
      canManageStaff: boolean;
    };
  }

  let shop: Shop | null = null;
  let access: UserShopAccess | null = null;
  let loading = true;
  let error: string | null = null;

  async function loadShop() {
    if (!data.user) {
      goto(`/login?return=${encodeURIComponent($page.url.pathname)}`);
      return;
    }

    loading = true;
    error = null;

    try {
      const shopId = $page.params.id;

      // Load shop details
      const shopRes = await fetch(`/api/shops/${shopId}`);
      if (!shopRes.ok) {
        throw new Error('Shop not found');
      }
      const shopData = await shopRes.json();
      shop = shopData.shop || shopData;

      // Load user's shops to check access
      const userShopsRes = await fetch('/api/user/shops');
      if (!userShopsRes.ok) {
        throw new Error('Failed to check access');
      }
      const userShopsData = await userShopsRes.json();
      const userShop = userShopsData.shops?.find((s: { shop: { id: number } }) => s.shop.id === parseInt(shopId));

      if (!userShop) {
        throw new Error('You do not have access to manage this shop');
      }

      access = {
        role: userShop.role,
        permissions: userShop.permissions,
      };
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load shop';
    } finally {
      loading = false;
    }
  }

  onMount(loadShop);
</script>

<svelte:head>
  <title>Manage {shop?.name || 'Shop'} - Yakima</title>
</svelte:head>

<main class="container mx-auto px-4 py-8">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else if error}
    <div class="max-w-xl mx-auto">
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
        {error}
      </div>
      <a href="/shops" class="text-purple-600 hover:underline">← Back to shops</a>
    </div>
  {:else if shop && access}
    <!-- Breadcrumb -->
    <nav class="mb-6 text-sm">
      <a href="/shops" class="text-purple-600 hover:underline">Shops</a>
      <span class="mx-2 text-gray-400">/</span>
      <a href="/shops/{shop.id}" class="text-purple-600 hover:underline">{shop.name}</a>
      <span class="mx-2 text-gray-400">/</span>
      <span class="text-gray-600">Manage</span>
    </nav>

    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4 mb-8">
      <div class="flex items-center gap-4">
        {#if shop.imageUrl}
          <img src={shop.imageUrl} alt={shop.name} class="w-16 h-16 rounded-lg object-cover" />
        {:else}
          <div class="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        {/if}
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{shop.name}</h1>
          <div class="flex items-center gap-2 mt-1">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium {access.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">
              {access.role === 'admin' ? 'Admin' : 'Staff'}
            </span>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium {shop.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              {shop.status}
            </span>
          </div>
        </div>
      </div>
      <a
        href="/shops/{shop.id}"
        class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
      >
        View Public Page →
      </a>
    </div>

    <!-- Management Sections -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Edit Shop -->
      {#if access.permissions.canEditShop}
        <a
          href="/shops/{shop.id}/manage/edit"
          class="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow"
        >
          <div class="flex items-center gap-4">
            <div class="p-3 bg-purple-100 rounded-lg">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">Edit Shop</h3>
              <p class="text-sm text-gray-600">Update profile, hours, and info</p>
            </div>
          </div>
        </a>
      {/if}

      <!-- Team Management -->
      {#if access.permissions.canManageStaff}
        <a
          href="/shops/{shop.id}/manage/team"
          class="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow"
        >
          <div class="flex items-center gap-4">
            <div class="p-3 bg-blue-100 rounded-lg">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">Team</h3>
              <p class="text-sm text-gray-600">Manage staff and invitations</p>
            </div>
          </div>
        </a>
      {/if}

      <!-- Events -->
      {#if access.permissions.canCreateEvents}
        <a
          href="/shops/{shop.id}/manage/events"
          class="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow"
        >
          <div class="flex items-center gap-4">
            <div class="p-3 bg-green-100 rounded-lg">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">Events</h3>
              <p class="text-sm text-gray-600">Create and manage shop events</p>
            </div>
          </div>
        </a>
      {/if}
    </div>

    <!-- Quick Stats -->
    <div class="mt-8 bg-white rounded-lg border p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Shop Info</h2>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <dt class="text-sm text-gray-500">Address</dt>
          <dd class="text-gray-900">{shop.address || 'Not set'}</dd>
        </div>
        <div>
          <dt class="text-sm text-gray-500">Phone</dt>
          <dd class="text-gray-900">{shop.phone || 'Not set'}</dd>
        </div>
        <div>
          <dt class="text-sm text-gray-500">Email</dt>
          <dd class="text-gray-900">{shop.email || 'Not set'}</dd>
        </div>
        <div>
          <dt class="text-sm text-gray-500">Website</dt>
          <dd class="text-gray-900">{shop.website || 'Not set'}</dd>
        </div>
      </dl>
    </div>
  {/if}
</main>
