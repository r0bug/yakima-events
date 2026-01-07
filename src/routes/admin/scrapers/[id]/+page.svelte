<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  interface Source {
    id: number;
    name: string;
    url: string;
    scrapeType: string;
    scrapeConfig: Record<string, unknown> | null;
    intelligentMethodId: number | null;
    active: boolean;
    lastScraped: string | null;
    createdAt: string;
  }

  let source: Source | null = null;
  let loading = true;
  let saving = false;
  let deleting = false;
  let scraping = false;

  // Form fields
  let name = '';
  let url = '';
  let scrapeType = 'ical';
  let active = true;
  let scrapeConfigJson = '';

  const scrapeTypes = [
    { value: 'ical', label: 'iCal Calendar' },
    { value: 'html', label: 'HTML Parser' },
    { value: 'json', label: 'JSON Feed' },
    { value: 'rss', label: 'RSS Feed' },
    { value: 'yakima_valley', label: 'Yakima Valley Tourism' },
    { value: 'intelligent', label: 'AI/Intelligent' },
    { value: 'firecrawl', label: 'Firecrawl API' },
  ];

  $: sourceId = parseInt($page.params.id);

  onMount(async () => {
    await loadSource();
  });

  async function loadSource() {
    loading = true;
    try {
      const response = await fetch(`/api/scraper/sources?id=${sourceId}`);
      const data = await response.json();

      if (data.source) {
        source = data.source;
        name = source.name;
        url = source.url;
        scrapeType = source.scrapeType;
        active = source.active;
        scrapeConfigJson = source.scrapeConfig
          ? JSON.stringify(source.scrapeConfig, null, 2)
          : '';
      } else {
        alert('Source not found');
        goto('/admin/scrapers');
      }
    } catch (error) {
      console.error('Error loading source:', error);
      alert('Failed to load source');
    }
    loading = false;
  }

  async function saveSource() {
    if (!name.trim() || !url.trim()) {
      alert('Name and URL are required');
      return;
    }

    let scrapeConfig = null;
    if (scrapeConfigJson.trim()) {
      try {
        scrapeConfig = JSON.parse(scrapeConfigJson);
      } catch {
        alert('Invalid JSON in scrape config');
        return;
      }
    }

    saving = true;
    try {
      const response = await fetch('/api/scraper/sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sourceId,
          name: name.trim(),
          url: url.trim(),
          scrapeType,
          scrapeConfig,
          active,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert('Source updated successfully');
        await loadSource();
      } else {
        alert('Update failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }
    saving = false;
  }

  async function deleteSource() {
    if (!confirm('Are you sure you want to delete this source? This cannot be undone.')) {
      return;
    }

    deleting = true;
    try {
      const response = await fetch(`/api/scraper/sources?id=${sourceId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        alert('Source deleted');
        goto('/admin/scrapers');
      } else {
        alert('Delete failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }
    deleting = false;
  }

  async function testScrape() {
    scraping = true;
    try {
      const response = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrape-source', sourceId }),
      });

      const result = await response.json();
      if (result.success) {
        alert(
          `Scrape successful!\nEvents found: ${result.result.eventsFound}\nEvents added: ${result.result.eventsAdded}`
        );
        await loadSource();
      } else {
        alert('Scrape failed: ' + (result.result?.error || result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }
    scraping = false;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }
</script>

<svelte:head>
  <title>Edit Source | Yakima Events</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Edit Source</h1>
    <a
      href="/admin/scrapers"
      class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
    >
      ← Back to Dashboard
    </a>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading...</p>
    </div>
  {:else if source}
    <div class="bg-white rounded-lg shadow">
      <!-- Source Info Header -->
      <div class="px-6 py-4 border-b bg-gray-50">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">{source.name}</h2>
            <p class="text-sm text-gray-600">ID: {source.id}</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-600">Last scraped: {formatDate(source.lastScraped)}</p>
            <p class="text-sm text-gray-600">Created: {formatDate(source.createdAt)}</p>
          </div>
        </div>
      </div>

      <!-- Form -->
      <div class="p-6 space-y-6">
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
              Source Name *
            </label>
            <input
              id="name"
              type="text"
              bind:value={name}
              class="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="My Event Calendar"
            />
          </div>

          <div>
            <label for="type" class="block text-sm font-medium text-gray-700 mb-1">
              Scrape Type *
            </label>
            <select
              id="type"
              bind:value={scrapeType}
              class="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              {#each scrapeTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label for="url" class="block text-sm font-medium text-gray-700 mb-1">
            Source URL *
          </label>
          <input
            id="url"
            type="url"
            bind:value={url}
            class="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://example.com/events.ics"
          />
        </div>

        <div>
          <label for="config" class="block text-sm font-medium text-gray-700 mb-1">
            Scrape Config (JSON)
          </label>
          <textarea
            id="config"
            bind:value={scrapeConfigJson}
            rows={6}
            class="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Optional JSON configuration..."
          ></textarea>
          <p class="mt-1 text-sm text-gray-500">
            Optional configuration for the scraper. Format depends on scrape type.
          </p>
        </div>

        <div class="flex items-center">
          <input
            id="active"
            type="checkbox"
            bind:checked={active}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="active" class="ml-2 block text-sm text-gray-900">
            Active (include in scheduled scrapes)
          </label>
        </div>

        {#if source.intelligentMethodId}
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 class="font-medium text-purple-800">AI Method Linked</h3>
            <p class="text-sm text-purple-700">
              This source uses intelligent scraping method #{source.intelligentMethodId}
            </p>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="px-6 py-4 border-t bg-gray-50 flex justify-between">
        <div class="flex gap-3">
          <button
            on:click={saveSource}
            disabled={saving}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            on:click={testScrape}
            disabled={scraping}
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {scraping ? 'Scraping...' : 'Test Scrape'}
          </button>
        </div>
        <button
          on:click={deleteSource}
          disabled={deleting}
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Source'}
        </button>
      </div>
    </div>
  {/if}
</div>
