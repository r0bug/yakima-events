<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';

  export let data: PageData;

  let search = data.filters.search;
  let processingIds = new Set<number>();

  function handleSearch() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (data.filters.type !== 'all') params.set('type', data.filters.type);
    goto(`/admin/communication?${params.toString()}`);
  }

  function setTypeFilter(type: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type !== 'all') params.set('type', type);
    goto(`/admin/communication?${params.toString()}`);
  }

  async function archiveChannel(channelId: number) {
    if (!confirm('Are you sure you want to archive this channel?')) return;

    processingIds.add(channelId);
    processingIds = processingIds;

    try {
      const response = await fetch(`/api/communication/channels/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to archive channel:', e);
    } finally {
      processingIds.delete(channelId);
      processingIds = processingIds;
    }
  }

  async function deleteChannel(channelId: number) {
    if (!confirm('Are you sure you want to delete this channel? This will delete all messages.')) return;

    processingIds.add(channelId);
    processingIds = processingIds;

    try {
      const response = await fetch(`/api/communication/channels/${channelId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to delete channel:', e);
    } finally {
      processingIds.delete(channelId);
      processingIds = processingIds;
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'public': return 'bg-green-100 text-green-700';
      case 'private': return 'bg-gray-100 text-gray-700';
      case 'event': return 'bg-blue-100 text-blue-700';
      case 'vendor': return 'bg-purple-100 text-purple-700';
      case 'announcement': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }
</script>

<svelte:head>
  <title>Communication - Admin</title>
</svelte:head>

<div>
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Communication Channels</h1>
    <a
      href="/communication"
      class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
    >
      View Hub
    </a>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-purple-600">{data.pagination.totalCount}</div>
      <div class="text-gray-500 text-sm">Total Channels</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-green-600">{data.counts.public}</div>
      <div class="text-gray-500 text-sm">Public</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-gray-600">{data.counts.private}</div>
      <div class="text-gray-500 text-sm">Private</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-blue-600">{data.counts.totalMessages}</div>
      <div class="text-gray-500 text-sm">Total Messages</div>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <div class="flex flex-col md:flex-row gap-4">
      <form on:submit|preventDefault={handleSearch} class="flex-1 flex gap-2">
        <input
          type="text"
          bind:value={search}
          placeholder="Search channels..."
          class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
        <button
          type="submit"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Search
        </button>
      </form>

      <div class="flex flex-wrap gap-2">
        <button
          on:click={() => setTypeFilter('all')}
          class="px-4 py-2 rounded-lg {data.filters.type === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          All
        </button>
        <button
          on:click={() => setTypeFilter('public')}
          class="px-4 py-2 rounded-lg {data.filters.type === 'public' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          Public
        </button>
        <button
          on:click={() => setTypeFilter('private')}
          class="px-4 py-2 rounded-lg {data.filters.type === 'private' ? 'bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          Private
        </button>
      </div>
    </div>
  </div>

  <!-- Channels List -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    {#if data.channels.length === 0}
      <div class="p-8 text-center text-gray-500">
        No channels found.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Channel</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Created By</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Stats</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Last Activity</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            {#each data.channels as channel}
              <tr class="hover:bg-gray-50 {channel.isArchived ? 'opacity-50' : ''}">
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-900">{channel.name}</div>
                  {#if channel.description}
                    <div class="text-sm text-gray-500 truncate max-w-xs">{channel.description}</div>
                  {/if}
                  {#if channel.isArchived}
                    <span class="text-xs text-orange-600">Archived</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-full text-xs font-medium {getTypeBadgeClass(channel.type || 'public')}">
                    {channel.type}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {channel.createdBy?.username || 'Unknown'}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  <div>{channel.participantCount} members</div>
                  <div>{channel.messageCount} messages</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {formatDate(channel.lastActivityAt)}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <a
                      href="/communication/{channel.id}"
                      class="px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded"
                    >
                      View
                    </a>
                    {#if !channel.isArchived}
                      <button
                        on:click={() => archiveChannel(channel.id)}
                        disabled={processingIds.has(channel.id)}
                        class="px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded disabled:opacity-50"
                      >
                        Archive
                      </button>
                    {/if}
                    <button
                      on:click={() => deleteChannel(channel.id)}
                      disabled={processingIds.has(channel.id)}
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
                href="/admin/communication?page={data.pagination.page - 1}&type={data.filters.type}&search={data.filters.search}"
                class="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Previous
              </a>
            {/if}
            {#if data.pagination.page < data.pagination.totalPages}
              <a
                href="/admin/communication?page={data.pagination.page + 1}&type={data.filters.type}&search={data.filters.search}"
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
