<script lang="ts">
  import { onMount } from 'svelte';

  interface Source {
    id: number;
    name: string;
    url: string;
    scrapeType: string;
    active: boolean;
    lastScraped: string | null;
    intelligentMethodId?: number;
  }

  interface Stats {
    totalSources: number;
    activeSources: number;
    totalEvents: number;
    pendingEvents: number;
    approvedEvents: number;
  }

  interface Log {
    id: number;
    sourceId: number;
    sourceName?: string;
    status: string;
    eventsFound: number;
    eventsAdded: number;
    durationMs?: number;
    errorMessage?: string;
    startTime: string;
  }

  let sources: Source[] = [];
  let stats: Stats | null = null;
  let logs: Log[] = [];
  let loading = true;
  let scraping = false;
  let scrapingSourceId: number | null = null;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [sourcesRes, statsRes, logsRes] = await Promise.all([
        fetch('/api/scraper'),
        fetch('/api/scraper?action=stats'),
        fetch('/api/scraper?action=logs&limit=20'),
      ]);

      sources = (await sourcesRes.json()).sources || [];
      stats = await statsRes.json();
      logs = (await logsRes.json()).logs || [];
    } catch (error) {
      console.error('Error loading data:', error);
    }
    loading = false;
  }

  async function scrapeAll() {
    if (scraping) return;
    scraping = true;
    scrapingSourceId = null;

    try {
      const response = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrape-all' }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Scraping complete!\n${result.summary.successful} successful, ${result.summary.failed} failed\n${result.summary.eventsAdded} events added`);
        await loadData();
      } else {
        alert('Scraping failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }

    scraping = false;
  }

  async function scrapeSource(sourceId: number) {
    if (scraping) return;
    scraping = true;
    scrapingSourceId = sourceId;

    try {
      const response = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrape-source', sourceId }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Found ${result.result.eventsFound} events, added ${result.result.eventsAdded}`);
        await loadData();
      } else {
        alert('Scraping failed: ' + (result.result?.error || result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }

    scraping = false;
    scrapingSourceId = null;
  }

  async function toggleSource(sourceId: number) {
    try {
      const response = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-source', sourceId }),
      });

      const result = await response.json();
      if (result.success) {
        const source = sources.find((s) => s.id === sourceId);
        if (source) source.active = result.active;
        sources = [...sources];
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  function formatDuration(ms?: number): string {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
</script>

<svelte:head>
  <title>Scraper Admin | Yakima Events</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-7xl">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Scraper Dashboard</h1>
    <div class="flex gap-4">
      <a
        href="/tools/facebook-scraper"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Facebook Scraper
      </a>
      <a
        href="/tools/eventbrite-scraper"
        class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
      >
        Eventbrite Scraper
      </a>
      <a
        href="/admin/scrapers/intelligent"
        class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
      >
        AI Scraper
      </a>
      <button
        on:click={scrapeAll}
        disabled={scraping}
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {scraping && !scrapingSourceId ? 'Scraping...' : 'Scrape All Sources'}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading...</p>
    </div>
  {:else}
    <!-- Stats Cards -->
    {#if stats}
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-blue-600">{stats.totalSources}</div>
          <div class="text-sm text-gray-600">Total Sources</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-green-600">{stats.activeSources}</div>
          <div class="text-sm text-gray-600">Active Sources</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-gray-800">{stats.totalEvents}</div>
          <div class="text-sm text-gray-600">Total Events</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-yellow-600">{stats.pendingEvents}</div>
          <div class="text-sm text-gray-600">Pending</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-green-600">{stats.approvedEvents}</div>
          <div class="text-sm text-gray-600">Approved</div>
        </div>
      </div>
    {/if}

    <!-- Sources Table -->
    <div class="bg-white rounded-lg shadow mb-8">
      <div class="px-6 py-4 border-b flex justify-between items-center">
        <h2 class="text-xl font-semibold">Calendar Sources</h2>
        <a
          href="/admin/scrapers/new"
          class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          + Add Source
        </a>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Last Scraped</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each sources as source}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">
                  <a
                    href="/admin/scrapers/{source.id}"
                    class="text-blue-600 hover:underline font-medium"
                  >
                    {source.name}
                  </a>
                  <div class="text-xs text-gray-500 truncate max-w-xs">{source.url}</div>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="px-2 py-1 text-xs rounded-full"
                    class:bg-blue-100={source.scrapeType === 'ical'}
                    class:text-blue-800={source.scrapeType === 'ical'}
                    class:bg-green-100={source.scrapeType === 'html'}
                    class:text-green-800={source.scrapeType === 'html'}
                    class:bg-purple-100={source.scrapeType === 'intelligent'}
                    class:text-purple-800={source.scrapeType === 'intelligent'}
                    class:bg-orange-100={source.scrapeType === 'yakima_valley'}
                    class:text-orange-800={source.scrapeType === 'yakima_valley'}
                    class:bg-gray-100={!['ical', 'html', 'intelligent', 'yakima_valley'].includes(source.scrapeType)}
                    class:text-gray-800={!['ical', 'html', 'intelligent', 'yakima_valley'].includes(source.scrapeType)}
                  >
                    {source.scrapeType}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {formatDate(source.lastScraped)}
                </td>
                <td class="px-4 py-3">
                  <button
                    on:click={() => toggleSource(source.id)}
                    class="px-2 py-1 text-xs rounded-full"
                    class:bg-green-100={source.active}
                    class:text-green-800={source.active}
                    class:bg-red-100={!source.active}
                    class:text-red-800={!source.active}
                  >
                    {source.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td class="px-4 py-3">
                  <button
                    on:click={() => scrapeSource(source.id)}
                    disabled={scraping}
                    class="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    {scrapingSourceId === source.id ? 'Scraping...' : 'Scrape'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Logs -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b">
        <h2 class="text-xl font-semibold">Recent Scrape Logs</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Source</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Events</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Duration</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Time</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each logs as log}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm">
                  {log.sourceName || `Source #${log.sourceId}`}
                </td>
                <td class="px-4 py-3">
                  <span
                    class="px-2 py-1 text-xs rounded-full"
                    class:bg-green-100={log.status === 'success'}
                    class:text-green-800={log.status === 'success'}
                    class:bg-red-100={log.status === 'failed'}
                    class:text-red-800={log.status === 'failed'}
                    class:bg-yellow-100={log.status === 'running'}
                    class:text-yellow-800={log.status === 'running'}
                  >
                    {log.status}
                  </span>
                  {#if log.errorMessage}
                    <span class="ml-2 text-xs text-red-600" title={log.errorMessage}>
                      ⚠️
                    </span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-sm">
                  <span class="text-gray-600">{log.eventsFound} found</span>
                  <span class="text-green-600 ml-2">+{log.eventsAdded}</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {formatDuration(log.durationMs)}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {formatDate(log.startTime)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
