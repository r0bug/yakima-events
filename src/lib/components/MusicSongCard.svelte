<script lang="ts">
  import type { MusicSong } from '$lib/types/music';

  export let song: MusicSong;

  // Only one track plays at a time across the page
  function onPlay(e: Event) {
    for (const a of document.querySelectorAll<HTMLAudioElement>('audio.music-audio')) {
      if (a !== e.target) a.pause();
    }
  }
</script>

<section id={song.slug} class="bg-white rounded-xl border shadow-sm overflow-hidden scroll-mt-4">
  <div class="px-5 py-4 border-b bg-green-50">
    <h2 class="text-2xl font-bold text-green-900">{song.title}</h2>
    {#if song.genre}<p class="text-sm text-gray-600 mt-0.5">{song.genre}</p>{/if}
    {#if song.versions.length > 2}
      <p class="text-xs text-gray-500 mt-1">{song.versions.length} recordings of these lyrics</p>
    {/if}
  </div>

  <div class="grid md:grid-cols-2">
    <div class="p-5 space-y-5 md:border-r">
      {#each song.versions as v}
        <div>
          <div class="text-sm font-semibold text-gray-700 mb-1">{v.label}</div>
          <audio class="music-audio w-full" controls preload="none" src={v.src} on:play={onPlay}></audio>
          <a href={v.src} download class="text-xs text-green-800 underline">Download MP3</a>
        </div>
      {/each}
    </div>

    <div class="p-5 bg-amber-50/50">
      <h3 class="font-semibold text-gray-800 mb-2">Lyrics</h3>
      {#if song.lyrics}
        <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800 max-h-[32rem] overflow-y-auto">{song.lyrics}</pre>
      {:else}
        <p class="text-sm text-gray-500 italic">Lyrics weren't saved for this early recording.</p>
      {/if}
    </div>
  </div>
</section>
