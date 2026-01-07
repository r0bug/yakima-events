<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { format, parseISO } from 'date-fns';

  interface Event {
    id: number;
    title: string;
    description?: string;
    start_datetime: string;
    end_datetime?: string;
    location?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    external_url?: string;
    source_name?: string;
    source_url?: string;
    image_url?: string;
    featured?: boolean;
    is_unapproved?: boolean;
    categories?: string;
  }

  export let event: Event;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function getDirections() {
    if (event.latitude && event.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`,
        '_blank'
      );
    }
  }

  function addToCalendar() {
    const startDate = new Date(event.start_datetime);
    const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatForCalendar = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${formatForCalendar(startDate)}/${formatForCalendar(endDate)}`,
      details: event.description || '',
      location: event.location || '',
    });

    window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-backdrop" on:click={close} on:keydown={handleKeydown} role="button" tabindex="-1">
  <div
    class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
  >
    <!-- Header -->
    <div class="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
      <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
        {event.title}
        {#if event.featured}
          <span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Featured</span>
        {/if}
      </h2>
      <button on:click={close} class="p-2 hover:bg-gray-100 rounded-full">
        <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="px-6 py-4 space-y-4">
      {#if event.is_unapproved}
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <svg class="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-sm text-yellow-800">This event is pending verification and has not been reviewed yet.</p>
        </div>
      {/if}

      <!-- Date & Time -->
      <div class="flex items-center gap-3 text-gray-700">
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div>
          <div class="font-medium">
            {format(parseISO(event.start_datetime), 'EEEE, MMMM d, yyyy')}
          </div>
          <div class="text-sm text-gray-500">
            {format(parseISO(event.start_datetime), 'h:mm a')}
            {#if event.end_datetime}
              - {format(parseISO(event.end_datetime), 'h:mm a')}
            {/if}
          </div>
        </div>
      </div>

      <!-- Location -->
      {#if event.location || event.address}
        <div class="flex items-center gap-3 text-gray-700">
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            {#if event.location}
              <div class="font-medium">{event.location}</div>
            {/if}
            {#if event.address}
              <div class="text-sm text-gray-500">{event.address}</div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Description -->
      {#if event.description}
        <div class="border-t pt-4">
          <h3 class="font-semibold text-gray-900 mb-2">About this event</h3>
          <p class="text-gray-700 whitespace-pre-line">{event.description}</p>
        </div>
      {/if}

      <!-- Categories -->
      {#if event.categories}
        <div class="flex flex-wrap gap-2">
          {#each event.categories.split(',') as category}
            <span class="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
              {category.trim()}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Source -->
      {#if event.source_name}
        <div class="border-t pt-4 text-sm text-gray-500">
          <span>Source:</span>
          {#if event.external_url}
            <a href={event.external_url} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
              {event.source_name}
            </a>
          {:else}
            <span>{event.source_name}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex flex-wrap gap-3">
      {#if event.external_url}
        <a
          href={event.external_url}
          target="_blank"
          rel="noopener noreferrer"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          More Info
        </a>
      {/if}

      {#if event.latitude && event.longitude}
        <button
          on:click={getDirections}
          class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Get Directions
        </button>
      {/if}

      <button
        on:click={addToCalendar}
        class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Add to Calendar
      </button>
    </div>
  </div>
</div>
