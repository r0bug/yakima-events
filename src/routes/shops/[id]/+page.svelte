<script lang="ts">
  import type { PageData } from './$types';
  import MapView from '$lib/components/MapView.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';

  export let data: PageData;

  $: shop = data.shop;
  $: seo = data.seo;

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function isOpenNow(): boolean {
    if (!shop?.operatingHours) return false;

    const now = new Date();
    const today = dayNames[now.getDay()];
    const hours = (shop.operatingHours as Record<string, any>)[today];

    if (!hours || hours.closed) return false;

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;

    return currentTime >= openTime && currentTime <= closeTime;
  }

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  function getDirectionsUrl(): string {
    if (!shop) return '#';
    if (shop.latitude && shop.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.address || '')}`;
  }
</script>

<svelte:head>
  <title>{seo.title} - Yakima Events</title>
  <meta name="description" content={seo.description} />
  <link rel="canonical" href={seo.url} />

  <!-- Open Graph -->
  <meta property="og:type" content="place" />
  <meta property="og:title" content={seo.title} />
  <meta property="og:description" content={seo.description} />
  <meta property="og:url" content={seo.url} />
  <meta property="og:image" content={seo.image} />
  <meta property="og:site_name" content="Yakima Events" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={seo.title} />
  <meta name="twitter:description" content={seo.description} />
  <meta name="twitter:image" content={seo.image} />

  <!-- JSON-LD Structured Data -->
  {@html `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: shop.name,
    description: shop.description || seo.description,
    url: seo.url,
    image: seo.image,
    address: {
      '@type': 'PostalAddress',
      streetAddress: shop.address || ''
    },
    ...(shop.phone ? { telephone: shop.phone } : {}),
    ...(shop.email ? { email: shop.email } : {}),
    ...(shop.website ? { sameAs: shop.website } : {}),
    ...(shop.latitude && shop.longitude ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: shop.latitude,
        longitude: shop.longitude
      }
    } : {})
  })}</script>`}
</svelte:head>

<main class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="mb-6 text-sm">
    <a href="/shops" class="text-purple-600 hover:underline">Shops</a>
    <span class="mx-2 text-gray-400">/</span>
    <span class="text-gray-600">{shop.name}</span>
  </nav>

  <!-- Venue Placeholder Claim Banner -->
  {#if shop.isVenuePlaceholder}
    <div class="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div class="flex-shrink-0 bg-amber-100 rounded-full p-3">
        <svg class="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="font-semibold text-amber-900">Is this your venue?</h3>
        <p class="text-sm text-amber-700 mt-1">
          This venue was automatically detected from event listings. Claim it to add your business details, hours, photos, and appear in the shop directory.
        </p>
      </div>
      <a
        href="/shops/{shop.id}/claim"
        class="flex-shrink-0 bg-amber-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm"
      >
        Claim This Venue
      </a>
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Main Content -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Header Image -->
      {#if shop.primaryImageUrl || shop.imageUrl}
        <img src="/uploads/{shop.primaryImageUrl || shop.imageUrl}" alt={shop.name} class="w-full h-64 md:h-96 object-cover rounded-lg" />
      {/if}

      <!-- Title & Badges -->
      <div class="flex flex-wrap items-start gap-4">
        <div class="flex-1">
          <h1 class="text-3xl font-bold text-gray-900">{shop.name}</h1>
          {#if shop.categoryName}
            <span
              class="inline-block mt-2 px-3 py-1 text-sm rounded-full text-white"
              style="background-color: {shop.categoryIcon || '#6b7280'}"
            >
              {shop.categoryName}
            </span>
          {/if}
        </div>
        <div class="flex gap-2 items-center">
          <ShareButton itemType="shop" itemId={shop.id} />
          {#if shop.featured}
            <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              Featured
            </span>
          {/if}
          {#if shop.verified}
            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              Verified
            </span>
          {/if}
        </div>
      </div>

      <!-- Description -->
      {#if shop.description}
        <div class="prose max-w-none">
          <p class="text-gray-700 whitespace-pre-wrap">{shop.description}</p>
        </div>
      {/if}

      <!-- Amenities -->
      {#if shop.amenities && Array.isArray(shop.amenities) && shop.amenities.length > 0}
        <div class="bg-white rounded-lg border p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Amenities</h2>
          <div class="flex flex-wrap gap-2">
            {#each shop.amenities as amenity}
              <span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                {amenity}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Payment Methods -->
      {#if shop.paymentMethods && Array.isArray(shop.paymentMethods) && shop.paymentMethods.length > 0}
        <div class="bg-white rounded-lg border p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>
          <div class="flex flex-wrap gap-2">
            {#each shop.paymentMethods as method}
              <span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                {method}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Map -->
      {#if shop.latitude && shop.longitude}
        <div class="bg-white rounded-lg border overflow-hidden">
          <h2 class="text-lg font-semibold text-gray-900 p-4 border-b">Location</h2>
          <div class="h-64">
            <MapView shops={[shop]} center={{ lat: Number(shop.latitude), lng: Number(shop.longitude) }} zoom={15} />
          </div>
        </div>
      {/if}
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Status Card -->
      <div class="bg-white rounded-lg border p-6">
        <div class="text-center mb-4">
          <span class="text-2xl font-bold {isOpenNow() ? 'text-green-600' : 'text-red-600'}">
            {isOpenNow() ? 'Open Now' : 'Closed'}
          </span>
        </div>

        <!-- Contact Info -->
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <svg class="h-5 w-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p class="text-gray-900">{shop.address}</p>
              <a href={getDirectionsUrl()} target="_blank" rel="noopener" class="text-purple-600 hover:underline text-sm">
                Get Directions
              </a>
            </div>
          </div>

          {#if shop.phone}
            <div class="flex items-center gap-3">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href="tel:{shop.phone}" class="text-purple-600 hover:underline">{shop.phone}</a>
            </div>
          {/if}

          {#if shop.email}
            <div class="flex items-center gap-3">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <a href="mailto:{shop.email}" class="text-purple-600 hover:underline">{shop.email}</a>
            </div>
          {/if}

          {#if shop.website}
            <div class="flex items-center gap-3">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <a href={shop.website} target="_blank" rel="noopener" class="text-purple-600 hover:underline truncate">
                {shop.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          {/if}
        </div>
      </div>

      <!-- Hours Card -->
      {#if shop.operatingHours}
        <div class="bg-white rounded-lg border p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Hours</h2>
          <div class="space-y-2">
            {#each dayNames as day, i}
              {@const hours = (shop.operatingHours as Record<string, any>)[day]}
              {@const isToday = new Date().getDay() === i}
              <div class="flex justify-between {isToday ? 'font-semibold text-purple-600' : 'text-gray-600'}">
                <span>{dayLabels[i]}</span>
                <span>
                  {#if hours && !hours.closed}
                    {formatTime(hours.open)} - {formatTime(hours.close)}
                  {:else}
                    Closed
                  {/if}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Actions -->
      <div class="space-y-3">
        <a
          href={getDirectionsUrl()}
          target="_blank"
          rel="noopener"
          class="block w-full bg-purple-600 text-white text-center py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
        >
          Get Directions
        </a>
        {#if shop.phone}
          <a
            href="tel:{shop.phone}"
            class="block w-full bg-white text-purple-600 text-center py-3 rounded-lg font-medium border-2 border-purple-600 hover:bg-purple-50 transition-colors"
          >
            Call Shop
          </a>
        {/if}
      </div>
    </div>
  </div>
</main>
