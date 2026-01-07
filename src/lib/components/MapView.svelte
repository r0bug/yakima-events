<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { PUBLIC_DEFAULT_LAT, PUBLIC_DEFAULT_LNG, PUBLIC_DEFAULT_ZOOM } from '$env/static/public';

  interface Event {
    id: number;
    title: string;
    start_datetime: string;
    location?: string;
    latitude?: number;
    longitude?: number;
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

    const marker = new google.maps.Marker({
      position: { lat: Number(event.latitude), lng: Number(event.longitude) },
      map,
      title: event.title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    marker.addListener('click', () => {
      if (!infoWindow) return;

      const content = `
        <div class="p-2 max-w-xs">
          <h4 class="font-semibold text-gray-900">${event.title}</h4>
          <p class="text-sm text-gray-600 mt-1">${event.location || ''}</p>
          <button
            onclick="window.dispatchEvent(new CustomEvent('selectEvent', { detail: ${event.id} }))"
            class="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
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
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    marker.addListener('click', () => {
      if (!infoWindow) return;

      const content = `
        <div class="p-2 max-w-xs">
          <h4 class="font-semibold text-gray-900">${shop.name}</h4>
          ${shop.category_name ? `<p class="text-sm text-gray-500">${shop.category_name}</p>` : ''}
          ${shop.address ? `<p class="text-sm text-gray-600 mt-1">${shop.address}</p>` : ''}
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

<div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
  <div class="flex h-[600px]">
    <!-- Sidebar -->
    <div class="w-72 border-r border-gray-200 overflow-y-auto">
      <div class="p-4 border-b border-gray-200">
        <h3 class="font-semibold text-gray-900 mb-4">Map Options</h3>

        <label class="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" bind:checked={showEvents} class="rounded text-blue-600" />
          <span class="text-sm text-gray-700">Show Events</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" bind:checked={showShops} class="rounded text-green-600" />
          <span class="text-sm text-gray-700">Show Local Shops</span>
        </label>
      </div>

      <div class="p-4">
        <h4 class="font-medium text-gray-900 mb-3">Events in View</h4>
        <div class="space-y-2 max-h-[400px] overflow-y-auto">
          {#each events.filter((e) => e.latitude && e.longitude) as event}
            <button
              on:click={() => dispatch('selectEvent', event)}
              class="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div class="font-medium text-sm text-gray-900 truncate">{event.title}</div>
              {#if event.location}
                <div class="text-xs text-gray-500 truncate mt-1">{event.location}</div>
              {/if}
            </button>
          {:else}
            <p class="text-sm text-gray-500">No events with locations</p>
          {/each}
        </div>
      </div>
    </div>

    <!-- Map -->
    <div class="flex-1 relative">
      {#if !mapsLoaded}
        <div class="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p class="text-gray-600">Loading map...</p>
          </div>
        </div>
      {/if}
      <div bind:this={mapContainer} class="w-full h-full"></div>
    </div>
  </div>
</div>
