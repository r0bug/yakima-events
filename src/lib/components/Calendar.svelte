<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, parseISO } from 'date-fns';
  import EventModal from './EventModal.svelte';
  import MapView from './MapView.svelte';

  const dispatch = createEventDispatcher();

  type ViewType = 'day' | 'week' | 'month' | 'list' | 'map';

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
    image_url?: string;
    featured?: boolean;
    is_unapproved?: boolean;
    categories?: string;
  }

  let currentView: ViewType = 'day';
  let currentDate = new Date();
  let events: Event[] = [];
  let loading = true;
  let searchQuery = '';
  let selectedCategory = '';
  let selectedEvent: Event | null = null;
  let showEventModal = false;
  let categories: { id: number; name: string; slug: string }[] = [];

  $: dateRangeText = getDateRangeText(currentDate, currentView);

  onMount(async () => {
    await Promise.all([loadEvents(), loadCategories()]);
  });

  async function loadEvents() {
    loading = true;
    try {
      const { startDate, endDate } = getDateRange(currentDate, currentView);
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });

      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await fetch(`/api/events?${params}`);
      const data = await response.json();
      events = data.events || [];
    } catch (error) {
      console.error('Error loading events:', error);
      dispatch('toast', { message: 'Failed to load events', type: 'error' });
    } finally {
      loading = false;
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch('/api/events/categories');
      const data = await response.json();
      categories = data.categories || [];
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  function getDateRange(date: Date, view: ViewType) {
    let start: Date, end: Date;

    switch (view) {
      case 'day':
        start = date;
        end = date;
        break;
      case 'week':
        start = startOfWeek(date);
        end = endOfWeek(date);
        break;
      case 'month':
      case 'list':
      case 'map':
      default:
        start = startOfMonth(date);
        end = endOfMonth(date);
    }

    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }

  function getDateRangeText(date: Date, view: ViewType): string {
    switch (view) {
      case 'day':
        return format(date, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(date);
        const weekEnd = endOfWeek(date);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
      case 'list':
      case 'map':
      default:
        return format(date, 'MMMM yyyy');
    }
  }

  function navigatePrev() {
    switch (currentView) {
      case 'day':
        currentDate = addDays(currentDate, -1);
        break;
      case 'week':
        currentDate = addDays(currentDate, -7);
        break;
      default:
        currentDate = subMonths(currentDate, 1);
    }
    loadEvents();
  }

  function navigateNext() {
    switch (currentView) {
      case 'day':
        currentDate = addDays(currentDate, 1);
        break;
      case 'week':
        currentDate = addDays(currentDate, 7);
        break;
      default:
        currentDate = addMonths(currentDate, 1);
    }
    loadEvents();
  }

  function goToToday() {
    currentDate = new Date();
    loadEvents();
  }

  function setView(view: ViewType) {
    currentView = view;
    loadEvents();
  }

  function openEventModal(event: Event) {
    selectedEvent = event;
    showEventModal = true;
  }

  function closeEventModal() {
    showEventModal = false;
    selectedEvent = null;
  }

  function getEventsForDate(date: Date): Event[] {
    return events.filter((event) => {
      const eventDate = parseISO(event.start_datetime);
      return isSameDay(eventDate, date);
    });
  }

  function getMonthDays(date: Date): Date[] {
    const start = startOfWeek(startOfMonth(date));
    const end = endOfWeek(endOfMonth(date));
    const days: Date[] = [];
    let current = start;

    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }

    return days;
  }

  function handleSearch() {
    loadEvents();
  }

  function handleCategoryChange() {
    loadEvents();
  }
</script>

<div class="calendar-container">
  <!-- Navigation Bar -->
  <nav class="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 py-3">
      <div class="flex flex-col lg:flex-row justify-between items-center gap-4">
        <!-- View Toggle -->
        <div class="flex bg-gray-100 rounded-lg p-1 overflow-x-auto">
          {#each [
            { id: 'day', label: 'Today', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'week', label: 'Week', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
            { id: 'month', label: 'Month', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'list', label: 'List', icon: 'M4 6h16M4 12h16M4 18h16' },
            { id: 'map', label: 'Map', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
          ] as view}
            <button
              on:click={() => setView(view.id as ViewType)}
              class="px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap {currentView === view.id
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-200'}"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={view.icon} />
              </svg>
              <span class="hidden sm:inline">{view.label}</span>
            </button>
          {/each}
        </div>

        <!-- Date Navigation -->
        <div class="flex items-center gap-3">
          <button on:click={navigatePrev} class="p-2 rounded-full border border-gray-300 hover:bg-gray-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 class="text-lg font-semibold min-w-[200px] text-center">{dateRangeText}</h2>
          <button on:click={navigateNext} class="p-2 rounded-full border border-gray-300 hover:bg-gray-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button on:click={goToToday} class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
            Today
          </button>
        </div>

        <!-- Filters -->
        <div class="flex gap-2 w-full lg:w-auto">
          <select
            bind:value={selectedCategory}
            on:change={handleCategoryChange}
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Categories</option>
            {#each categories as category}
              <option value={category.slug}>{category.name}</option>
            {/each}
          </select>
          <input
            type="text"
            bind:value={searchQuery}
            on:input={handleSearch}
            placeholder="Search events..."
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 lg:w-48"
          />
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto px-4 py-6">
    {#if loading}
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    {:else if currentView === 'day'}
      <!-- Day View -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-xl font-semibold mb-4">
          {getEventsForDate(currentDate).length} Events Today
        </h3>
        {#if getEventsForDate(currentDate).length === 0}
          <div class="text-center py-12 text-gray-500">
            <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>No events scheduled for this day</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each getEventsForDate(currentDate) as event}
              <button
                on:click={() => openEventModal(event)}
                class="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all {event.featured ? 'bg-blue-50 border-blue-200' : ''}"
              >
                <div class="flex items-start gap-4">
                  <div class="text-center bg-blue-100 rounded-lg px-3 py-2 min-w-[60px]">
                    <div class="text-xs text-blue-600 uppercase">{format(parseISO(event.start_datetime), 'MMM')}</div>
                    <div class="text-2xl font-bold text-blue-700">{format(parseISO(event.start_datetime), 'd')}</div>
                  </div>
                  <div class="flex-1">
                    <h4 class="font-semibold text-gray-900">{event.title}</h4>
                    <div class="text-sm text-gray-600 mt-1">
                      <span>{format(parseISO(event.start_datetime), 'h:mm a')}</span>
                      {#if event.location}
                        <span class="mx-2">•</span>
                        <span>{event.location}</span>
                      {/if}
                    </div>
                    {#if event.description}
                      <p class="text-sm text-gray-500 mt-2 line-clamp-2">{event.description}</p>
                    {/if}
                  </div>
                  {#if event.featured}
                    <span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Featured</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else if currentView === 'month'}
      <!-- Month View -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div class="grid grid-cols-7 bg-gray-50">
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
            <div class="px-2 py-3 text-center text-sm font-semibold text-gray-700 border-b">{day}</div>
          {/each}
        </div>
        <div class="grid grid-cols-7">
          {#each getMonthDays(currentDate) as day}
            <div
              class="min-h-[100px] p-2 border-b border-r border-gray-100 {isSameMonth(day, currentDate)
                ? 'bg-white'
                : 'bg-gray-50'} {isSameDay(day, new Date()) ? 'bg-blue-50' : ''}"
            >
              <div class="font-medium text-sm {isSameMonth(day, currentDate) ? 'text-gray-900' : 'text-gray-400'}">
                {format(day, 'd')}
              </div>
              <div class="mt-1 space-y-1">
                {#each getEventsForDate(day).slice(0, 3) as event}
                  <button
                    on:click={() => openEventModal(event)}
                    class="w-full text-left px-2 py-1 text-xs rounded truncate {event.featured
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'} hover:bg-blue-200"
                  >
                    {event.title}
                  </button>
                {/each}
                {#if getEventsForDate(day).length > 3}
                  <div class="text-xs text-gray-500 px-2">+{getEventsForDate(day).length - 3} more</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if currentView === 'list'}
      <!-- List View -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        {#if events.length === 0}
          <div class="text-center py-12 text-gray-500">
            <p>No events found for this period</p>
          </div>
        {:else}
          <div class="divide-y divide-gray-200">
            {#each events as event}
              <button
                on:click={() => openEventModal(event)}
                class="w-full text-left p-4 hover:bg-gray-50 transition-colors"
              >
                <div class="flex items-center gap-4">
                  <div class="text-center bg-blue-100 rounded-lg px-3 py-2 min-w-[60px]">
                    <div class="text-xs text-blue-600 uppercase">{format(parseISO(event.start_datetime), 'MMM')}</div>
                    <div class="text-2xl font-bold text-blue-700">{format(parseISO(event.start_datetime), 'd')}</div>
                  </div>
                  <div class="flex-1">
                    <h4 class="font-semibold text-gray-900">{event.title}</h4>
                    <div class="text-sm text-gray-600">
                      {format(parseISO(event.start_datetime), 'h:mm a')}
                      {#if event.location}
                        <span class="mx-2">•</span>
                        {event.location}
                      {/if}
                    </div>
                  </div>
                  {#if event.featured}
                    <span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Featured</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else if currentView === 'map'}
      <!-- Map View -->
      <MapView {events} on:selectEvent={(e) => openEventModal(e.detail)} />
    {:else if currentView === 'week'}
      <!-- Week View (simplified) -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="grid grid-cols-7 gap-4">
          {#each Array(7) as _, i}
            {@const day = addDays(startOfWeek(currentDate), i)}
            <div class="min-h-[400px] border-r border-gray-100 last:border-r-0 px-2">
              <div class="text-center pb-2 border-b mb-2 {isSameDay(day, new Date()) ? 'bg-blue-50 rounded-t-lg' : ''}">
                <div class="text-xs text-gray-500">{format(day, 'EEE')}</div>
                <div class="text-lg font-semibold">{format(day, 'd')}</div>
              </div>
              <div class="space-y-2">
                {#each getEventsForDate(day) as event}
                  <button
                    on:click={() => openEventModal(event)}
                    class="w-full text-left p-2 text-xs rounded bg-blue-100 text-blue-800 hover:bg-blue-200 truncate"
                  >
                    <div class="font-medium truncate">{event.title}</div>
                    <div class="text-blue-600">{format(parseISO(event.start_datetime), 'h:mm a')}</div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Event Modal -->
{#if showEventModal && selectedEvent}
  <EventModal event={selectedEvent} on:close={closeEventModal} />
{/if}
