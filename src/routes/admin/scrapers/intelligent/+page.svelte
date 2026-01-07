<script lang="ts">
  import { onMount } from 'svelte';

  interface Session {
    id: number;
    url: string;
    domain: string;
    status: string;
    eventsFound: number;
    eventsSaved: number;
    error?: string;
    createdAt: string;
  }

  interface Method {
    id: number;
    name: string;
    domain: string;
    methodType: string;
    confidenceScore: number;
    usageCount: number;
    successRate: number;
    lastUsed: string | null;
  }

  interface Batch {
    id: number;
    filename: string | null;
    totalUrls: number;
    processedUrls: number;
    successCount: number;
    errorCount: number;
    totalEvents: number;
    status: string;
    createdAt: string;
  }

  interface Stats {
    sessions: {
      total: number;
      eventsFound: number;
      approved: number;
      errors: number;
    };
    methods: {
      total: number;
      avgSuccessRate: number;
    };
  }

  let urlInput = '';
  let batchUrls = '';
  let analyzing = false;
  let analysisResult: {
    success: boolean;
    sessionId?: number;
    events?: Array<{
      title: string;
      startDate: string;
      location?: string;
      description?: string;
    }>;
    analysis?: string;
    eventsSaved?: number;
    error?: string;
  } | null = null;

  let sessions: Session[] = [];
  let methods: Method[] = [];
  let batches: Batch[] = [];
  let stats: Stats | null = null;
  let loading = true;
  let activeTab: 'analyze' | 'sessions' | 'methods' | 'batches' = 'analyze';
  let available = false;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [availRes, statsRes, sessionsRes, methodsRes, batchesRes] = await Promise.all([
        fetch('/api/scraper/intelligent'),
        fetch('/api/scraper/intelligent?action=stats'),
        fetch('/api/scraper/intelligent?action=sessions&limit=20'),
        fetch('/api/scraper/intelligent?action=methods'),
        fetch('/api/scraper/intelligent?action=batches'),
      ]);

      const availData = await availRes.json();
      available = availData.available;

      stats = await statsRes.json();
      sessions = (await sessionsRes.json()).sessions || [];
      methods = (await methodsRes.json()).methods || [];
      batches = (await batchesRes.json()).batches || [];
    } catch (error) {
      console.error('Error loading data:', error);
    }
    loading = false;
  }

  async function analyzeUrl() {
    if (!urlInput.trim() || analyzing) return;

    analyzing = true;
    analysisResult = null;

    try {
      const response = await fetch('/api/scraper/intelligent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', url: urlInput.trim() }),
      });

      analysisResult = await response.json();

      if (analysisResult?.success) {
        await loadData();
      }
    } catch (error) {
      analysisResult = {
        success: false,
        error: (error as Error).message,
      };
    }

    analyzing = false;
  }

  async function approveSession(sessionId: number) {
    try {
      const response = await fetch('/api/scraper/intelligent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', sessionId }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Method saved! ID: ${result.methodId}, Source ID: ${result.sourceId}`);
        await loadData();
      } else {
        alert('Approval failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }
  }

  async function startBatch() {
    const urls = batchUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u && u.startsWith('http'));

    if (urls.length === 0) {
      alert('Please enter valid URLs (one per line)');
      return;
    }

    try {
      const response = await fetch('/api/scraper/intelligent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch', urls }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Batch started! ID: ${result.batchId}, Processing ${result.totalUrls} URLs`);
        batchUrls = '';
        await loadData();
        activeTab = 'batches';
      } else {
        alert('Batch failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'events_found':
      case 'completed':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
      case 'analyzing':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<svelte:head>
  <title>AI Scraper | Yakima Events</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-7xl">
  <div class="flex justify-between items-center mb-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">AI-Powered Scraper</h1>
      <p class="text-gray-600 mt-1">
        Intelligent event extraction using LLM analysis
      </p>
    </div>
    <a
      href="/admin/scrapers"
      class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
    >
      ← Back to Dashboard
    </a>
  </div>

  {#if !available}
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
      <h2 class="text-lg font-semibold text-yellow-800">AI Scraper Unavailable</h2>
      <p class="text-yellow-700 mt-2">
        The Segmind API key is not configured. Please add SEGMIND_API_KEY to your environment
        variables.
      </p>
    </div>
  {/if}

  {#if loading}
    <div class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading...</p>
    </div>
  {:else}
    <!-- Stats Cards -->
    {#if stats}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-purple-600">{stats.sessions.total}</div>
          <div class="text-sm text-gray-600">Total Sessions</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-green-600">{stats.sessions.eventsFound}</div>
          <div class="text-sm text-gray-600">Events Found</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-blue-600">{stats.methods.total}</div>
          <div class="text-sm text-gray-600">Saved Methods</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold text-gray-800">
            {stats.methods.avgSuccessRate.toFixed(0)}%
          </div>
          <div class="text-sm text-gray-600">Avg Success Rate</div>
        </div>
      </div>
    {/if}

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="-mb-px flex space-x-8">
        <button
          on:click={() => (activeTab = 'analyze')}
          class="py-4 px-1 border-b-2 font-medium text-sm"
          class:border-purple-500={activeTab === 'analyze'}
          class:text-purple-600={activeTab === 'analyze'}
          class:border-transparent={activeTab !== 'analyze'}
          class:text-gray-500={activeTab !== 'analyze'}
        >
          Analyze URL
        </button>
        <button
          on:click={() => (activeTab = 'sessions')}
          class="py-4 px-1 border-b-2 font-medium text-sm"
          class:border-purple-500={activeTab === 'sessions'}
          class:text-purple-600={activeTab === 'sessions'}
          class:border-transparent={activeTab !== 'sessions'}
          class:text-gray-500={activeTab !== 'sessions'}
        >
          Sessions ({sessions.length})
        </button>
        <button
          on:click={() => (activeTab = 'methods')}
          class="py-4 px-1 border-b-2 font-medium text-sm"
          class:border-purple-500={activeTab === 'methods'}
          class:text-purple-600={activeTab === 'methods'}
          class:border-transparent={activeTab !== 'methods'}
          class:text-gray-500={activeTab !== 'methods'}
        >
          Methods ({methods.length})
        </button>
        <button
          on:click={() => (activeTab = 'batches')}
          class="py-4 px-1 border-b-2 font-medium text-sm"
          class:border-purple-500={activeTab === 'batches'}
          class:text-purple-600={activeTab === 'batches'}
          class:border-transparent={activeTab !== 'batches'}
          class:text-gray-500={activeTab !== 'batches'}
        >
          Batches ({batches.length})
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'analyze'}
      <div class="grid md:grid-cols-2 gap-8">
        <!-- Single URL Analysis -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Analyze Single URL</h2>
          <div class="space-y-4">
            <div>
              <label for="url" class="block text-sm font-medium text-gray-700 mb-1">
                Event Page URL
              </label>
              <input
                id="url"
                type="url"
                bind:value={urlInput}
                placeholder="https://example.com/events"
                class="w-full px-3 py-2 border rounded-lg focus:ring-purple-500 focus:border-purple-500"
                disabled={!available || analyzing}
              />
            </div>
            <button
              on:click={analyzeUrl}
              disabled={!available || analyzing || !urlInput.trim()}
              class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {analyzing ? 'Analyzing...' : 'Analyze URL'}
            </button>
          </div>

          {#if analysisResult}
            <div class="mt-6 p-4 rounded-lg" class:bg-green-50={analysisResult.success} class:bg-red-50={!analysisResult.success}>
              {#if analysisResult.success}
                <h3 class="font-semibold text-green-800">
                  Found {analysisResult.events?.length || 0} events!
                </h3>
                {#if analysisResult.eventsSaved}
                  <p class="text-green-700">Saved {analysisResult.eventsSaved} new events</p>
                {/if}
                {#if analysisResult.events && analysisResult.events.length > 0}
                  <ul class="mt-2 space-y-2">
                    {#each analysisResult.events.slice(0, 5) as event}
                      <li class="text-sm text-green-700">
                        <strong>{event.title}</strong>
                        {#if event.startDate}
                          - {event.startDate}
                        {/if}
                      </li>
                    {/each}
                    {#if analysisResult.events.length > 5}
                      <li class="text-sm text-green-600">
                        ...and {analysisResult.events.length - 5} more
                      </li>
                    {/if}
                  </ul>
                {/if}
                {#if analysisResult.sessionId}
                  <button
                    on:click={() => approveSession(analysisResult!.sessionId!)}
                    class="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Approve & Save Method
                  </button>
                {/if}
              {:else}
                <h3 class="font-semibold text-red-800">Analysis Failed</h3>
                <p class="text-red-700">{analysisResult.error}</p>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Batch Processing -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Batch Processing</h2>
          <div class="space-y-4">
            <div>
              <label for="batch" class="block text-sm font-medium text-gray-700 mb-1">
                URLs (one per line)
              </label>
              <textarea
                id="batch"
                bind:value={batchUrls}
                rows={8}
                placeholder="https://example.com/events&#10;https://another.com/calendar&#10;..."
                class="w-full px-3 py-2 border rounded-lg focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                disabled={!available}
              ></textarea>
            </div>
            <button
              on:click={startBatch}
              disabled={!available || !batchUrls.trim()}
              class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              Start Batch Processing
            </button>
          </div>
        </div>
      </div>
    {:else if activeTab === 'sessions'}
      <div class="bg-white rounded-lg shadow">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">URL</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Events</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each sessions as session}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {session.domain}
                    </div>
                    <div class="text-xs text-gray-500 truncate max-w-xs">{session.url}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full {getStatusColor(session.status)}">
                      {session.status}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm">
                    <span class="text-gray-600">{session.eventsFound} found</span>
                    {#if session.eventsSaved > 0}
                      <span class="text-green-600 ml-2">+{session.eventsSaved}</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">
                    {formatDate(session.createdAt)}
                  </td>
                  <td class="px-4 py-3">
                    {#if session.status === 'events_found'}
                      <button
                        on:click={() => approveSession(session.id)}
                        class="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
                      >
                        Approve
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else if activeTab === 'methods'}
      <div class="bg-white rounded-lg shadow">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Domain</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Confidence</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Usage</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Success Rate</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each methods as method}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">{method.name}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{method.domain}</td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                      {method.methodType}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm">
                    <div class="flex items-center">
                      <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          class="bg-purple-600 h-2 rounded-full"
                          style="width: {method.confidenceScore * 100}%"
                        ></div>
                      </div>
                      <span class="text-gray-600">{(method.confidenceScore * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">{method.usageCount}</td>
                  <td class="px-4 py-3 text-sm">
                    <span
                      class:text-green-600={method.successRate >= 0.8}
                      class:text-yellow-600={method.successRate >= 0.5 && method.successRate < 0.8}
                      class:text-red-600={method.successRate < 0.5}
                    >
                      {(method.successRate * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else if activeTab === 'batches'}
      <div class="bg-white rounded-lg shadow">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">File</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Progress</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Events</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each batches as batch}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">#{batch.id}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">
                    {batch.filename || 'Manual input'}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center">
                      <div class="w-24 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          class="bg-purple-600 h-2 rounded-full"
                          style="width: {(batch.processedUrls / batch.totalUrls) * 100}%"
                        ></div>
                      </div>
                      <span class="text-sm text-gray-600">
                        {batch.processedUrls}/{batch.totalUrls}
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full {getStatusColor(batch.status)}">
                      {batch.status}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm">
                    <span class="text-green-600">{batch.successCount} ok</span>
                    {#if batch.errorCount > 0}
                      <span class="text-red-600 ml-2">{batch.errorCount} err</span>
                    {/if}
                    <span class="text-gray-600 ml-2">({batch.totalEvents} events)</span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">
                    {formatDate(batch.createdAt)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</div>
