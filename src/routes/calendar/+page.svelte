<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Header from '$lib/components/Header.svelte';
  import Calendar from '$lib/components/Calendar.svelte';
  import EventModal from '$lib/components/EventModal.svelte';

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
    externalUrl: string | null;
    status: string;
    featured: boolean;
  }

  let selectedEvent: Event | null = null;
  let showModal = false;

  function handleEventSelect(event: CustomEvent<Event>) {
    selectedEvent = event.detail;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedEvent = null;
  }

  // Check for event ID in URL params on mount
  onMount(async () => {
    const eventId = $page.url.searchParams.get('event');
    if (eventId) {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (res.ok) {
          selectedEvent = await res.json();
          showModal = true;
        }
      } catch (e) {
        console.error('Failed to load event:', e);
      }
    }
  });
</script>

<svelte:head>
  <title>Event Calendar - Yakima</title>
</svelte:head>

<Header />

<main class="container mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Event Calendar</h1>
    <p class="text-gray-600">Discover events happening in Yakima and the surrounding area</p>
  </div>

  <Calendar on:eventSelect={handleEventSelect} />
</main>

{#if showModal && selectedEvent}
  <EventModal event={selectedEvent} on:close={closeModal} />
{/if}
