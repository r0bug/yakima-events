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
    goto(`/admin/events?${params.toString()}`);
  }

  function setStatusFilter(status: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    goto(`/admin/events?${params.toString()}`);
  }

  async function updateEventStatus(eventId: number, newStatus: 'approved' | 'rejected') {
    processingIds.add(eventId);
    processingIds = processingIds;

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Refresh the page data
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to update event:', e);
    } finally {
      processingIds.delete(eventId);
      processingIds = processingIds;
    }
  }

  async function deleteEvent(eventId: number) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    processingIds.add(eventId);
    processingIds = processingIds;

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to delete event:', e);
    } finally {
      processingIds.delete(eventId);
      processingIds = processingIds;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
</script>

<svelte:head>
  <title>Events - Admin</title>
</svelte:head>

<div>
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Events</h1>
    <a
      href="/events/submit"
      class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
    >
      Add Event
    </a>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-purple-600">{data.pagination.totalCount}</div>
      <div class="text-gray-500 text-sm">Total Events</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-yellow-600">{data.counts.pending}</div>
      <div class="text-gray-500 text-sm">Pending Review</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-green-600">{data.counts.approved}</div>
      <div class="text-gray-500 text-sm">Approved</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-blue-600">{data.categories.length}</div>
      <div class="text-gray-500 text-sm">Categories</div>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <div class="flex flex-col md:flex-row gap-4">
      <form on:submit|preventDefault={handleSearch} class="flex-1 flex gap-2">
        <input
          type="text"
          bind:value={search}
          placeholder="Search events..."
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
          on:click={() => setStatusFilter('pending')}
          class="px-4 py-2 rounded-lg {data.filters.status === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          Pending
        </button>
        <button
          on:click={() => setStatusFilter('approved')}
          class="px-4 py-2 rounded-lg {data.filters.status === 'approved' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          Approved
        </button>
      </div>
    </div>
  </div>

  <!-- Events List -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    {#if data.events.length === 0}
      <div class="p-8 text-center text-gray-500">
        No events found.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Event</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Location</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            {#each data.events as event}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-900">{event.title}</div>
                  {#if event.sourceId}
                    <div class="text-xs text-gray-500">Scraped</div>
                  {/if}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {formatDate(event.startDatetime)}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {event.location || 'TBD'}
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-full text-xs font-medium
                    {event.status === 'approved' ? 'bg-green-100 text-green-700' : ''}
                    {event.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                    {event.status === 'rejected' ? 'bg-red-100 text-red-700' : ''}
                  ">
                    {event.status}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    {#if event.status === 'pending'}
                      <button
                        on:click={() => updateEventStatus(event.id, 'approved')}
                        disabled={processingIds.has(event.id)}
                        class="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        on:click={() => updateEventStatus(event.id, 'rejected')}
                        disabled={processingIds.has(event.id)}
                        class="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded disabled:opacity-50"
                      >
                        Reject
                      </button>
                    {/if}
                    <button
                      on:click={() => deleteEvent(event.id)}
                      disabled={processingIds.has(event.id)}
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
                href="/admin/events?page={data.pagination.page - 1}&status={data.filters.status}&search={data.filters.search}"
                class="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Previous
              </a>
            {/if}
            {#if data.pagination.page < data.pagination.totalPages}
              <a
                href="/admin/events?page={data.pagination.page + 1}&status={data.filters.status}&search={data.filters.search}"
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
