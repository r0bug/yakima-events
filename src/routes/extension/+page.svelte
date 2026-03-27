<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
  <title>Browser Extension - YFEvents</title>
  <meta name="description" content="Download the YFEvents browser extension to capture events from any website and import them into the Yakima events calendar." />
</svelte:head>

<Header />

<main class="min-h-screen bg-warm-50 py-12">
  <div class="max-w-3xl mx-auto px-4">
    <div class="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
      <!-- Hero -->
      <div class="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 p-8 text-white">
        <div class="flex items-center gap-4 mb-4">
          <div class="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
            <svg class="w-8 h-8 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-display font-bold">YFEvents Page Capture</h1>
            <p class="text-stone-300 text-sm">Browser Extension v1.3.0</p>
          </div>
        </div>
        <p class="text-stone-200 leading-relaxed">
          Capture events from Facebook, VisitYakima, and other websites directly into the Yakima events calendar. Works on any page with event listings.
        </p>
        <a
          href="/extension.zip"
          download="yfevents-extension-v1.3.0.zip"
          class="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold rounded-xl transition-colors shadow-lg"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Extension (ZIP)
        </a>
      </div>

      <!-- Instructions -->
      <div class="p-8 space-y-8">
        <section>
          <h2 class="text-lg font-display font-bold text-stone-800 mb-4 flex items-center gap-2">
            <span class="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold">1</span>
            Install the Extension
          </h2>
          <ol class="space-y-3 text-stone-600 ml-9">
            <li>Download the ZIP file above and <strong>unzip</strong> it to a folder on your computer</li>
            <li>Open Chrome and go to <code class="bg-warm-100 px-2 py-0.5 rounded text-sm font-mono text-stone-800">chrome://extensions</code></li>
            <li>Turn on <strong>Developer mode</strong> (toggle in the top-right corner)</li>
            <li>Click <strong>"Load unpacked"</strong> and select the unzipped folder</li>
            <li>The YFEvents icon will appear in your browser toolbar</li>
          </ol>
        </section>

        <section>
          <h2 class="text-lg font-display font-bold text-stone-800 mb-4 flex items-center gap-2">
            <span class="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold">2</span>
            Capture Events
          </h2>
          <div class="space-y-4 ml-9">
            <div class="bg-warm-50 rounded-xl p-4">
              <h3 class="font-semibold text-stone-800 mb-1">Facebook Events</h3>
              <p class="text-sm text-stone-600">Navigate to a Facebook events page. The extension auto-detects events. Click the YFEvents icon and use <strong>"Import Facebook Events"</strong> to send them directly to the calendar.</p>
            </div>
            <div class="bg-warm-50 rounded-xl p-4">
              <h3 class="font-semibold text-stone-800 mb-1">Any Other Website</h3>
              <p class="text-sm text-stone-600">On any page with event listings (like visityakima.com), click the YFEvents icon and use <strong>"Find Events on Page"</strong>. The extension scans for dates, titles, and locations in the page structure.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-lg font-display font-bold text-stone-800 mb-4 flex items-center gap-2">
            <span class="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold">3</span>
            Import to Calendar
          </h2>
          <p class="text-stone-600 ml-9">
            After scanning, review the detected events and click <strong>"Send All to YFEvents"</strong>. Events are automatically deduplicated, so re-importing the same page won't create duplicates.
          </p>
        </section>

        <section class="border-t border-warm-100 pt-6">
          <h2 class="text-lg font-display font-bold text-stone-800 mb-3">Supported Sites</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex items-center gap-2 text-sm text-stone-600">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              Facebook Events
            </div>
            <div class="flex items-center gap-2 text-sm text-stone-600">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              VisitYakima.com
            </div>
            <div class="flex items-center gap-2 text-sm text-stone-600">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              Any site with event cards
            </div>
            <div class="flex items-center gap-2 text-sm text-stone-600">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              JSON-LD structured data
            </div>
          </div>
        </section>

        <section class="border-t border-warm-100 pt-6">
          <h2 class="text-lg font-display font-bold text-stone-800 mb-3">Updating the Extension</h2>
          <p class="text-stone-600 text-sm">
            Sideloaded extensions don't auto-update. To update: download the new ZIP, unzip it to the <strong>same folder</strong> (overwrite files), then go to <code class="bg-warm-100 px-2 py-0.5 rounded text-sm font-mono text-stone-800">chrome://extensions</code> and click the <strong>refresh icon</strong> on the YFEvents card.
          </p>
        </section>
      </div>
    </div>
  </div>
</main>

<Footer />
