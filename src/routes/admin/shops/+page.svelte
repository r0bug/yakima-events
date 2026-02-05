<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';

  export let data: PageData;

  let search = data.filters.search;
  let processingIds = new Set<number>();

  function handleSearch() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (data.filters.status !== 'all') params.set('status', data.filters.status);
    goto(`/admin/shops?${params.toString()}`);
  }

  function setStatusFilter(status: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    goto(`/admin/shops?${params.toString()}`);
  }

  async function updateShopStatus(shopId: number, newStatus: 'active' | 'inactive') {
    processingIds.add(shopId);
    processingIds = processingIds;

    try {
      const response = await fetch(`/api/shops/${shopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to update shop:', e);
    } finally {
      processingIds.delete(shopId);
      processingIds = processingIds;
    }
  }

  async function toggleVerified(shopId: number, currentVerified: boolean) {
    processingIds.add(shopId);
    processingIds = processingIds;

    try {
      const response = await fetch(`/api/shops/${shopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: !currentVerified }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to update shop:', e);
    } finally {
      processingIds.delete(shopId);
      processingIds = processingIds;
    }
  }

  async function deleteShop(shopId: number) {
    if (!confirm('Are you sure you want to delete this shop?')) return;

    processingIds.add(shopId);
    processingIds = processingIds;

    try {
      const response = await fetch(`/api/shops/${shopId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to delete shop:', e);
    } finally {
      processingIds.delete(shopId);
      processingIds = processingIds;
    }
  }
</script>

<svelte:head>
  <title>Shops - Admin</title>
</svelte:head>

<div>
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Shops</h1>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-purple-600">{data.pagination.totalCount}</div>
      <div class="text-gray-500 text-sm">Total Shops</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-green-600">{data.counts.active}</div>
      <div class="text-gray-500 text-sm">Active</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-yellow-600">{data.counts.pending}</div>
      <div class="text-gray-500 text-sm">Pending</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-blue-600">{data.counts.verified}</div>
      <div class="text-gray-500 text-sm">Verified</div>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <div class="flex flex-col md:flex-row gap-4">
      <form on:submit|preventDefault={handleSearch} class="flex-1 flex gap-2">
        <input
          type="text"
          bind:value={search}
          placeholder="Search shops..."
          class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
        <button
          type="submit"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Search
        </button>
      </form>

      <div class="flex gap-2">
        <button
          on:click={() => setStatusFilter('all')}
          class="px-4 py-2 rounded-lg {data.filters.status === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          All
        </button>
        <button
          on:click={() => setStatusFilter('active')}
          class="px-4 py-2 rounded-lg {data.filters.status === 'active' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          Active
        </button>
        <button
          on:click={() => setStatusFilter('pending')}
          class="px-4 py-2 rounded-lg {data.filters.status === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          Pending
        </button>
      </div>
    </div>
  </div>

  <!-- Shops List -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    {#if data.shops.length === 0}
      <div class="p-8 text-center text-gray-500">
        No shops found.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Shop</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Address</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Verified</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            {#each data.shops as shop}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    {#if shop.imageUrl}
                      <img
                        src={shop.imageUrl}
                        alt={shop.name}
                        class="w-10 h-10 rounded object-cover"
                      />
                    {:else}
                      <div class="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    {/if}
                    <div>
                      <div class="font-medium text-gray-900">{shop.name}</div>
                      {#if shop.phone}
                        <div class="text-xs text-gray-500">{shop.phone}</div>
                      {/if}
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {shop.address || 'No address'}
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-full text-xs font-medium
                    {shop.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                    {shop.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                    {shop.status === 'inactive' ? 'bg-gray-100 text-gray-700' : ''}
                  ">
                    {shop.status}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <button
                    on:click={() => toggleVerified(shop.id, shop.verified || false)}
                    disabled={processingIds.has(shop.id)}
                    class="text-sm disabled:opacity-50"
                  >
                    {#if shop.verified}
                      <span class="text-blue-600">✓ Verified</span>
                    {:else}
                      <span class="text-gray-400">Not verified</span>
                    {/if}
                  </button>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    {#if shop.status === 'pending'}
                      <button
                        on:click={() => updateShopStatus(shop.id, 'active')}
                        disabled={processingIds.has(shop.id)}
                        class="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded disabled:opacity-50"
                      >
                        Approve
                      </button>
                    {:else if shop.status === 'active'}
                      <button
                        on:click={() => updateShopStatus(shop.id, 'inactive')}
                        disabled={processingIds.has(shop.id)}
                        class="px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    {:else}
                      <button
                        on:click={() => updateShopStatus(shop.id, 'active')}
                        disabled={processingIds.has(shop.id)}
                        class="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded disabled:opacity-50"
                      >
                        Activate
                      </button>
                    {/if}
                    <a
                      href="/shops/{shop.id}"
                      class="px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded"
                    >
                      View
                    </a>
                    <button
                      on:click={() => deleteShop(shop.id)}
                      disabled={processingIds.has(shop.id)}
                      class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if data.pagination.totalPages > 1}
        <div class="border-t px-4 py-3 flex items-center justify-between">
          <div class="text-sm text-gray-500">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </div>
          <div class="flex gap-2">
            {#if data.pagination.page > 1}
              <a
                href="/admin/shops?page={data.pagination.page - 1}&status={data.filters.status}&search={data.filters.search}"
                class="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Previous
              </a>
            {/if}
            {#if data.pagination.page < data.pagination.totalPages}
              <a
                href="/admin/shops?page={data.pagination.page + 1}&status={data.filters.status}&search={data.filters.search}"
                class="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Next
              </a>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
