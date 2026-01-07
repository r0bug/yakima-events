<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import MapView from '$lib/components/MapView.svelte';

  interface Event {
    id: number;
    title: string;
    description: string | null;
    startDatetime: string;
    endDatetime: string | null;
    location: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  }

  interface Shop {
    id: number;
    name: string;
    description: string | null;
    address: string;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    categoryId: number | null;
  }

  let events: Event[] = [];
  let shops: Shop[] = [];
  let loading = true;

  let showEvents = true;
  let showShops = true;
  let selectedItem: Event | Shop | null = null;
  let itemType: 'event' | 'shop' | null = null;

  // Yakima, WA center
  const defaultCenter = { lat: 46.6021, lng: -120.5059 };

  async function loadData() {
    loading = true;
    try {
      const [eventsRes, shopsRes] = await Promise.all([
        fetch('/api/events?status=approved'),
        fetch('/api/shops?status=active')
      ]);

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        events = (data.events || data).filter((e: Event) => e.latitude && e.longitude);
      }

      if (shopsRes.ok) {
        const data = await shopsRes.json();
        shops = (data.shops || data).filter((s: Shop) => s.latitude && s.longitude);
      }
    } catch (e) {
      console.error('Failed to load map data:', e);
    } finally {
      loading = false;
    }
  }

  function handleMarkerClick(item: Event | Shop, type: 'event' | 'shop') {
    selectedItem = item;
    itemType = type;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  $: displayedEvents = showEvents ? events : [];
  $: displayedShops = showShops ? shops : [];

  onMount(() => {
    loadData();
  });
</script>

<svelte:head>
  <title>Map - Yakima Events & Shops</title>
</svelte:head>

<Header />

<main class="h-[calc(100vh-64px)] flex flex-col">
  <!-- Controls -->
  <div class="bg-white border-b px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-6">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={showEvents}
          class="rounded text-purple-600 focus:ring-purple-500"
        />
        <span class="text-sm font-medium text-gray-700">
          Events <span class="text-gray-400">({events.length})</span>
        </span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={showShops}
          class="rounded text-blue-600 focus:ring-blue-500"
        />
        <span class="text-sm font-medium text-gray-700">
          Shops <span class="text-gray-400">({shops.length})</span>
        </span>
      </label>
    </div>

    <div class="flex items-center gap-4 text-sm">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-purple-600"></span>
        <span class="text-gray-600">Events</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-blue-600"></span>
        <span class="text-gray-600">Shops</span>
      </div>
    </div>
  </div>

  <!-- Map Container -->
  <div class="flex-1 relative">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center bg-gray-100">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    {:else}
      <MapView
        events={displayedEvents}
        shops={displayedShops}
        center={defaultCenter}
        zoom={12}
      />
    {/if}

    <!-- Info Panel -->
    {#if selectedItem}
      <div class="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-lg border overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b bg-gray-50">
          <span class="text-sm font-medium text-gray-500">
            {itemType === 'event' ? 'Event' : 'Shop'} Details
          </span>
          <button
            class="text-gray-400 hover:text-gray-600"
            on:click={() => { selectedItem = null; itemType = null; }}
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="p-4">
          {#if itemType === 'event'}
            {@const event = selectedItem as Event}
            <h3 class="font-semibold text-gray-900 mb-2">{event.title}</h3>
            <p class="text-sm text-purple-600 mb-2">{formatDate(event.startDatetime)}</p>
            {#if event.location}
              <p class="text-sm text-gray-600 mb-2">{event.location}</p>
            {/if}
            {#if event.description}
              <p class="text-sm text-gray-500 line-clamp-3">{event.description}</p>
            {/if}
            <a
              href="/calendar?event={event.id}"
              class="mt-4 inline-block text-purple-600 hover:underline text-sm"
            >
              View Details →
            </a>
          {:else}
            {@const shop = selectedItem as Shop}
            <h3 class="font-semibold text-gray-900 mb-2">{shop.name}</h3>
            <p class="text-sm text-gray-600 mb-2">{shop.address}</p>
            {#if shop.phone}
              <p class="text-sm text-gray-500 mb-2">{shop.phone}</p>
            {/if}
            {#if shop.description}
              <p class="text-sm text-gray-500 line-clamp-3">{shop.description}</p>
            {/if}
            <a
              href="/shops/{shop.id}"
              class="mt-4 inline-block text-purple-600 hover:underline text-sm"
            >
              View Details →
            </a>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</main>
