<script lang="ts">
  import type { PageData } from './$types';
  import MusicNav from '$lib/components/MusicNav.svelte';

  export let data: PageData;

  function onPlay(e: Event) {
    for (const a of document.querySelectorAll<HTMLAudioElement>('audio.music-audio')) {
      if (a !== e.target) a.pause();
    }
  }
</script>

<svelte:head>
  <title>Saying "Yakima" | {data.libTitle}</title>
  <meta name="description" content="How we taught AI singers to pronounce Yakima, and every spelling we tried along the way." />
</svelte:head>

<main class="flex-1 bg-amber-50/40">
  <header class="bg-gradient-to-br from-green-900 to-green-700 text-white">
    <div class="max-w-6xl mx-auto px-4 py-8 text-center">
      <a href="/music" class="text-sm text-amber-200 underline">{data.libTitle}</a>
      <h1 class="mt-1 text-3xl md:text-5xl font-black tracking-tight" style="font-family: 'Playfair Display', Georgia, serif;">Saying "Yakima"</h1>
      <p class="mt-3 text-lg opacity-90 max-w-2xl mx-auto">Teaching an AI singer to pronounce our town's name took more tries than you'd think.</p>
      <div class="mt-5"><MusicNav pages={data.nav} current="saying-yakima" /></div>
    </div>
  </header>

  <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
    {#each data.pronunciation.sections as s}
      <section>
        <h2 class="text-xl font-bold text-green-900">{s.heading}</h2>
        <p class="mt-1 text-gray-800 leading-relaxed">{s.body}</p>
      </section>
    {/each}

    {#if data.pronunciation.examples.length}
      <section class="pt-4 border-t">
        <h2 class="text-xl font-bold text-green-900">Listen to the attempts</h2>
        <p class="mt-1 text-sm text-gray-600">Each spelling, as the AI sang it.</p>
        <div class="mt-4 space-y-4">
          {#each data.pronunciation.examples as ex}
            <div class="bg-white rounded-xl border p-4">
              <div class="flex flex-wrap items-baseline gap-x-3">
                <span class="text-lg font-bold {ex.spelling === 'Yak-eh-Mah' ? 'text-green-800' : 'text-gray-900'}">{ex.spelling}</span>
                {#if ex.spelling === 'Yak-eh-Mah'}<span class="text-xs font-semibold text-green-800 bg-green-100 px-2 py-0.5 rounded-full">the keeper</span>{/if}
                <span class="text-sm text-gray-500">{ex.song}{ex.date ? ` · ${ex.date}` : ''}</span>
              </div>
              <audio class="music-audio w-full mt-2" controls preload="none" src={ex.src} on:play={onPlay}></audio>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</main>
