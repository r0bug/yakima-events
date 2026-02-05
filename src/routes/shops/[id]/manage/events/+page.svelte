<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Header from '$lib/components/Header.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  interface ShopParticipant {
    id: number;
    shopId: number;
    status: 'pending' | 'approved' | 'rejected';
    shopName: string;
  }

  interface ShopEvent {
    id: number;
    title: string;
    description: string | null;
    startDatetime: string;
    endDatetime: string | null;
    location: string | null;
    primaryShopId: number | null;
    primaryShopName: string | null;
    isCollaborative: boolean;
    proposalStatus: string | null;
    status: string;
    participants: ShopParticipant[];
    createdAt: string;
  }

  let shopId: number;
  let shopName = '';
  let events: ShopEvent[] = [];
  let pendingProposals: ShopEvent[] = [];
  let loading = true;
  let error: string | null = null;

  // Create event form
  let showCreateForm = false;
  let creating = false;
  let createError: string | null = null;
  let eventForm = {
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    address: '',
  };

  async function loadEvents() {
    if (!data.user) {
      goto(`/login?return=${encodeURIComponent($page.url.pathname)}`);
      return;
    }

    loading = true;
    error = null;
    shopId = parseInt($page.params.id);

    try {
      // Load shop name
      const shopRes = await fetch(`/api/shops/${shopId}`);
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        shopName = shopData.shop?.name || shopData.name || 'Shop';
      }

      // Load events
      const eventsRes = await fetch(`/api/shops/${shopId}/events?pending=true`);
      if (!eventsRes.ok) {
        const data = await eventsRes.json();
        throw new Error(data.error || 'Failed to load events');
      }
      const eventsData = await eventsRes.json();
      events = eventsData.events || [];
      pendingProposals = eventsData.pending || [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load events';
    } finally {
      loading = false;
    }
  }

  function openCreateForm() {
    showCreateForm = true;
    eventForm = {
      title: '',
      description: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      location: '',
      address: '',
    };
    createError = null;
  }

  async function createEvent() {
    creating = true;
    createError = null;

    try {
      const startDatetime = new Date(`${eventForm.startDate}T${eventForm.startTime}`).toISOString();
      let endDatetime = null;
      if (eventForm.endDate && eventForm.endTime) {
        endDatetime = new Date(`${eventForm.endDate}T${eventForm.endTime}`).toISOString();
      }

      const res = await fetch(`/api/shops/${shopId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventForm.title,
          description: eventForm.description || null,
          startDatetime,
          endDatetime,
          location: eventForm.location || null,
          address: eventForm.address || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      showCreateForm = false;
      await loadEvents();
    } catch (e) {
      createError = e instanceof Error ? e.message : 'Failed to create event';
    } finally {
      creating = false;
    }
  }

  async function respondToProposal(eventId: number, action: 'approve' | 'reject') {
    try {
      const res = await fetch(`/api/events/${eventId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to respond');
      }

      await loadEvents();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to respond to proposal');
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  onMount(loadEvents);
</script>

<svelte:head>
  <title>Events - {shopName} - Yakima</title>
</svelte:head>

<Header user={data.user} />

<main class="container mx-auto px-4 py-8 max-w-4xl">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      {error}
    </div>
    <a href="/shops" class="text-purple-600 hover:underline">← Back to shops</a>
  {:else}
    <!-- Breadcrumb -->
    <nav class="mb-6 text-sm">
      <a href="/shops/{shopId}/manage" class="text-purple-600 hover:underline">← Back to Dashboard</a>
    </nav>

    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Events</h1>
        <p class="text-gray-600">{shopName}</p>
      </div>
      <button
        on:click={openCreateForm}
        class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        + Create Event
      </button>
    </div>

    <!-- Create Form Modal -->
    {#if showCreateForm}
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Create Event</h2>

          {#if createError}
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {createError}
            </div>
          {/if}

          <form on:submit|preventDefault={createEvent} class="space-y-4">
            <div>
              <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
                Title <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                bind:value={eventForm.title}
                required
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                bind:value={eventForm.description}
                rows="3"
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
                  Start Date <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="startDate"
                  bind:value={eventForm.startDate}
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label for="startTime" class="block text-sm font-medium text-gray-700 mb-1">
                  Start Time <span class="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="startTime"
                  bind:value={eventForm.startTime}
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  bind:value={eventForm.endDate}
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label for="endTime" class="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  id="endTime"
                  bind:value={eventForm.endTime}
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label for="location" class="block text-sm font-medium text-gray-700 mb-1">
                Location Name
              </label>
              <input
                type="text"
                id="location"
                bind:value={eventForm.location}
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Our Shop"
              />
            </div>

            <div>
              <label for="address" class="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                id="address"
                bind:value={eventForm.address}
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="123 Main St, Yakima, WA"
              />
            </div>

            <div class="flex gap-3 pt-4">
              <button
                type="button"
                on:click={() => showCreateForm = false}
                class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}

    <!-- Pending Proposals -->
    {#if pendingProposals.length > 0}
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          Pending Invitations ({pendingProposals.length})
        </h2>
        <div class="space-y-4">
          {#each pendingProposals as proposal}
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div class="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div>
                  <h3 class="font-semibold text-gray-900">{proposal.title}</h3>
                  <p class="text-sm text-gray-600">{formatDate(proposal.startDatetime)}</p>
                  {#if proposal.primaryShopName}
                    <p class="text-sm text-gray-500">Proposed by {proposal.primaryShopName}</p>
                  {/if}
                </div>
                <div class="flex gap-2">
                  <button
                    on:click={() => respondToProposal(proposal.id, 'reject')}
                    class="px-3 py-1 border border-red-600 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    on:click={() => respondToProposal(proposal.id, 'approve')}
                    class="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                  >
                    Accept
                  </button>
                </div>
              </div>
              {#if proposal.description}
                <p class="text-sm text-gray-600">{proposal.description}</p>
              {/if}
              {#if proposal.participants.length > 1}
                <div class="mt-2">
                  <span class="text-xs text-gray-500">Participants: </span>
                  {#each proposal.participants as p, i}
                    <span class="text-xs {p.status === 'approved' ? 'text-green-600' : p.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}">
                      {p.shopName}{i < proposal.participants.length - 1 ? ', ' : ''}
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Events List -->
    <div>
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Your Events ({events.length})</h2>
      {#if events.length === 0}
        <div class="bg-white rounded-lg border p-12 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-gray-500 mb-4">No events yet</p>
          <button
            on:click={openCreateForm}
            class="text-purple-600 hover:underline"
          >
            Create your first event
          </button>
        </div>
      {:else}
        <div class="space-y-4">
          {#each events as event}
            <div class="bg-white rounded-lg border p-4">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-gray-900">{event.title}</h3>
                    {#if event.isCollaborative}
                      <span class="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                        Collaborative
                      </span>
                    {/if}
                  </div>
                  <p class="text-sm text-gray-600">{formatDate(event.startDatetime)}</p>
                  {#if event.location}
                    <p class="text-sm text-gray-500">{event.location}</p>
                  {/if}
                </div>
                <span class="px-2 py-1 rounded text-xs font-medium {
                  event.status === 'approved' ? 'bg-green-100 text-green-800' :
                  event.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }">
                  {event.status}
                </span>
              </div>
              {#if event.description}
                <p class="mt-2 text-sm text-gray-600 line-clamp-2">{event.description}</p>
              {/if}
              {#if event.isCollaborative && event.participants.length > 0}
                <div class="mt-3 flex flex-wrap gap-1">
                  {#each event.participants as p}
                    <span class="px-2 py-0.5 rounded-full text-xs {
                      p.status === 'approved' ? 'bg-green-100 text-green-700' :
                      p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }">
                      {p.shopName}
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</main>
