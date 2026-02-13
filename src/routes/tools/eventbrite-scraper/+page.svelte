<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  let inputUrl = '';
  let maxPages = 3;
  let loading = false;
  let result: {
    success: boolean;
    isSearchUrl: boolean;
    eventsFound: number;
    events: Array<{
      title: string;
      description?: string;
      startDatetime: string;
      endDatetime?: string;
      location?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      externalUrl?: string;
      externalEventId?: string;
    }>;
    rawResponse?: Record<string, unknown>;
    error?: string;
  } | null = null;

  async function testScraper() {
    if (!inputUrl.trim()) return;

    loading = true;
    result = null;

    try {
      const response = await fetch('/api/scraper/eventbrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputUrl: inputUrl.trim(), maxPages }),
      });

      result = await response.json();
    } catch (e) {
      result = {
        success: false,
        isSearchUrl: false,
        eventsFound: 0,
        events: [],
        error: e instanceof Error ? e.message : 'Request failed',
      };
    } finally {
      loading = false;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // Example URLs for testing
  const exampleUrls = [
    { name: 'Yakima Events (Today)', url: 'https://www.eventbrite.com/d/wa--yakima/events--today/' },
    { name: 'Yakima Events (This Week)', url: 'https://www.eventbrite.com/d/wa--yakima/events--this-week/' },
    { name: 'Seattle Events', url: 'https://www.eventbrite.com/d/wa--seattle/events--this-weekend/' },
  ];
</script>

<svelte:head>
  <title>Eventbrite Scraper - Tools</title>
</svelte:head>

<div class="max-w-4xl mx-auto p-6">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Eventbrite Scraper</h1>
    <a href="/admin/scrapers" class="text-orange-600 hover:text-orange-800">
      &larr; Back to Scrapers
    </a>
  </div>

  <!-- Status Card -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <h2 class="text-lg font-semibold mb-4">Service Status</h2>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <span class="text-gray-500 text-sm">Status:</span>
        <span class="ml-2 {data.status.available ? 'text-green-600' : 'text-red-600'} font-medium">
          {data.status.available ? 'Available' : 'Not Configured'}
        </span>
      </div>
      <div>
        <span class="text-gray-500 text-sm">API Host:</span>
        <span class="ml-2 text-gray-900">{data.status.apiHost}</span>
      </div>
      <div>
        <span class="text-gray-500 text-sm">API Key:</span>
        <span class="ml-2 {data.status.hasApiKey ? 'text-green-600' : 'text-red-600'}">
          {data.status.hasApiKey ? 'Configured' : 'Missing'}
        </span>
      </div>
    </div>

    {#if !data.status.available}
      <div class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p class="text-yellow-800 text-sm">
          <strong>Setup Required:</strong> Add your RapidAPI key to the environment variables:
        </p>
        <pre class="mt-2 bg-yellow-100 p-2 rounded text-xs overflow-x-auto">RAPIDAPI_KEY=your_api_key_here</pre>
        <p class="mt-2 text-yellow-700 text-xs">
          Get your API key from: <a href="https://rapidapi.com/luminati/api/eventbrite-scraper" target="_blank" class="underline">RapidAPI - Eventbrite Scraper</a>
        </p>
      </div>
    {/if}
  </div>

  <!-- Test Scraper -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <h2 class="text-lg font-semibold mb-4">Test Eventbrite Scraper</h2>

    <form on:submit|preventDefault={testScraper} class="space-y-4">
      <div>
        <label for="inputUrl" class="block text-sm font-medium text-gray-700 mb-1">
          Eventbrite URL
        </label>
        <input
          type="text"
          id="inputUrl"
          bind:value={inputUrl}
          placeholder="https://www.eventbrite.com/e/event-name-tickets-1234567890 or search URL"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          disabled={!data.status.available || loading}
        />
        <p class="mt-1 text-xs text-gray-500">
          Enter an event URL or a search/listing URL to scrape multiple events
        </p>
      </div>

      <div>
        <label for="maxPages" class="block text-sm font-medium text-gray-700 mb-1">
          Max Pages (for search URLs)
        </label>
        <input
          type="number"
          id="maxPages"
          bind:value={maxPages}
          min="1"
          max="10"
          class="w-32 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          disabled={!data.status.available || loading}
        />
        <p class="mt-1 text-xs text-gray-500">
          Number of pages to scrape when using search URLs (default: 3)
        </p>
      </div>

      <div class="flex items-center gap-4">
        <button
          type="submit"
          disabled={!data.status.available || loading || !inputUrl.trim()}
          class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Scraping...' : 'Scrape Events'}
        </button>

        {#if loading}
          <span class="text-gray-500 text-sm animate-pulse">
            Fetching events from Eventbrite...
          </span>
        {/if}
      </div>
    </form>

    <!-- Example URLs -->
    <div class="mt-6 pt-4 border-t">
      <p class="text-sm text-gray-500 mb-2">Try these example URLs:</p>
      <div class="flex flex-wrap gap-2">
        {#each exampleUrls as example}
          <button
            on:click={() => inputUrl = example.url}
            class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
            disabled={!data.status.available}
          >
            {example.name}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Results -->
  {#if result}
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">
        Results
        <span class="text-sm font-normal ml-2 {result.success ? 'text-green-600' : 'text-red-600'}">
          ({result.success ? 'Success' : 'Failed'})
        </span>
      </h2>

      {#if result.error}
        <div class="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p class="text-red-700">{result.error}</p>
        </div>
      {/if}

      <div class="mb-4 grid grid-cols-2 gap-4">
        <div>
          <span class="text-gray-500 text-sm">URL Type:</span>
          <span class="ml-2 font-medium">{result.isSearchUrl ? 'Search/Listing' : 'Single Event'}</span>
        </div>
        <div>
          <span class="text-gray-500 text-sm">Events Found:</span>
          <span class="ml-2 font-semibold text-lg">{result.eventsFound}</span>
        </div>
      </div>

      {#if result.events.length > 0}
        <div class="border rounded-lg overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Event</th>
                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Date</th>
                <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">Location</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              {#each result.events as event}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">{event.title}</div>
                    {#if event.description}
                      <div class="text-sm text-gray-500 truncate max-w-md">
                        {event.description.slice(0, 100)}{event.description.length > 100 ? '...' : ''}
                      </div>
                    {/if}
                    {#if event.externalUrl}
                      <a
                        href={event.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-orange-600 hover:underline"
                      >
                        View on Eventbrite &rarr;
                      </a>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">
                    <div>{formatDate(event.startDatetime)}</div>
                    {#if event.endDatetime}
                      <div class="text-xs text-gray-400">
                        to {formatDate(event.endDatetime)}
                      </div>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">
                    {#if event.location}
                      <div>{event.location}</div>
                    {/if}
                    {#if event.address}
                      <div class="text-xs text-gray-400">{event.address}</div>
                    {/if}
                    {#if !event.location && !event.address}
                      <span class="text-gray-400">Online Event</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Raw Response (collapsible) -->
        {#if result.rawResponse}
          <details class="mt-4">
            <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              View raw API response
            </summary>
            <pre class="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-x-auto max-h-96">{JSON.stringify(result.rawResponse, null, 2)}</pre>
          </details>
        {/if}
      {:else if result.success}
        <p class="text-gray-500">No events found.</p>
      {/if}
    </div>
  {/if}

  <!-- Documentation -->
  <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">How to Use</h3>
    <ol class="list-decimal list-inside space-y-2 text-blue-800 text-sm">
      <li>Sign up for a free RapidAPI account at <a href="https://rapidapi.com" target="_blank" class="underline">rapidapi.com</a></li>
      <li>Subscribe to the <a href="https://rapidapi.com/luminati/api/eventbrite-scraper" target="_blank" class="underline">Eventbrite Scraper API</a></li>
      <li>Copy your API key and add it to your <code class="bg-blue-100 px-1 rounded">.env</code> file as <code class="bg-blue-100 px-1 rounded">RAPIDAPI_KEY</code></li>
      <li>Restart the application to load the new environment variable</li>
    </ol>

    <div class="mt-4 p-3 bg-blue-100 rounded-lg">
      <p class="text-blue-900 text-sm font-medium">URL Types Supported:</p>
      <ul class="text-blue-800 text-xs mt-1 list-disc list-inside">
        <li><strong>Single Event:</strong> <code>https://www.eventbrite.com/e/event-name-tickets-1234567890</code></li>
        <li><strong>Search Results:</strong> <code>https://www.eventbrite.com/d/wa--yakima/events--today/</code></li>
      </ul>
      <p class="text-blue-800 text-xs mt-2">
        Search URLs support pagination - set "Max Pages" to control how many result pages to scrape.
      </p>
    </div>
  </div>
</div>
