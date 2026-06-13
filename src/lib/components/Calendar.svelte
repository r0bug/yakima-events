<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, parseISO } from 'date-fns';
  import EventModal from './EventModal.svelte';
  import MapView from './MapView.svelte';

  const dispatch = createEventDispatcher();

  type ViewType = 'agenda' | 'day' | 'week' | 'month' | 'map';

  interface AgendaItem {
    event: Event;
    seriesCount: number; // 1 = standalone, >1 = collapsed recurring series
    seriesDates: Event[]; // all occurrences when collapsed
  }

  interface AgendaDay {
    date: Date;
    items: AgendaItem[];
  }

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
    image_url?: string;
    featured?: boolean;
    is_unapproved?: boolean;
    categories?: string;
    category_details?: CategoryDetail[];
    linked_shop?: { id: number; name: string; imageUrl?: string | null } | null;
  }

  // Fallback colors when no category is assigned
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

  // Convert a hex color to light/text variants
  function hexToColorSet(hex: string) {
    // Parse hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return {
      bg: hex,
      light: `rgba(${r}, ${g}, ${b}, 0.08)`,
      text: hex,
    };
  }

  function getEventColor(event: Event) {
    // Use category color if available
    if (event.category_details?.length && event.category_details[0].color) {
      return hexToColorSet(event.category_details[0].color);
    }
    // Fallback: hash-based color
    const key = event.source_name || event.title || '';
    return FALLBACK_COLORS[hashString(key) % FALLBACK_COLORS.length];
  }

  function getCategoryName(event: Event): string | null {
    return event.category_details?.[0]?.name || null;
  }

  let currentView: ViewType = 'agenda';
  let currentDate = new Date();
  let events: Event[] = [];
  let loading = true;
  let searchQuery = '';
  let selectedCategory = '';
  let selectedEvent: Event | null = null;
  let showEventModal = false;
  let categories: { id: number; name: string; slug: string; color?: string | null }[] = [];
  let showLegend = true;

  // Category filter: hidden set. All shown by default, click to hide.
  let hiddenCategories: Set<string> = new Set();

  function toggleCategory(slug: string) {
    if (hiddenCategories.has(slug)) {
      hiddenCategories.delete(slug);
    } else {
      hiddenCategories.add(slug);
    }
    hiddenCategories = hiddenCategories; // trigger reactivity
    selectedCategory = '';
    loadEvents();
  }

  function showAllCategories() {
    hiddenCategories = new Set();
    selectedCategory = '';
    loadEvents();
  }

  $: hasHiddenCategories = hiddenCategories.size > 0;

  $: dateRangeText = getDateRangeText(currentDate, currentView);

  $: searchHref = (() => {
    const range = getDateRange(currentDate, currentView);
    return `/search?from=${range.startDate}&to=${range.endDate}`;
  })();

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
      if (hiddenCategories.size > 0) params.append('exclude_categories', [...hiddenCategories].join(','));

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
      case 'map':
        start = date;
        end = addDays(date, 1);
        break;
      case 'week':
        start = startOfWeek(date);
        end = endOfWeek(date);
        break;
      case 'agenda':
        // Day-anchored: list events from the selected day through the end of its month,
        // so stepping forward/back by a day visibly advances the agenda.
        start = date;
        end = endOfMonth(date);
        break;
      case 'month':
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
      case 'map':
        return format(date, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(date);
        const weekEnd = endOfWeek(date);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
      case 'agenda':
      default:
        return format(date, 'MMMM yyyy');
    }
  }

  // ----- Agenda view: collapse recurring series, group by day -----

  let expandedSeries: Set<string> = new Set();

  function seriesKey(e: Event): string {
    return `${(e.title || '').toLowerCase().trim()}|${(e.location || '').toLowerCase().trim()}`;
  }

  function toggleSeries(key: string) {
    if (expandedSeries.has(key)) {
      expandedSeries.delete(key);
    } else {
      expandedSeries.add(key);
    }
    expandedSeries = expandedSeries;
  }

  function buildAgenda(allEvents: Event[]): AgendaDay[] {
    // Group occurrences of the same event (same title + venue)
    const groups = new Map<string, Event[]>();
    for (const e of allEvents) {
      const key = seriesKey(e);
      const group = groups.get(key);
      if (group) group.push(e);
      else groups.set(key, [e]);
    }

    const now = new Date();
    const items: AgendaItem[] = [];

    for (const group of groups.values()) {
      group.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
      if (group.length >= 3) {
        // Recurring series: show once, on its next upcoming date
        const rep = group.find((e) => parseISO(e.start_datetime) >= now) || group[0];
        items.push({ event: rep, seriesCount: group.length, seriesDates: group });
      } else {
        for (const e of group) {
          items.push({ event: e, seriesCount: 1, seriesDates: [e] });
        }
      }
    }

    // Group items by day
    const dayMap = new Map<string, AgendaItem[]>();
    for (const item of items) {
      const dayKey = item.event.start_datetime.slice(0, 10);
      const day = dayMap.get(dayKey);
      if (day) day.push(item);
      else dayMap.set(dayKey, [item]);
    }

    return [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, dayItems]) => ({
        date: parseISO(dayKey),
        items: dayItems.sort((a, b) => {
          // Featured events first, then by start time
          if (!!a.event.featured !== !!b.event.featured) return a.event.featured ? -1 : 1;
          return a.event.start_datetime.localeCompare(b.event.start_datetime);
        }),
      }));
  }

  $: agendaDays = currentView === 'agenda' ? buildAgenda(events) : [];
  $: collapsedCount = agendaDays.reduce(
    (sum, d) => sum + d.items.reduce((s, i) => s + (i.seriesCount > 1 ? i.seriesCount - 1 : 0), 0),
    0
  );

  function dayLabel(date: Date): string {
    if (isSameDay(date, new Date())) return 'Today';
    if (isSameDay(date, addDays(new Date(), 1))) return 'Tomorrow';
    return '';
  }

  function isWeekend(date: Date): boolean {
    const d = date.getDay();
    return d === 0 || d === 5 || d === 6;
  }

  // The ‹ / › arrows always step one day at a time, in every view.
  function navigatePrev() {
    currentDate = addDays(currentDate, -1);
    loadEvents();
  }

  function navigateNext() {
    currentDate = addDays(currentDate, 1);
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
  <nav class="bg-white/80 backdrop-blur-md border-b border-warm-200 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 py-3">
      <div class="flex flex-col lg:flex-row justify-between items-center gap-4">
        <!-- View Toggle -->
        <div class="flex bg-warm-100 rounded-xl p-1 overflow-x-auto">
          {#each [
            { id: 'agenda', label: 'Agenda', icon: 'M4 6h16M4 12h16M4 18h16' },
            { id: 'month', label: 'Month', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'week', label: 'Week', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
            { id: 'day', label: 'Today', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'map', label: 'Map', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
          ] as view}
            <button
              on:click={() => setView(view.id as ViewType)}
              class="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap {currentView === view.id
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20'
                : 'text-stone-600 hover:bg-warm-200 hover:text-stone-900'}"
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
          <button on:click={navigatePrev} class="p-2 rounded-full border border-warm-300 hover:bg-warm-100 text-stone-600 hover:text-stone-900 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 class="text-lg font-display font-bold min-w-[200px] text-center text-stone-800">{dateRangeText}</h2>
          <button on:click={navigateNext} class="p-2 rounded-full border border-warm-300 hover:bg-warm-100 text-stone-600 hover:text-stone-900 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button on:click={goToToday} class="px-3 py-1.5 text-sm border border-warm-300 rounded-lg hover:bg-warm-100 font-medium text-stone-700 transition-colors">
            Today
          </button>
        </div>

        <!-- Search button (links to dedicated /search page with current date range) -->
        <div class="flex gap-2 w-full lg:w-auto">
          <a
            href={searchHref}
            class="flex items-center gap-2 px-4 py-2 border border-warm-300 rounded-lg text-sm font-medium bg-white text-stone-600 hover:text-stone-900 hover:bg-warm-100 transition-colors w-full lg:w-auto"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search events…
          </a>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <!-- Category Filter Bar -->
  {#if categories.length > 0 && showLegend}
    <div class="bg-white/60 backdrop-blur-sm border-b border-warm-100">
      <div class="max-w-7xl mx-auto px-4 py-2">
        <div class="flex flex-wrap items-center gap-1">
          {#if hasHiddenCategories}
            <button
              on:click={showAllCategories}
              class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-800 text-white hover:bg-stone-700 transition-all"
              title="Show all categories"
            >Show All</button>
          {/if}
          {#each categories as cat}
            {@const hidden = hiddenCategories.has(cat.slug)}
            <button
              on:click={() => toggleCategory(cat.slug)}
              class="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
              style="background-color: {cat.color || '#6b7280'}15; color: {cat.color || '#6b7280'};"
              title="{hidden ? 'Show' : 'Hide'} {cat.name}"
            >
              <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: {cat.color || '#6b7280'};"></span>
              {cat.name}
              {#if hidden}
                <span class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span class="block w-[calc(100%-8px)] h-[1.5px] bg-stone-900 rounded-full"></span>
                </span>
              {/if}
            </button>
          {/each}
          <button
            on:click={() => showLegend = false}
            class="p-1 text-stone-400 hover:text-stone-600 ml-auto"
            title="Hide legend"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <div class="max-w-7xl mx-auto px-4 py-6">
    {#if loading}
      <div class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="relative">
          <div class="w-14 h-14 rounded-full border-4 border-warm-200"></div>
          <div class="w-14 h-14 rounded-full border-4 border-amber-500 border-t-transparent animate-spin absolute inset-0"></div>
        </div>
        <p class="text-stone-500 text-sm font-medium">Loading events...</p>
      </div>
    {:else if currentView === 'month'}
      <!-- Month View -->
      <div class="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden animate-fade-in-up">
        <div class="grid grid-cols-7 bg-gradient-to-r from-stone-800 to-stone-700">
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
            <div class="px-2 py-3 text-center text-sm font-semibold text-stone-200 tracking-wide">{day}</div>
          {/each}
        </div>
        <div class="grid grid-cols-7">
          {#each getMonthDays(currentDate) as day}
            {@const dayEvents = getEventsForDate(day).sort((a, b) => {
              if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
              return a.start_datetime.localeCompare(b.start_datetime);
            })}
            {@const busy = dayEvents.length > 3}
            {@const isToday = isSameDay(day, new Date())}
            {@const isSelected = isSameDay(day, currentDate)}
            {@const isCurrentMonth = isSameMonth(day, currentDate)}
            <div
              class="p-1.5 border-b border-r border-warm-100 transition-colors
                {isCurrentMonth ? 'bg-white hover:bg-warm-50' : 'bg-warm-50/50'}
                {isSelected ? 'ring-2 ring-inset ring-orange-500 bg-orange-50/60' : isToday ? 'ring-2 ring-inset ring-amber-400 bg-amber-50/50' : ''}"
              style="min-height: 130px;"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium {isCurrentMonth ? (isToday ? 'text-amber-700 font-bold' : 'text-stone-700') : 'text-stone-400'}">
                  {format(day, 'd')}
                </span>
                {#if dayEvents.length > 0}
                  <span class="text-[10px] font-semibold text-stone-400 bg-stone-100 rounded-full px-1.5">{dayEvents.length}</span>
                {/if}
              </div>
              <div class="space-y-1">
                {#each dayEvents.slice(0, 4) as event}
                  {@const color = getEventColor(event)}
                  <button
                    on:click={() => openEventModal(event)}
                    class="w-full text-left px-1.5 py-1 text-[11px] rounded-md font-medium transition-all hover:scale-[1.02] hover:shadow-sm"
                    style="background-color: {color.light}; color: {color.text}; border-left: 3px solid {color.bg};"
                    title="{event.title} · {format(parseISO(event.start_datetime), 'h:mm a')}{event.location ? ` · ${event.location}` : ''}"
                  >
                    <div class="truncate leading-tight">
                      {#if event.featured}
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-0.5 align-middle"></span>
                      {/if}
                      {event.title}
                    </div>
                    {#if !busy}
                      <div class="text-[10px] opacity-70 leading-tight mt-0.5 truncate">
                        {format(parseISO(event.start_datetime), 'h:mm a')}{event.location ? ` · ${event.location}` : ''}
                      </div>
                    {/if}
                  </button>
                {/each}
                {#if dayEvents.length > 4}
                  <button
                    on:click={() => { currentDate = day; setView('day'); }}
                    class="w-full text-left text-[10px] text-amber-700 font-semibold px-1.5 py-0.5 rounded hover:bg-amber-50 cursor-pointer"
                  >+{dayEvents.length - 4} more</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

    {:else if currentView === 'day'}
      <!-- Day View -->
      <div class="bg-white rounded-2xl shadow-sm border border-warm-200 p-6 animate-fade-in-up">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-display font-bold text-stone-800">
            {getEventsForDate(currentDate).length} Event{getEventsForDate(currentDate).length !== 1 ? 's' : ''} — {format(currentDate, 'MMMM d')}
          </h3>
          <div class="text-sm text-stone-500 font-medium">{format(currentDate, 'EEEE')}</div>
        </div>
        {#if getEventsForDate(currentDate).length === 0}
          <div class="text-center py-16">
            <div class="w-20 h-20 rounded-full bg-warm-100 flex items-center justify-center mx-auto mb-4">
              <svg class="w-10 h-10 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="text-stone-500 font-medium">No events scheduled for this day</p>
            <p class="text-stone-400 text-sm mt-1">Try browsing the month view for more events</p>
          </div>
        {:else}
          <div class="space-y-3 stagger-in">
            {#each getEventsForDate(currentDate) as event}
              {@const color = getEventColor(event)}
              <button
                on:click={() => openEventModal(event)}
                class="event-card w-full text-left p-4 rounded-xl border transition-all
                  {event.featured ? 'bg-amber-50/50 border-amber-200 shadow-sm' : 'border-warm-200 hover:border-warm-300'}"
                style="border-left: 4px solid {color.bg};"
              >
                <div class="flex items-start gap-4">
                  <div class="text-center rounded-xl px-3 py-2 min-w-[60px]" style="background-color: {color.light};">
                    <div class="text-[10px] font-bold uppercase tracking-wider" style="color: {color.text};">{format(parseISO(event.start_datetime), 'MMM')}</div>
                    <div class="text-2xl font-display font-bold" style="color: {color.bg};">{format(parseISO(event.start_datetime), 'd')}</div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-stone-900 text-[15px]">{event.title}</h4>
                    <div class="text-sm text-stone-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span class="flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {format(parseISO(event.start_datetime), 'h:mm a')}
                      </span>
                      {#if event.location}
                        <span class="flex items-center gap-1">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                          <span class="truncate max-w-[200px]">{event.location}</span>
                        </span>
                      {/if}
                    </div>
                    {#if event.description}
                      <p class="text-sm text-stone-400 mt-2 line-clamp-2">{event.description}</p>
                    {/if}
                    <div class="flex items-center gap-2 mt-2 flex-wrap">
                      {#if getCategoryName(event)}
                        <span class="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style="background-color: {color.light}; color: {color.text};">
                          {getCategoryName(event)}
                        </span>
                      {/if}
                      {#if event.linked_shop}
                        <a href="/shops/{event.linked_shop.id}" class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors" on:click|stopPropagation>
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {event.linked_shop.name}
                        </a>
                      {/if}
                    </div>
                  </div>
                  {#if event.featured}
                    <span class="px-2.5 py-1 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 text-xs rounded-full font-semibold flex items-center gap-1 flex-shrink-0">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      Featured
                    </span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

    {:else if currentView === 'agenda'}
      <!-- Agenda View: day-grouped, featured first, recurring series collapsed -->
      <div class="animate-fade-in-up">
        {#if agendaDays.length === 0}
          <div class="bg-white rounded-2xl shadow-sm border border-warm-200 text-center py-16">
            <div class="w-20 h-20 rounded-full bg-warm-100 flex items-center justify-center mx-auto mb-4">
              <svg class="w-10 h-10 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="text-stone-500 font-medium">No events found for this period</p>
          </div>
        {:else}
          {#if collapsedCount > 0}
            <p class="text-xs text-stone-400 mb-3 px-1">
              Recurring classes &amp; meetups are shown once — tap “repeats” to see all dates. ({collapsedCount} repeat dates tucked away)
            </p>
          {/if}
          <div class="space-y-6 stagger-in">
            {#each agendaDays as day}
              {@const label = dayLabel(day.date)}
              <section>
                <!-- Day header -->
                <div class="flex items-baseline gap-2 mb-2 px-1 sticky top-[60px] z-10 py-1.5 bg-warm-50/95 backdrop-blur-sm rounded-lg">
                  <h3 class="font-display font-bold {isWeekend(day.date) ? 'text-amber-700' : 'text-stone-800'} text-lg">
                    {format(day.date, 'EEEE, MMMM d')}
                  </h3>
                  {#if label}
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white">{label}</span>
                  {:else if isWeekend(day.date)}
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Weekend</span>
                  {/if}
                  <span class="text-xs text-stone-400 font-medium ml-auto">{day.items.length} event{day.items.length !== 1 ? 's' : ''}</span>
                </div>

                <div class="space-y-2">
                  {#each day.items as item}
                    {@const event = item.event}
                    {@const color = getEventColor(event)}
                    {@const sKey = seriesKey(event)}
                    <div
                      class="event-card bg-white rounded-xl border transition-all
                        {event.featured ? 'border-amber-300 shadow-md shadow-amber-100 ring-1 ring-amber-200' : 'border-warm-200 hover:border-warm-300 hover:shadow-sm'}"
                      style="border-left: 4px solid {color.bg};"
                    >
                      <button on:click={() => openEventModal(event)} class="w-full text-left p-3.5">
                        <div class="flex items-start gap-3.5">
                          <div class="text-center rounded-lg px-2.5 py-1.5 min-w-[70px]" style="background-color: {color.light};">
                            <div class="text-sm font-bold" style="color: {color.bg};">{format(parseISO(event.start_datetime), 'h:mm')}</div>
                            <div class="text-[10px] font-bold uppercase tracking-wider" style="color: {color.text};">{format(parseISO(event.start_datetime), 'a')}</div>
                          </div>
                          <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-stone-900 {event.featured ? 'text-[16px]' : 'text-[15px]'} leading-snug">
                              {#if event.featured}
                                <svg class="w-4 h-4 inline-block text-amber-500 -mt-0.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                              {/if}
                              {event.title}
                            </h4>
                            <div class="text-sm text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              {#if event.location}
                                <span class="flex items-center gap-1 min-w-0">
                                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                  <span class="truncate max-w-[280px]">{event.location}</span>
                                </span>
                              {/if}
                            </div>
                            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {#if getCategoryName(event)}
                                <span class="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style="background-color: {color.light}; color: {color.text};">
                                  {getCategoryName(event)}
                                </span>
                              {/if}
                              {#if event.linked_shop}
                                <a href="/shops/{event.linked_shop.id}" class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors" on:click|stopPropagation>
                                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                  {event.linked_shop.name}
                                </a>
                              {/if}
                            </div>
                          </div>
                        </div>
                      </button>
                      {#if item.seriesCount > 1}
                        <div class="px-3.5 pb-2.5 -mt-1">
                          <button
                            on:click={() => toggleSeries(sKey)}
                            class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                          >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Repeats · {item.seriesCount} dates
                            <svg class="w-3 h-3 transition-transform {expandedSeries.has(sKey) ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          {#if expandedSeries.has(sKey)}
                            <div class="flex flex-wrap gap-1.5 mt-2">
                              {#each item.seriesDates as occurrence}
                                <button
                                  on:click={() => openEventModal(occurrence)}
                                  class="text-[11px] font-medium px-2 py-1 rounded-lg border border-warm-200 text-stone-600 hover:bg-warm-100 transition-colors"
                                >
                                  {format(parseISO(occurrence.start_datetime), 'EEE MMM d · h:mm a')}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        {/if}
      </div>

    {:else if currentView === 'map'}
      <!-- Map View: events for the selected day -->
      {@const mappable = events.filter((e) => e.latitude && e.longitude)}
      <div class="animate-fade-in-up">
        <div class="flex items-center justify-between mb-4 px-1">
          <h3 class="text-xl font-display font-bold text-stone-800">
            {events.length} Event{events.length !== 1 ? 's' : ''} — {format(currentDate, 'EEEE, MMMM d')}
          </h3>
          {#if events.length > 0}
            <div class="text-sm text-stone-500 font-medium">
              {mappable.length} on the map
            </div>
          {/if}
        </div>
        <MapView {events} on:selectEvent={(e) => openEventModal(e.detail)} />
      </div>

    {:else if currentView === 'week'}
      <!-- Week View -->
      <div class="bg-white rounded-2xl shadow-sm border border-warm-200 p-4 overflow-x-auto animate-fade-in-up">
        <div class="grid grid-cols-7 gap-3 min-w-[700px]">
          {#each Array(7) as _, i}
            {@const day = addDays(startOfWeek(currentDate), i)}
            {@const isToday = isSameDay(day, new Date())}
            {@const isSelected = isSameDay(day, currentDate)}
            <div class="min-h-[400px] rounded-xl {isSelected ? 'bg-orange-50/60 ring-2 ring-orange-500' : isToday ? 'bg-amber-50/50 ring-2 ring-amber-300' : 'bg-warm-50/30'} p-2">
              <div class="text-center pb-2 border-b border-warm-200 mb-2">
                <div class="text-xs text-stone-500 font-medium uppercase tracking-wider">{format(day, 'EEE')}</div>
                <div class="text-xl font-display font-bold {isSelected ? 'text-orange-700' : isToday ? 'text-amber-700' : 'text-stone-800'}">{format(day, 'd')}</div>
              </div>
              <div class="space-y-1.5">
                {#each getEventsForDate(day) as event}
                  {@const color = getEventColor(event)}
                  <button
                    on:click={() => openEventModal(event)}
                    class="w-full text-left p-2 text-xs rounded-lg transition-all hover:shadow-sm hover:scale-[1.02]"
                    style="background-color: {color.light}; border-left: 3px solid {color.bg};"
                  >
                    <div class="font-semibold truncate" style="color: {color.text};">{event.title}</div>
                    <div class="text-stone-500 mt-0.5">{format(parseISO(event.start_datetime), 'h:mm a')}</div>
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
