<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { PUBLIC_DEFAULT_LAT, PUBLIC_DEFAULT_LNG, PUBLIC_DEFAULT_ZOOM } from '$env/static/public';
  import { format, parseISO } from 'date-fns';

  interface Event {
    id: number;
    title: string;
    start_datetime: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    source_name?: string;
  }

  interface Shop {
    id: number;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    category_name?: string;
  }

  export let events: Event[] = [];
  export let shops: Shop[] = [];
  export let showEvents = true;
  export let showShops = true;

  const dispatch = createEventDispatcher();

  // Same color system as Calendar
  const MARKER_COLORS = [
    '#c2410c', '#0d9488', '#7c3aed', '#db2777', '#2563eb',
    '#ca8a04', '#059669', '#dc2626', '#4f46e5', '#ea580c',
  ];

  function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getMarkerColor(event: Event): string {
    const key = event.source_name || event.title || '';
    return MARKER_COLORS[hashString(key) % MARKER_COLORS.length];
  }

  let mapContainer: HTMLDivElement;
  let map: google.maps.Map | null = null;
  let markers: google.maps.Marker[] = [];
  let infoWindow: google.maps.InfoWindow | null = null;
  let mapsLoaded = false;

  const defaultCenter = {
    lat: parseFloat(PUBLIC_DEFAULT_LAT || '46.600825'),
    lng: parseFloat(PUBLIC_DEFAULT_LNG || '-120.503357'),
  };
  const defaultZoom = parseInt(PUBLIC_DEFAULT_ZOOM || '12');

  onMount(async () => {
    if (browser) {
      await loadGoogleMaps();
    }
  });

  onDestroy(() => {
    clearMarkers();
  });

  async function loadGoogleMaps() {
    // Check if Google Maps is already loaded
    if (window.google?.maps) {
      mapsLoaded = true;
      initMap();
      return;
    }

    // Load Google Maps API dynamically
    try {
      const { Loader } = await import('@googlemaps/js-api-loader');
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        version: 'weekly',
        libraries: ['places'],
      });

      await loader.load();
      mapsLoaded = true;
      initMap();
    } catch (error) {
      console.error('Error loading Google Maps:', error);
    }
  }

  function initMap() {
    if (!mapContainer || !window.google?.maps) return;

    map = new google.maps.Map(mapContainer, {
      center: defaultCenter,
      zoom: defaultZoom,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
        {
          featureType: 'water',
          elementType: 'geometry.fill',
          stylers: [{ color: '#d4e8f0' }],
        },
        {
          featureType: 'landscape',
          elementType: 'geometry.fill',
          stylers: [{ color: '#f5f0e8' }],
        },
      ],
    });

    infoWindow = new google.maps.InfoWindow();

    updateMarkers();
  }

  function clearMarkers() {
    markers.forEach((marker) => marker.setMap(null));
    markers = [];
  }

  function updateMarkers() {
    if (!map) return;

    clearMarkers();

    // Add event markers
    if (showEvents) {
      events.forEach((event) => {
        if (event.latitude && event.longitude) {
          addEventMarker(event);
        }
      });
    }

    // Add shop markers
    if (showShops) {
      shops.forEach((shop) => {
        if (shop.latitude && shop.longitude) {
          addShopMarker(shop);
        }
      });
    }

    // Fit bounds if we have markers
    if (markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((marker) => {
        const pos = marker.getPosition();
        if (pos) bounds.extend(pos);
      });
      map.fitBounds(bounds);

      // Don't zoom too close
      const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        if (map && map.getZoom()! > 15) {
          map.setZoom(15);
        }
      });
    }
  }

  function addEventMarker(event: Event) {
    if (!map || !event.latitude || !event.longitude) return;

    const color = getMarkerColor(event);

    const marker = new google.maps.Marker({
      position: { lat: Number(event.latitude), lng: Number(event.longitude) },
      map,
      title: event.title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: color,
        fillOpacity: 0.9,
        strokeColor: '#ffffff',
        strokeWeight: 2.5,
      },
    });

    marker.addListener('click', () => {
      if (!infoWindow) return;

      const timeStr = event.start_datetime ? format(parseISO(event.start_datetime), 'MMM d, h:mm a') : '';

      const content = `
        <div style="padding: 8px; max-width: 260px; font-family: Inter, sans-serif;">
          <div style="width: 100%; height: 4px; background: ${color}; border-radius: 4px; margin-bottom: 8px;"></div>
          <h4 style="font-weight: 600; color: #1c1917; font-size: 14px; margin: 0 0 4px;">${event.title}</h4>
          ${timeStr ? `<p style="font-size: 12px; color: #78716c; margin: 0 0 2px;">${timeStr}</p>` : ''}
          ${event.location ? `<p style="font-size: 12px; color: #78716c; margin: 0 0 8px;">${event.location}</p>` : ''}
          <button
            onclick="window.dispatchEvent(new CustomEvent('selectEvent', { detail: ${event.id} }))"
            style="margin-top: 6px; padding: 6px 14px; background: linear-gradient(to right, #f59e0b, #ea580c); color: white; font-size: 12px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer;"
          >
            View Details
          </button>
        </div>
      `;

      infoWindow.setContent(content);
      infoWindow.open(map, marker);
    });

    markers.push(marker);
  }

  function addShopMarker(shop: Shop) {
    if (!map || !shop.latitude || !shop.longitude) return;

    const marker = new google.maps.Marker({
      position: { lat: Number(shop.latitude), lng: Number(shop.longitude) },
      map,
      title: shop.name,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: '#059669',
        fillOpacity: 0.9,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    marker.addListener('click', () => {
      if (!infoWindow) return;

      const content = `
        <div style="padding: 8px; max-width: 240px; font-family: Inter, sans-serif;">
          <div style="width: 100%; height: 4px; background: #059669; border-radius: 4px; margin-bottom: 8px;"></div>
          <h4 style="font-weight: 600; color: #1c1917; font-size: 14px; margin: 0 0 4px;">${shop.name}</h4>
          ${shop.category_name ? `<p style="font-size: 12px; color: #78716c; margin: 0 0 2px;">${shop.category_name}</p>` : ''}
          ${shop.address ? `<p style="font-size: 12px; color: #78716c; margin: 0;">${shop.address}</p>` : ''}
        </div>
      `;

      infoWindow.setContent(content);
      infoWindow.open(map, marker);
    });

    markers.push(marker);
  }

  // Re-render markers when events or shops change
  $: if (mapsLoaded && map) {
    updateMarkers();
  }

  // Listen for custom events from info windows
  if (browser) {
    window.addEventListener('selectEvent', ((e: CustomEvent) => {
      const event = events.find((ev) => ev.id === e.detail);
      if (event) {
        dispatch('selectEvent', event);
      }
    }) as EventListener);
  }
</script>

<div class="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
  <div class="flex h-[600px]">
    <!-- Sidebar -->
    <div class="w-72 border-r border-warm-200 overflow-y-auto hidden md:block">
      <div class="p-4 border-b border-warm-200">
        <h3 class="font-display font-semibold text-stone-900 mb-4">Map Options</h3>

        <label class="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" bind:checked={showEvents} class="rounded text-amber-600 focus:ring-amber-500" />
          <span class="text-sm text-stone-700">Show Events</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" bind:checked={showShops} class="rounded text-emerald-600 focus:ring-emerald-500" />
          <span class="text-sm text-stone-700">Show Local Shops</span>
        </label>
      </div>

      <div class="p-4">
        <h4 class="font-medium text-stone-900 mb-3 text-sm">Events in View</h4>
        <div class="space-y-1.5 max-h-[400px] overflow-y-auto">
          {#each events.filter((e) => e.latitude && e.longitude) as event}
            {@const color = getMarkerColor(event)}
            <button
              on:click={() => dispatch('selectEvent', event)}
              class="w-full text-left p-2.5 rounded-lg border border-warm-200 hover:bg-warm-50 transition-all hover:shadow-sm"
              style="border-left: 3px solid {color};"
            >
              <div class="font-medium text-sm text-stone-900 truncate">{event.title}</div>
              {#if event.location}
                <div class="text-xs text-stone-500 truncate mt-0.5">{event.location}</div>
              {/if}
            </button>
          {:else}
            <p class="text-sm text-stone-400">No events with locations</p>
          {/each}
        </div>
      </div>
    </div>

    <!-- Map -->
    <div class="flex-1 relative">
      {#if !mapsLoaded}
        <div class="absolute inset-0 flex items-center justify-center bg-warm-50">
          <div class="text-center">
            <div class="relative">
              <div class="w-12 h-12 rounded-full border-4 border-warm-200"></div>
              <div class="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin absolute inset-0"></div>
            </div>
            <p class="text-stone-500 text-sm mt-3">Loading map...</p>
          </div>
        </div>
      {/if}
      <div bind:this={mapContainer} class="w-full h-full"></div>
    </div>
  </div>
</div>
