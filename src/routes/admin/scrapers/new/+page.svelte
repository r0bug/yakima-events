<script lang="ts">
  import { goto } from '$app/navigation';

  let name = '';
  let url = '';
  let scrapeType = 'ical';
  let active = true;
  let scrapeConfigJson = '';
  let saving = false;

  const scrapeTypes = [
    { value: 'ical', label: 'iCal Calendar', description: 'Standard calendar format (.ics files)' },
    { value: 'html', label: 'HTML Parser', description: 'Parse events from HTML pages with selectors' },
    { value: 'json', label: 'JSON Feed', description: 'JSON API or feed endpoints' },
    { value: 'rss', label: 'RSS Feed', description: 'RSS/Atom event feeds' },
    { value: 'yakima_valley', label: 'Yakima Valley Tourism', description: 'Custom parser for visityakima.com' },
    { value: 'intelligent', label: 'AI/Intelligent', description: 'LLM-powered extraction (requires API key)' },
    { value: 'firecrawl', label: 'Firecrawl API', description: 'Advanced web scraping API' },
  ];

  async function createSource() {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          scrapeType,
          scrapeConfig,
          active,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Source created with ID: ${result.sourceId}`);
        goto(`/admin/scrapers/${result.sourceId}`);
      } else {
        alert('Creation failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }
    saving = false;
  }

  function getConfigTemplate(type: string): string {
    switch (type) {
      case 'html':
        return JSON.stringify(
          {
            containerSelector: '.events-list .event-item',
            titleSelector: '.event-title',
            dateSelector: '.event-date',
            locationSelector: '.event-location',
            descriptionSelector: '.event-description',
            linkSelector: 'a[href]',
          },
          null,
          2
        );
      case 'json':
        return JSON.stringify(
          {
            eventsPath: 'data.events',
            titleField: 'name',
            startDateField: 'start_date',
            endDateField: 'end_date',
            locationField: 'venue.name',
            descriptionField: 'description',
          },
          null,
          2
        );
      case 'intelligent':
        return JSON.stringify(
          {
            maxEvents: 50,
            includeImages: true,
          },
          null,
          2
        );
      default:
        return '';
    }
  }

  function loadConfigTemplate() {
    const template = getConfigTemplate(scrapeType);
    if (template && !scrapeConfigJson.trim()) {
      scrapeConfigJson = template;
    }
  }

  $: if (scrapeType) {
    // Don't auto-load to avoid overwriting user input
  }
</script>

<svelte:head>
  <title>Add Source | Yakima Events</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Add New Source</h1>
    <a
      href="/admin/scrapers"
      class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
    >
      ← Back to Dashboard
    </a>
  </div>

  <div class="bg-white rounded-lg shadow">
    <div class="px-6 py-4 border-b">
      <h2 class="text-lg font-semibold">Source Details</h2>
      <p class="text-sm text-gray-600">Configure a new calendar source for event scraping</p>
    </div>

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
            placeholder="Downtown Yakima Events"
          />
          <p class="mt-1 text-sm text-gray-500">A friendly name to identify this source</p>
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
          <p class="mt-1 text-sm text-gray-500">
            {scrapeTypes.find((t) => t.value === scrapeType)?.description}
          </p>
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
          placeholder={scrapeType === 'ical'
            ? 'https://example.com/events.ics'
            : 'https://example.com/events'}
        />
        <p class="mt-1 text-sm text-gray-500">
          {#if scrapeType === 'ical'}
            Direct link to an iCal (.ics) file
          {:else if scrapeType === 'json'}
            API endpoint returning JSON
          {:else}
            URL of the page containing events
          {/if}
        </p>
      </div>

      <div>
        <div class="flex justify-between items-center mb-1">
          <label for="config" class="block text-sm font-medium text-gray-700">
            Scrape Config (JSON)
          </label>
          <button
            type="button"
            on:click={loadConfigTemplate}
            class="text-sm text-blue-600 hover:text-blue-800"
          >
            Load template
          </button>
        </div>
        <textarea
          id="config"
          bind:value={scrapeConfigJson}
          rows={8}
          class="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          placeholder="Optional configuration..."
        ></textarea>
        <p class="mt-1 text-sm text-gray-500">
          {#if scrapeType === 'html'}
            CSS selectors for extracting event data from HTML
          {:else if scrapeType === 'json'}
            Field mappings for JSON data structure
          {:else if scrapeType === 'intelligent'}
            Options for AI-powered extraction
          {:else}
            Optional configuration (usually not needed for {scrapeType})
          {/if}
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

      {#if scrapeType === 'intelligent'}
        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 class="font-medium text-purple-800">AI-Powered Scraping</h3>
          <p class="text-sm text-purple-700 mt-1">
            This type uses LLM analysis to intelligently extract events. It's best used via the
            <a href="/admin/scrapers/intelligent" class="underline">AI Scraper interface</a>
            which allows you to preview and approve extraction methods.
          </p>
        </div>
      {/if}

      {#if scrapeType === 'firecrawl'}
        <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 class="font-medium text-orange-800">Firecrawl API</h3>
          <p class="text-sm text-orange-700 mt-1">
            Firecrawl provides advanced web scraping capabilities for JavaScript-heavy sites.
            Requires FIRECRAWL_API_KEY in environment.
          </p>
        </div>
      {/if}
    </div>

    <div class="px-6 py-4 border-t bg-gray-50">
      <button
        on:click={createSource}
        disabled={saving || !name.trim() || !url.trim()}
        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        {saving ? 'Creating...' : 'Create Source'}
      </button>
    </div>
  </div>

  <!-- Help Section -->
  <div class="mt-8 bg-blue-50 rounded-lg p-6">
    <h3 class="text-lg font-semibold text-blue-900 mb-4">Scraper Types Guide</h3>
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <h4 class="font-medium text-blue-800">iCal Calendar</h4>
        <p class="text-sm text-blue-700">
          Standard calendar format. Just provide the .ics URL and events will be automatically
          parsed.
        </p>
      </div>
      <div>
        <h4 class="font-medium text-blue-800">HTML Parser</h4>
        <p class="text-sm text-blue-700">
          Uses CSS selectors to extract events from web pages. Requires configuration.
        </p>
      </div>
      <div>
        <h4 class="font-medium text-blue-800">JSON Feed</h4>
        <p class="text-sm text-blue-700">
          Parses JSON API responses. Configure field mappings to extract event data.
        </p>
      </div>
      <div>
        <h4 class="font-medium text-blue-800">AI/Intelligent</h4>
        <p class="text-sm text-blue-700">
          Uses LLM to understand and extract events from any page format. Most flexible but uses
          API credits.
        </p>
      </div>
    </div>
  </div>
</div>
