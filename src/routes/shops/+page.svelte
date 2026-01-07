<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import MapView from '$lib/components/MapView.svelte';

  interface Shop {
    id: number;
    name: string;
    description: string | null;
    address: string;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    categoryId: number | null;
    operatingHours: any;
    primaryImage: string | null;
    featured: boolean;
    verified: boolean;
    status: string;
  }

  interface Category {
    id: number;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
  }

  let shops: Shop[] = [];
  let categories: Category[] = [];
  let loading = true;
  let error: string | null = null;

  // Filters
  let selectedCategory: number | null = null;
  let searchQuery = '';
  let showFeatured = false;
  let showVerified = false;
  let viewMode: 'grid' | 'list' | 'map' = 'grid';

  // Pagination
  let page = 1;
  let limit = 12;
  let total = 0;

  async function loadCategories() {
    try {
      const res = await fetch('/api/shops/categories');
      if (res.ok) {
        const data = await res.json();
        // Handle both array and object with categories property
        categories = data.categories || data;
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }

  async function loadShops() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', String(selectedCategory));
      if (searchQuery) params.set('search', searchQuery);
      if (showFeatured) params.set('featured', 'true');
      if (showVerified) params.set('verified', 'true');
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/shops?${params}`);
      if (!res.ok) throw new Error('Failed to load shops');

      const data = await res.json();
      shops = data.shops || data;
      total = data.total || shops.length;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load shops';
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    page = 1;
    loadShops();
  }

  function selectCategory(categoryId: number | null) {
    selectedCategory = categoryId;
    page = 1;
    loadShops();
  }

  function getCategoryColor(categoryId: number | null): string {
    if (!categoryId) return '#6b7280';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || '#6b7280';
  }

  function getCategoryName(categoryId: number | null): string {
    if (!categoryId) return 'Uncategorized';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'Uncategorized';
  }

  function isOpen(shop: Shop): boolean {
    if (!shop.operatingHours) return false;

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = dayNames[now.getDay()];
    const hours = shop.operatingHours[today];

    if (!hours || hours.closed) return false;

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;

    return currentTime >= openTime && currentTime <= closeTime;
  }

  onMount(() => {
    loadCategories();
    loadShops();
  });
</script>

<svelte:head>
  <title>Local Shops - Yakima</title>
</svelte:head>

<Header />

<main class="container mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Local Shops</h1>
    <p class="text-gray-600">Discover antique stores, thrift shops, and vintage boutiques in Yakima</p>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow-sm border p-4 mb-6">
    <div class="flex flex-wrap gap-4 items-center">
      <!-- Search -->
      <div class="flex-1 min-w-64">
        <div class="relative">
          <input
            type="text"
            placeholder="Search shops..."
            bind:value={searchQuery}
            on:keydown={(e) => e.key === 'Enter' && handleSearch()}
            class="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <svg class="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Category Filter -->
      <select
        bind:value={selectedCategory}
        on:change={() => selectCategory(selectedCategory)}
        class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
      >
        <option value={null}>All Categories</option>
        {#each categories as category}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>

      <!-- Toggle Filters -->
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={showFeatured}
          on:change={loadShops}
          class="rounded text-purple-600 focus:ring-purple-500"
        />
        <span class="text-sm text-gray-700">Featured</span>
      </label>

      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={showVerified}
          on:change={loadShops}
          class="rounded text-purple-600 focus:ring-purple-500"
        />
        <span class="text-sm text-gray-700">Verified</span>
      </label>

      <!-- View Mode -->
      <div class="flex border rounded-lg overflow-hidden">
        <button
          class="px-3 py-2 {viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
          on:click={() => viewMode = 'grid'}
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          class="px-3 py-2 {viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
          on:click={() => viewMode = 'list'}
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
        <button
          class="px-3 py-2 {viewMode === 'map' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
          on:click={() => viewMode = 'map'}
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Category Pills -->
  <div class="flex flex-wrap gap-2 mb-6">
    <button
      class="px-4 py-2 rounded-full text-sm font-medium transition-colors {selectedCategory === null ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
      on:click={() => selectCategory(null)}
    >
      All
    </button>
    {#each categories as category}
      <button
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        style={selectedCategory === category.id ? `background-color: ${category.color}; color: white;` : ''}
        class:bg-gray-100={selectedCategory !== category.id}
        class:text-gray-700={selectedCategory !== category.id}
        class:hover:bg-gray-200={selectedCategory !== category.id}
        on:click={() => selectCategory(category.id)}
      >
        {category.name}
      </button>
    {/each}
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {error}
    </div>
  {:else if viewMode === 'map'}
    <!-- Map View -->
    <div class="h-[600px] rounded-lg overflow-hidden border">
      <MapView shops={shops.filter(s => s.latitude && s.longitude)} />
    </div>
  {:else if shops.length === 0}
    <div class="text-center py-12 text-gray-500">
      <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <p class="text-lg">No shops found</p>
      <p class="text-sm">Try adjusting your filters</p>
    </div>
  {:else if viewMode === 'grid'}
    <!-- Grid View -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each shops as shop}
        <a href="/shops/{shop.id}" class="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
          {#if shop.primaryImage}
            <img src={shop.primaryImage} alt={shop.name} class="w-full h-48 object-cover" />
          {:else}
            <div class="w-full h-48 bg-gray-200 flex items-center justify-center">
              <svg class="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          {/if}
          <div class="p-4">
            <div class="flex items-start justify-between mb-2">
              <h3 class="font-semibold text-gray-900 line-clamp-1">{shop.name}</h3>
              <div class="flex gap-1 ml-2">
                {#if shop.featured}
                  <span class="text-yellow-500" title="Featured">★</span>
                {/if}
                {#if shop.verified}
                  <span class="text-blue-500" title="Verified">✓</span>
                {/if}
              </div>
            </div>
            <span
              class="inline-block px-2 py-1 text-xs rounded-full text-white mb-2"
              style="background-color: {getCategoryColor(shop.categoryId)}"
            >
              {getCategoryName(shop.categoryId)}
            </span>
            <p class="text-sm text-gray-600 line-clamp-2 mb-2">{shop.description || 'No description'}</p>
            <p class="text-sm text-gray-500 flex items-center gap-1">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span class="line-clamp-1">{shop.address}</span>
            </p>
            <div class="mt-2 text-sm {isOpen(shop) ? 'text-green-600' : 'text-red-600'}">
              {isOpen(shop) ? 'Open Now' : 'Closed'}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <!-- List View -->
    <div class="space-y-4">
      {#each shops as shop}
        <a href="/shops/{shop.id}" class="flex bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
          {#if shop.primaryImage}
            <img src={shop.primaryImage} alt={shop.name} class="w-48 h-36 object-cover flex-shrink-0" />
          {:else}
            <div class="w-48 h-36 bg-gray-200 flex items-center justify-center flex-shrink-0">
              <svg class="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          {/if}
          <div class="p-4 flex-1">
            <div class="flex items-start justify-between mb-2">
              <h3 class="font-semibold text-gray-900">{shop.name}</h3>
              <div class="flex gap-2">
                {#if shop.featured}
                  <span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Featured</span>
                {/if}
                {#if shop.verified}
                  <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Verified</span>
                {/if}
              </div>
            </div>
            <span
              class="inline-block px-2 py-1 text-xs rounded-full text-white mb-2"
              style="background-color: {getCategoryColor(shop.categoryId)}"
            >
              {getCategoryName(shop.categoryId)}
            </span>
            <p class="text-sm text-gray-600 line-clamp-2 mb-2">{shop.description || 'No description'}</p>
            <div class="flex items-center gap-4 text-sm text-gray-500">
              <span class="flex items-center gap-1">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {shop.address}
              </span>
              {#if shop.phone}
                <span class="flex items-center gap-1">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {shop.phone}
                </span>
              {/if}
              <span class="{isOpen(shop) ? 'text-green-600' : 'text-red-600'}">
                {isOpen(shop) ? 'Open Now' : 'Closed'}
              </span>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}

  <!-- Pagination -->
  {#if total > limit && viewMode !== 'map'}
    <div class="flex justify-center gap-2 mt-8">
      <button
        class="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        disabled={page === 1}
        on:click={() => { page--; loadShops(); }}
      >
        Previous
      </button>
      <span class="px-4 py-2 text-gray-600">
        Page {page} of {Math.ceil(total / limit)}
      </span>
      <button
        class="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        disabled={page >= Math.ceil(total / limit)}
        on:click={() => { page++; loadShops(); }}
      >
        Next
      </button>
    </div>
  {/if}
</main>
