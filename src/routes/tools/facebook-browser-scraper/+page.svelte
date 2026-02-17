<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  // --- Bookmarklet source (readable version) ---
  // Uses DOM methods instead of innerHTML for security
  const bookmarkletCode = `javascript:void(function(){
    try{
      var events=new Map();
      var links=document.querySelectorAll('a[href*="/events/"]');
      links.forEach(function(a){
        var m=a.href.match(/\\/events\\/(\\d+)/);
        if(!m)return;
        var id=m[1];
        if(events.has(id))return;
        var title=a.getAttribute('aria-label')||a.textContent||'';
        title=title.trim().substring(0,200);
        var container=a;
        for(var i=0;i<10;i++){
          if(!container.parentElement)break;
          container=container.parentElement;
          if(container.getAttribute('role')==='article'||container.tagName==='ARTICLE')break;
        }
        var dateText='';
        var timeEl=container.querySelector('time');
        if(timeEl){
          dateText=timeEl.getAttribute('datetime')||timeEl.textContent||'';
        }
        if(!dateText){
          var texts=container.innerText||'';
          var dm=texts.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\w*,?\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*\\s+\\d{1,2}(?:\\s*,?\\s*\\d{4})?(?:\\s+at\\s+\\d{1,2}(?::\\d{2})?\\s*(?:AM|PM))?)/i);
          if(dm)dateText=dm[1];
        }
        var location='';
        var locEl=container.querySelector('[aria-label*="location"],[aria-label*="Location"]');
        if(locEl)location=locEl.textContent||'';
        var imageUrl='';
        var img=container.querySelector('img[src*="scontent"],img[src*="fbcdn"]');
        if(img)imageUrl=img.src;
        events.set(id,{eventId:id,url:'https://www.facebook.com/events/'+id+'/',title:title,dateText:dateText.trim(),location:location.trim(),imageUrl:imageUrl});
      });
      var arr=Array.from(events.values());
      var jsonStr=JSON.stringify(arr,null,2);
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(jsonStr).then(show,fallback);
      }else{fallback();}
      function fallback(){
        var ta=document.createElement('textarea');
        ta.value=jsonStr;
        ta.style.position='fixed';
        ta.style.left='-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        show();
      }
      function show(){
        var d=document.createElement('div');
        d.id='yf-fb-overlay';
        d.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
        var box=document.createElement('div');
        box.style.cssText='background:white;border-radius:12px;padding:32px;max-width:400px;text-align:center;';
        var icon=document.createElement('div');
        icon.style.cssText='font-size:48px;margin-bottom:12px;';
        icon.textContent='\\u2705';
        var h2=document.createElement('h2');
        h2.style.cssText='margin:0 0 8px;font-size:20px;';
        h2.textContent='Found '+arr.length+' Event'+(arr.length!==1?'s':'');
        var p=document.createElement('p');
        p.style.cssText='color:#666;margin:0 0 20px;font-size:14px;';
        p.textContent='JSON copied to clipboard. Paste it into the import tool.';
        var btns=document.createElement('div');
        btns.style.cssText='display:flex;gap:8px;justify-content:center;';
        var openBtn=document.createElement('a');
        openBtn.href='TOOL_URL';
        openBtn.target='_blank';
        openBtn.style.cssText='display:inline-block;padding:10px 20px;background:#7c3aed;color:white;border-radius:8px;text-decoration:none;font-size:14px;';
        openBtn.textContent='Open Import Tool';
        var closeBtn=document.createElement('button');
        closeBtn.style.cssText='padding:10px 20px;background:#e5e7eb;border:none;border-radius:8px;cursor:pointer;font-size:14px;';
        closeBtn.textContent='Close';
        closeBtn.onclick=function(){d.remove();};
        btns.appendChild(openBtn);
        btns.appendChild(closeBtn);
        box.appendChild(icon);
        box.appendChild(h2);
        box.appendChild(p);
        box.appendChild(btns);
        d.appendChild(box);
        document.body.appendChild(d);
        d.addEventListener('click',function(e){if(e.target===d)d.remove();});
      }
    }catch(e){alert('YF Scraper error: '+e.message);}
  })()`;

  // Build the actual minified bookmarklet href
  function getBookmarkletHref(): string {
    const minified = bookmarkletCode
      .replace(/\n\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace('TOOL_URL', window?.location?.origin + '/tools/facebook-browser-scraper');
    return minified;
  }

  // --- State ---
  let pasteText = '';
  let parsedEvents: Array<{
    eventId: string;
    url: string;
    title: string;
    dateText: string;
    location: string;
    imageUrl: string;
    selected: boolean;
    hasTitle: boolean;
    hasDate: boolean;
  }> = [];
  let parseError = '';
  let importing = false;
  let importResults: {
    summary: { total: number; added: number; duplicates: number; invalid: number };
    results: Array<{ eventId: string; title: string; status: string; error?: string }>;
  } | null = null;

  let bookmarkletHref = '';

  import { onMount } from 'svelte';
  onMount(() => {
    bookmarkletHref = getBookmarkletHref();
  });

  function parseJson() {
    parseError = '';
    parsedEvents = [];
    importResults = null;

    const trimmed = pasteText.trim();
    if (!trimmed) {
      parseError = 'Please paste the JSON data from the bookmarklet.';
      return;
    }

    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data) ? data : [data];

      if (arr.length === 0) {
        parseError = 'No events found in the pasted data.';
        return;
      }

      parsedEvents = arr.map((e: Record<string, string>) => ({
        eventId: e.eventId || '',
        url: e.url || '',
        title: e.title || '',
        dateText: e.dateText || '',
        location: e.location || '',
        imageUrl: e.imageUrl || '',
        selected: true,
        hasTitle: !!(e.title && e.title.trim()),
        hasDate: !!(e.dateText && e.dateText.trim()),
      }));
    } catch {
      parseError = 'Invalid JSON. Make sure you copied the full output from the bookmarklet.';
    }
  }

  function selectAll() {
    parsedEvents = parsedEvents.map((e) => ({ ...e, selected: true }));
  }

  function deselectAll() {
    parsedEvents = parsedEvents.map((e) => ({ ...e, selected: false }));
  }

  $: selectedCount = parsedEvents.filter((e) => e.selected).length;

  async function importSelected() {
    const selected = parsedEvents.filter((e) => e.selected);
    if (selected.length === 0) return;

    importing = true;
    importResults = null;

    try {
      const payload = {
        events: selected.map((e) => ({
          eventId: e.eventId,
          url: e.url,
          title: e.title || undefined,
          dateText: e.dateText || undefined,
          location: e.location || undefined,
          imageUrl: e.imageUrl || undefined,
        })),
      };

      const response = await fetch('/api/scraper/facebook-browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        importResults = result;
      } else {
        parseError = result.error || 'Import failed';
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Request failed';
    } finally {
      importing = false;
    }
  }
</script>

<svelte:head>
  <title>Facebook Browser Scraper - Tools</title>
</svelte:head>

<div class="max-w-5xl mx-auto p-6">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Facebook Browser Scraper</h1>
    <a href="/admin/scrapers" class="text-purple-600 hover:text-purple-800">
      &larr; Back to Scrapers
    </a>
  </div>

  <!-- Step 1: Install Bookmarklet -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <h2 class="text-lg font-semibold mb-2">Step 1: Install the Bookmarklet</h2>
    <p class="text-gray-600 text-sm mb-4">
      Drag the button below to your browser's bookmark bar. This lets you extract events from any Facebook page you're logged into.
    </p>

    <div class="flex items-center gap-4 mb-4">
      {#if bookmarkletHref}
        <a
          href={bookmarkletHref}
          class="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg font-medium shadow-md hover:bg-purple-700 cursor-grab active:cursor-grabbing select-none"
          on:click|preventDefault={() => {}}
          title="Drag this to your bookmark bar"
        >
          YF Event Scraper
        </a>
      {:else}
        <span class="inline-block px-6 py-3 bg-gray-400 text-white rounded-lg font-medium">
          Loading bookmarklet...
        </span>
      {/if}
      <span class="text-gray-500 text-sm">&larr; Drag this to your bookmark bar</span>
    </div>

    <details class="text-sm text-gray-600">
      <summary class="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
        How to use
      </summary>
      <ol class="list-decimal list-inside mt-2 space-y-1 pl-2">
        <li>Log into Facebook in your browser</li>
        <li>Navigate to a Facebook page's Events tab, a group's events, or any page listing events</li>
        <li>Click the <strong>"YF Event Scraper"</strong> bookmark in your bookmark bar</li>
        <li>An overlay will appear showing how many events were found and copying JSON to your clipboard</li>
        <li>Come back here and paste the JSON below</li>
      </ol>
    </details>
  </div>

  <!-- Step 2: Paste JSON -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <h2 class="text-lg font-semibold mb-2">Step 2: Paste Extracted Data</h2>
    <p class="text-gray-600 text-sm mb-4">
      After running the bookmarklet, paste the copied JSON here.
    </p>

    <textarea
      bind:value={pasteText}
      placeholder='[{{"eventId":"123456","url":"https://www.facebook.com/events/123456/","title":"Event Name","dateText":"Saturday, Feb 15 at 7 PM","location":"Venue Name"}}]'
      class="w-full h-40 px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
    ></textarea>

    {#if parseError}
      <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {parseError}
      </div>
    {/if}

    <button
      on:click={parseJson}
      disabled={!pasteText.trim()}
      class="mt-3 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Parse Events
    </button>
  </div>

  <!-- Step 3: Preview & Import -->
  {#if parsedEvents.length > 0}
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">
          Step 3: Review & Import
          <span class="text-sm font-normal text-gray-500 ml-2">
            {parsedEvents.length} event{parsedEvents.length !== 1 ? 's' : ''} found
          </span>
        </h2>
        <div class="flex gap-2">
          <button
            on:click={selectAll}
            class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Select All
          </button>
          <button
            on:click={deselectAll}
            class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-3 py-2 text-left w-8"></th>
              <th class="px-3 py-2 text-left">Title</th>
              <th class="px-3 py-2 text-left">Date</th>
              <th class="px-3 py-2 text-left">Location</th>
              <th class="px-3 py-2 text-left w-20">Data</th>
              <th class="px-3 py-2 text-left w-16">Link</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each parsedEvents as event, i}
              <tr class="hover:bg-gray-50" class:opacity-50={!event.selected}>
                <td class="px-3 py-2">
                  <input
                    type="checkbox"
                    bind:checked={parsedEvents[i].selected}
                    class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </td>
                <td class="px-3 py-2">
                  <span class="font-medium text-gray-900">
                    {event.title || '(No title)'}
                  </span>
                  <div class="text-xs text-gray-400 font-mono">ID: {event.eventId}</div>
                </td>
                <td class="px-3 py-2 text-gray-600">
                  {event.dateText || '(No date)'}
                </td>
                <td class="px-3 py-2 text-gray-600">
                  {event.location || '(No location)'}
                </td>
                <td class="px-3 py-2">
                  <div class="flex gap-1">
                    <span
                      class="w-2 h-2 rounded-full mt-1"
                      class:bg-green-500={event.hasTitle}
                      class:bg-red-400={!event.hasTitle}
                      title={event.hasTitle ? 'Has title' : 'Missing title'}
                    ></span>
                    <span
                      class="w-2 h-2 rounded-full mt-1"
                      class:bg-green-500={event.hasDate}
                      class:bg-yellow-400={!event.hasDate}
                      title={event.hasDate ? 'Has date' : 'Missing date'}
                    ></span>
                  </div>
                </td>
                <td class="px-3 py-2">
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-purple-600 hover:underline text-xs"
                  >
                    FB
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center gap-4">
        <button
          on:click={importSelected}
          disabled={selectedCount === 0 || importing}
          class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? 'Importing...' : `Import ${selectedCount} Event${selectedCount !== 1 ? 's' : ''}`}
        </button>

        {#if importing}
          <span class="text-gray-500 text-sm animate-pulse">Processing events...</span>
        {/if}

        {#if data.rapidApiAvailable}
          <span class="text-xs text-gray-400" title="RapidAPI is configured">
            RapidAPI available for enhanced fetching
          </span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Import Results -->
  {#if importResults}
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Import Results</h2>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="p-3 bg-gray-50 rounded-lg text-center">
          <div class="text-xl font-bold text-gray-800">{importResults.summary.total}</div>
          <div class="text-xs text-gray-500">Total</div>
        </div>
        <div class="p-3 bg-green-50 rounded-lg text-center">
          <div class="text-xl font-bold text-green-600">{importResults.summary.added}</div>
          <div class="text-xs text-green-700">Added</div>
        </div>
        <div class="p-3 bg-yellow-50 rounded-lg text-center">
          <div class="text-xl font-bold text-yellow-600">{importResults.summary.duplicates}</div>
          <div class="text-xs text-yellow-700">Duplicates</div>
        </div>
        <div class="p-3 bg-red-50 rounded-lg text-center">
          <div class="text-xl font-bold text-red-600">{importResults.summary.invalid}</div>
          <div class="text-xs text-red-700">Invalid</div>
        </div>
      </div>

      {#if importResults.summary.added > 0}
        <div class="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm mb-4">
          {importResults.summary.added} event{importResults.summary.added !== 1 ? 's' : ''} imported as <strong>pending</strong>. Review them in the
          <a href="/admin" class="underline font-medium">Admin Panel</a>.
        </div>
      {/if}

      <details>
        <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
          Per-event details
        </summary>
        <div class="mt-2 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left">Event</th>
                <th class="px-3 py-2 text-left">Status</th>
                <th class="px-3 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each importResults.results as r}
                <tr>
                  <td class="px-3 py-2 text-gray-900">{r.title}</td>
                  <td class="px-3 py-2">
                    <span
                      class="px-2 py-0.5 text-xs rounded-full"
                      class:bg-green-100={r.status === 'added'}
                      class:text-green-800={r.status === 'added'}
                      class:bg-yellow-100={r.status === 'duplicate'}
                      class:text-yellow-800={r.status === 'duplicate'}
                      class:bg-red-100={r.status === 'invalid'}
                      class:text-red-800={r.status === 'invalid'}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-gray-500 text-xs">{r.error || ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  {/if}

  <!-- Help Section -->
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">How It Works</h3>
    <div class="text-sm text-blue-800 space-y-2">
      <p>
        This tool uses a <strong>bookmarklet</strong> (a small JavaScript snippet saved as a bookmark)
        to scan the Facebook page you're viewing for event links and metadata.
      </p>
      <p>
        Because it runs in <em>your browser session</em>, it can see events on pages and groups
        you have access to &mdash; no API key needed for discovery.
      </p>
      <p>
        Events are imported as <strong>pending</strong> and must be approved in the admin panel before
        they appear publicly.
      </p>
    </div>

    <div class="mt-4 p-3 bg-blue-100 rounded-lg">
      <p class="text-blue-900 text-sm font-medium">Tips for best results</p>
      <ul class="mt-1 text-blue-800 text-xs list-disc list-inside space-y-1">
        <li>Scroll down on the Facebook page to load more events before clicking the bookmarklet</li>
        <li>The bookmarklet works on page event tabs, group events, and event search results</li>
        <li>Events without titles will use a placeholder &mdash; you can edit them in the admin panel</li>
        <li>Duplicate detection uses Facebook event IDs, so re-importing is safe</li>
      </ul>
    </div>
  </div>
</div>
