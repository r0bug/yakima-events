<script lang="ts">
  import type { PageData } from './$types';
  import MusicNav from '$lib/components/MusicNav.svelte';

  export let data: PageData;
</script>

<svelte:head>
  <title>{data.title} | Yakima Events</title>
  <meta name="description" content="Songs made with Yakima Finds Song Factory to promote Yakima Finds, local businesses and Yakima." />
</svelte:head>

<main class="flex-1 bg-amber-50/40">
  <header class="bg-gradient-to-br from-green-900 to-green-700 text-white">
    <div class="max-w-6xl mx-auto px-4 py-10 text-center">
      <h1 class="text-3xl md:text-5xl font-black tracking-tight" style="font-family: 'Playfair Display', Georgia, serif;">{data.title}</h1>
      <p class="mt-4 text-lg opacity-90 max-w-2xl mx-auto">{data.intro}</p>
      <p class="mt-3 text-sm">
        <a href={data.githubUrl} target="_blank" rel="noopener" class="underline text-amber-200 hover:text-amber-100">Yakima Finds Song Factory on GitHub</a>
        <span class="opacity-70">· {data.total} songs</span>
      </p>
      <div class="mt-6"><MusicNav pages={data.nav} /></div>
    </div>
  </header>

  <div class="max-w-6xl mx-auto px-4 py-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each data.pages as p}
      <a href="/music/{p.slug}" class="block bg-white rounded-xl border shadow-sm p-5 hover:border-green-700 hover:shadow transition">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="text-xl font-bold text-green-900">{p.title}</h2>
          <span class="text-sm text-gray-500 whitespace-nowrap">{p.count} songs</span>
        </div>
        <p class="mt-1 text-sm text-gray-700">{p.description}</p>
        <p class="mt-3 text-xs text-gray-500">{p.sample.join(' · ')}{p.count > p.sample.length ? ' …' : ''}</p>
      </a>
    {/each}
    <a href="/music/saying-yakima" class="block bg-amber-100 rounded-xl border border-amber-300 shadow-sm p-5 hover:border-amber-600 hover:shadow transition">
      <h2 class="text-xl font-bold text-amber-900">Saying "Yakima"</h2>
      <p class="mt-1 text-sm text-gray-700">How we taught the AI singers to pronounce our town's name, with a listen to every spelling we tried.</p>
    </a>
  </div>
</main>
