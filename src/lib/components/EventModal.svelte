<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { format, parseISO } from 'date-fns';
  import { fly, fade } from 'svelte/transition';

  interface CategoryDetail {
    name: string;
    slug: string;
    color: string | null;
  }

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
    category_details?: CategoryDetail[];
    linked_shop?: { id: number; name: string; imageUrl?: string | null } | null;
  }

  const FALLBACK_COLORS = [
    { bg: '#c2410c', light: '#fff7ed', text: '#9a3412' },
    { bg: '#0d9488', light: '#f0fdfa', text: '#0f766e' },
    { bg: '#7c3aed', light: '#f5f3ff', text: '#6d28d9' },
    { bg: '#db2777', light: '#fdf2f8', text: '#be185d' },
    { bg: '#2563eb', light: '#eff6ff', text: '#1d4ed8' },
    { bg: '#ca8a04', light: '#fefce8', text: '#a16207' },
    { bg: '#059669', light: '#ecfdf5', text: '#047857' },
    { bg: '#dc2626', light: '#fef2f2', text: '#b91c1c' },
    { bg: '#4f46e5', light: '#eef2ff', text: '#4338ca' },
    { bg: '#ea580c', light: '#fff7ed', text: '#c2410c' },
  ];

  function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function hexToColorSet(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { bg: hex, light: `rgba(${r}, ${g}, ${b}, 0.08)`, text: hex };
  }

  function getEventColor(event: Event) {
    if (event.category_details?.length && event.category_details[0].color) {
      return hexToColorSet(event.category_details[0].color);
    }
    const key = event.source_name || event.title || '';
    return FALLBACK_COLORS[hashString(key) % FALLBACK_COLORS.length];
  }

  export let event: Event;

  const dispatch = createEventDispatcher();
  const color = getEventColor(event);

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

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" transition:fade={{ duration: 200 }} on:click={close} role="button" tabindex="-1">
  <div
    class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
    transition:fly={{ y: 30, duration: 300 }}
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
  >
    <!-- Color accent bar -->
    <div class="h-1.5 w-full" style="background: linear-gradient(to right, {color.bg}, {color.bg}88);"></div>

    <!-- Header -->
    <div class="px-6 py-4 flex items-start justify-between gap-4 border-b border-warm-100">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-xl font-display font-bold text-stone-900">{event.title}</h2>
          {#if event.featured}
            <span class="px-2.5 py-0.5 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 text-xs rounded-full font-semibold flex items-center gap-1">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              Featured
            </span>
          {/if}
        </div>
        {#if event.category_details?.length}
          <span class="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style="background-color: {color.light}; color: {color.text};">
            {event.category_details[0].name}
          </span>
        {/if}
      </div>
      <button on:click={close} class="p-2 hover:bg-warm-100 rounded-full transition-colors flex-shrink-0">
        <svg class="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="px-6 py-5 space-y-4 overflow-y-auto flex-1">
      {#if event.is_unapproved}
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-sm text-amber-800">This event is pending verification and has not been reviewed yet.</p>
        </div>
      {/if}

      <!-- Date & Time -->
      <div class="flex items-center gap-4">
        <div class="text-center rounded-xl px-4 py-3" style="background-color: {color.light};">
          <div class="text-[10px] font-bold uppercase tracking-wider" style="color: {color.text};">{format(parseISO(event.start_datetime), 'MMM')}</div>
          <div class="text-3xl font-display font-bold" style="color: {color.bg};">{format(parseISO(event.start_datetime), 'd')}</div>
          <div class="text-[10px] font-medium" style="color: {color.text};">{format(parseISO(event.start_datetime), 'EEE')}</div>
        </div>
        <div>
          <div class="font-semibold text-stone-800">
            {format(parseISO(event.start_datetime), 'EEEE, MMMM d, yyyy')}
          </div>
          <div class="text-sm text-stone-500 mt-0.5">
            {format(parseISO(event.start_datetime), 'h:mm a')}
            {#if event.end_datetime}
              - {format(parseISO(event.end_datetime), 'h:mm a')}
            {/if}
          </div>
        </div>
      </div>

      <!-- Location -->
      {#if event.location || event.address}
        <div class="flex items-start gap-3 text-stone-700 bg-warm-50 rounded-xl p-4">
          <svg class="w-5 h-5 text-stone-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            {#if event.location}
              <div class="font-medium">{event.location}</div>
            {/if}
            {#if event.address}
              <div class="text-sm text-stone-500">{event.address}</div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Linked Shop -->
      {#if event.linked_shop}
        <a href="/shops/{event.linked_shop.id}" class="flex items-center gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors border border-amber-200/50">
          <div class="w-10 h-10 rounded-lg bg-amber-200/50 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-amber-900">{event.linked_shop.name}</div>
            <div class="text-xs text-amber-600">View shop details →</div>
          </div>
        </a>
      {/if}

      <!-- Description -->
      {#if event.description}
        <div class="border-t border-warm-100 pt-4">
          <h3 class="font-display font-semibold text-stone-900 mb-2">About this event</h3>
          <p class="text-stone-600 whitespace-pre-line leading-relaxed">{event.description}</p>
        </div>
      {/if}

      <!-- Categories -->
      {#if event.categories}
        <div class="flex flex-wrap gap-2">
          {#each event.categories.split(',') as category}
            <span class="px-3 py-1 text-sm rounded-full font-medium" style="background-color: {color.light}; color: {color.text};">
              {category.trim()}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Source -->
      {#if event.source_name}
        <div class="border-t border-warm-100 pt-4 text-sm text-stone-400">
          <span>Source:</span>
          {#if event.external_url}
            <a href={event.external_url} target="_blank" rel="noopener noreferrer" class="text-amber-700 hover:text-amber-800 hover:underline font-medium">
              {event.source_name}
            </a>
          {:else}
            <span class="text-stone-500">{event.source_name}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="bg-warm-50 border-t border-warm-200 px-6 py-4 flex flex-wrap gap-3">
      {#if event.external_url}
        <a
          href={event.external_url}
          target="_blank"
          rel="noopener noreferrer"
          class="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 flex items-center gap-2 font-medium shadow-sm transition-all"
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
          class="px-4 py-2.5 border border-warm-300 rounded-xl hover:bg-warm-100 flex items-center gap-2 font-medium text-stone-700 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Directions
        </button>
      {/if}

      <button
        on:click={addToCalendar}
        class="px-4 py-2.5 border border-warm-300 rounded-xl hover:bg-warm-100 flex items-center gap-2 font-medium text-stone-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Add to Calendar
      </button>

      <a
        href="/events/{event.id}"
        class="px-4 py-2.5 border border-warm-300 rounded-xl hover:bg-warm-100 flex items-center gap-2 font-medium text-stone-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Full Details
      </a>
    </div>
  </div>
</div>
