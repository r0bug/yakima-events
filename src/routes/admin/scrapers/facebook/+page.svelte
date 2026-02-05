<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  let pageUrl = '';
  let loading = false;
  let result: {
    success: boolean;
    pageId: string | null;
    eventsFound: number;
    events: Array<{
      title: string;
      description?: string;
      startDatetime: string;
      endDatetime?: string;
      location?: string;
      address?: string;
      externalUrl?: string;
    }>;
    error?: string;
  } | null = null;

  async function testScraper() {
    if (!pageUrl.trim()) return;

    loading = true;
    result = null;

    try {
      const response = await fetch('/api/scraper/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl: pageUrl.trim() }),
      });

      result = await response.json();
    } catch (e) {
      result = {
        success: false,
        pageId: null,
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

  // Example Yakima-area Facebook pages for testing
  const examplePages = [
    { name: 'City of Yakima', url: 'https://www.facebook.com/CityofYakima' },
    { name: 'Yakima Valley Museum', url: 'https://www.facebook.com/yakimavalleymuseum' },
    { name: 'Capitol Theatre', url: 'https://www.facebook.com/CapitolTheatreYakima' },
    { name: 'Yakima Speedway', url: 'https://www.facebook.com/yakimaspeedway' },
  ];
</script>

<svelte:head>
  <title>Facebook Scraper - Admin</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Facebook Event Scraper</h1>
    <a href="/admin/scrapers" class="text-purple-600 hover:text-purple-800">
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
          Get your API key from: <a href="https://rapidapi.com/krasnoludkolo/api/facebook-scraper3" target="_blank" class="underline">RapidAPI - Facebook Scraper3</a>
        </p>
      </div>
    {/if}
  </div>

  <!-- Test Scraper -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <h2 class="text-lg font-semibold mb-4">Test Facebook Page</h2>

    <form on:submit|preventDefault={testScraper} class="space-y-4">
      <div>
        <label for="pageUrl" class="block text-sm font-medium text-gray-700 mb-1">
          Facebook Page URL
        </label>
        <input
          type="url"
          id="pageUrl"
          bind:value={pageUrl}
          placeholder="https://www.facebook.com/PageName"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          disabled={!data.status.available || loading}
        />
        <p class="mt-1 text-xs text-gray-500">
          Enter a Facebook page URL to scrape its events
        </p>
      </div>

      <div class="flex items-center gap-4">
        <button
          type="submit"
          disabled={!data.status.available || loading || !pageUrl.trim()}
          class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Scraping...' : 'Test Scrape'}
        </button>

        {#if loading}
          <span class="text-gray-500 text-sm animate-pulse">
            Fetching events from Facebook...
          </span>
        {/if}
      </div>
    </form>

    <!-- Example Pages -->
    <div class="mt-6 pt-4 border-t">
      <p class="text-sm text-gray-500 mb-2">Try these example pages:</p>
      <div class="flex flex-wrap gap-2">
        {#each examplePages as page}
          <button
            on:click={() => pageUrl = page.url}
            class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
            disabled={!data.status.available}
          >
            {page.name}
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

      {#if result.pageId}
        <div class="mb-4">
          <span class="text-gray-500 text-sm">Page ID:</span>
          <code class="ml-2 bg-gray-100 px-2 py-1 rounded text-sm">{result.pageId}</code>
        </div>
      {/if}

      <div class="mb-4">
        <span class="text-gray-500 text-sm">Events Found:</span>
        <span class="ml-2 font-semibold text-lg">{result.eventsFound}</span>
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
                        class="text-xs text-purple-600 hover:underline"
                      >
                        View on Facebook &rarr;
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
                      <span class="text-gray-400">-</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Add as Source Button -->
        <div class="mt-4 pt-4 border-t">
          <p class="text-sm text-gray-500 mb-2">
            To add this page as a scraping source, go to the Sources page and create a new source with:
          </p>
          <ul class="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Type: <code class="bg-gray-100 px-1 rounded">facebook</code></li>
            <li>URL: <code class="bg-gray-100 px-1 rounded">{pageUrl}</code></li>
            <li>Config: <code class="bg-gray-100 px-1 rounded">{`{ "facebookPageId": "${result.pageId}" }`}</code></li>
          </ul>
        </div>
      {:else if result.success}
        <p class="text-gray-500">No events found on this page.</p>
      {/if}
    </div>
  {/if}

  <!-- Documentation -->
  <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">How to Use</h3>
    <ol class="list-decimal list-inside space-y-2 text-blue-800 text-sm">
      <li>Sign up for a free RapidAPI account at <a href="https://rapidapi.com" target="_blank" class="underline">rapidapi.com</a></li>
      <li>Subscribe to the <a href="https://rapidapi.com/krasnoludkolo/api/facebook-scraper3" target="_blank" class="underline">Facebook Scraper3 API</a> (has free tier)</li>
      <li>Copy your API key and add it to your <code class="bg-blue-100 px-1 rounded">.env</code> file as <code class="bg-blue-100 px-1 rounded">RAPIDAPI_KEY</code></li>
      <li>Restart the application to load the new environment variable</li>
      <li>Test scraping with a Facebook page URL above</li>
      <li>Once working, add Facebook pages as calendar sources with type "facebook"</li>
    </ol>
  </div>
</div>
