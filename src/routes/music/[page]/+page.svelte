<script lang="ts">
  import type { PageData } from './$types';
  import MusicNav from '$lib/components/MusicNav.svelte';
  import MusicSongCard from '$lib/components/MusicSongCard.svelte';

  export let data: PageData;

  $: page = data.page;
</script>

<svelte:head>
  <title>{page.title} | {data.libTitle}</title>
  <meta name="description" content={page.description} />
</svelte:head>

<main class="flex-1 bg-amber-50/40">
  <header class="bg-gradient-to-br from-green-900 to-green-700 text-white">
    <div class="max-w-6xl mx-auto px-4 py-8 text-center">
      <a href="/music" class="text-sm text-amber-200 underline">{data.libTitle}</a>
      <h1 class="mt-1 text-3xl md:text-5xl font-black tracking-tight" style="font-family: 'Playfair Display', Georgia, serif;">{page.title}</h1>
      <p class="mt-3 text-lg opacity-90 max-w-2xl mx-auto">{page.description}</p>
      <div class="mt-5"><MusicNav pages={data.nav} current={page.slug} /></div>
    </div>
  </header>

  <div class="max-w-6xl mx-auto px-4 py-6">
    <details class="bg-white rounded-xl border p-4 text-sm" open={page.songs.length <= 12}>
      <summary class="cursor-pointer font-semibold text-green-900">{page.songs.length} songs on this page</summary>
      <ul class="mt-3 columns-1 sm:columns-2 lg:columns-3 gap-6">
        {#each page.songs as s}
          <li class="py-0.5 break-inside-avoid"><a href="#{s.slug}" class="text-green-800 hover:underline">{s.title}</a></li>
        {/each}
      </ul>
    </details>
  </div>

  <div class="max-w-6xl mx-auto px-4 pb-10 space-y-8">
    {#each page.songs as song (song.slug)}
      <MusicSongCard {song} />
    {/each}
  </div>
</main>
