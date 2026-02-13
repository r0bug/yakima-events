<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  let eventUrl = '';
  let loading = false;
  let result: {
    success: boolean;
    eventId: string | null;
    event: {
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
    } | null;
    rawResponse?: Record<string, unknown>;
    error?: string;
  } | null = null;

  async function testScraper() {
    if (!eventUrl.trim()) return;

    loading = true;
    result = null;

    try {
      const response = await fetch('/api/scraper/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventUrl: eventUrl.trim() }),
      });

      result = await response.json();
    } catch (e) {
      result = {
        success: false,
        eventId: null,
        event: null,
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

  // Example Facebook events for testing
  const exampleEvents = [
    { name: 'Sample Event', id: '1073263437416098' },
  ];
</script>

<svelte:head>
  <title>Facebook Event Scraper - Tools</title>
</svelte:head>

<div class="max-w-4xl mx-auto p-6">
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
          Get your API key from: <a href="https://rapidapi.com/jerry1401/api/facebook-event-scraper" target="_blank" class="underline">RapidAPI - Facebook Event Scraper</a>
        </p>
      </div>
    {/if}
  </div>

  <!-- Test Scraper -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <h2 class="text-lg font-semibold mb-4">Test Facebook Event</h2>

    <form on:submit|preventDefault={testScraper} class="space-y-4">
      <div>
        <label for="eventUrl" class="block text-sm font-medium text-gray-700 mb-1">
          Facebook Event URL or ID
        </label>
        <input
          type="text"
          id="eventUrl"
          bind:value={eventUrl}
          placeholder="https://www.facebook.com/events/1234567890 or just 1234567890"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          disabled={!data.status.available || loading}
        />
        <p class="mt-1 text-xs text-gray-500">
          Enter a Facebook event URL or event ID to fetch event details
        </p>
      </div>

      <div class="flex items-center gap-4">
        <button
          type="submit"
          disabled={!data.status.available || loading || !eventUrl.trim()}
          class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Fetching...' : 'Fetch Event'}
        </button>

        {#if loading}
          <span class="text-gray-500 text-sm animate-pulse">
            Fetching event from Facebook...
          </span>
        {/if}
      </div>
    </form>

    <!-- Example Events -->
    <div class="mt-6 pt-4 border-t">
      <p class="text-sm text-gray-500 mb-2">Try an example event ID:</p>
      <div class="flex flex-wrap gap-2">
        {#each exampleEvents as event}
          <button
            on:click={() => eventUrl = event.id}
            class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
            disabled={!data.status.available}
          >
            {event.name} ({event.id})
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

      {#if result.eventId}
        <div class="mb-4">
          <span class="text-gray-500 text-sm">Event ID:</span>
          <code class="ml-2 bg-gray-100 px-2 py-1 rounded text-sm">{result.eventId}</code>
        </div>
      {/if}

      {#if result.event}
        <div class="border rounded-lg p-4 bg-gray-50">
          <h3 class="text-xl font-semibold text-gray-900 mb-2">{result.event.title}</h3>

          {#if result.event.description}
            <p class="text-gray-600 mb-4 whitespace-pre-wrap">{result.event.description.slice(0, 500)}{result.event.description.length > 500 ? '...' : ''}</p>
          {/if}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Start:</span>
              <span class="ml-2 text-gray-900">{formatDate(result.event.startDatetime)}</span>
            </div>

            {#if result.event.endDatetime}
              <div>
                <span class="text-gray-500">End:</span>
                <span class="ml-2 text-gray-900">{formatDate(result.event.endDatetime)}</span>
              </div>
            {/if}

            {#if result.event.location}
              <div>
                <span class="text-gray-500">Location:</span>
                <span class="ml-2 text-gray-900">{result.event.location}</span>
              </div>
            {/if}

            {#if result.event.address}
              <div>
                <span class="text-gray-500">Address:</span>
                <span class="ml-2 text-gray-900">{result.event.address}</span>
              </div>
            {/if}

            {#if result.event.latitude && result.event.longitude}
              <div>
                <span class="text-gray-500">Coordinates:</span>
                <span class="ml-2 text-gray-900">{result.event.latitude}, {result.event.longitude}</span>
              </div>
            {/if}
          </div>

          {#if result.event.externalUrl}
            <div class="mt-4">
              <a
                href={result.event.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-purple-600 hover:underline"
              >
                View on Facebook &rarr;
              </a>
            </div>
          {/if}
        </div>

        <!-- Raw Response (collapsible) -->
        {#if result.rawResponse}
          <details class="mt-4">
            <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              View raw API response
            </summary>
            <pre class="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-x-auto">{JSON.stringify(result.rawResponse, null, 2)}</pre>
          </details>
        {/if}
      {:else if result.success}
        <p class="text-gray-500">Event found but could not be parsed.</p>
      {/if}
    </div>
  {/if}

  <!-- Documentation -->
  <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">How to Use</h3>
    <ol class="list-decimal list-inside space-y-2 text-blue-800 text-sm">
      <li>Sign up for a free RapidAPI account at <a href="https://rapidapi.com" target="_blank" class="underline">rapidapi.com</a></li>
      <li>Subscribe to the <a href="https://rapidapi.com/jerry1401/api/facebook-event-scraper" target="_blank" class="underline">Facebook Event Scraper API</a> (has free tier)</li>
      <li>Copy your API key and add it to your <code class="bg-blue-100 px-1 rounded">.env</code> file as <code class="bg-blue-100 px-1 rounded">RAPIDAPI_KEY</code></li>
      <li>Restart the application to load the new environment variable</li>
      <li>Find a Facebook event URL (e.g., <code class="bg-blue-100 px-1 rounded">https://www.facebook.com/events/1234567890</code>)</li>
      <li>Paste the URL or just the event ID above and click "Fetch Event"</li>
    </ol>

    <div class="mt-4 p-3 bg-blue-100 rounded-lg">
      <p class="text-blue-900 text-sm font-medium">Note: This API fetches individual events by ID</p>
      <p class="text-blue-800 text-xs mt-1">
        Unlike page scrapers, this API requires specific event URLs/IDs. You'll need to find event URLs from Facebook pages manually or use a different service to discover events.
      </p>
    </div>
  </div>
</div>
