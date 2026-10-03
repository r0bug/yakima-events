<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: config = data.config;
  $: favCounts = data.favorites.counts as Record<string, number>;
  $: myFavs = new Set<string>(data.favorites.mine);
  $: picksLeft = data.maxFavorites - myFavs.size;

  // Lore entries use light markdown (**bold**, "- " bullets). Escape first, then
  // re-add bold only, so nothing in the content can inject markup.
  function loreHtml(text: string): string {
    const esc = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // Only one track plays at a time across the page
  function onPlay(e: Event) {
    for (const a of document.querySelectorAll<HTMLAudioElement>('audio.fh-audio')) {
      if (a !== e.target) a.pause();
    }
  }
</script>

<svelte:head>
  <title>{config.title} | Yakima Finds</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="flex-1 bg-amber-50/40">
  <header class="bg-gradient-to-br from-green-900 to-green-700 text-white">
    <div class="max-w-6xl mx-auto px-4 py-10 text-center">
      <h1 class="text-3xl md:text-5xl font-black tracking-tight" style="font-family: 'Playfair Display', Georgia, serif;">
        {config.title}
      </h1>
      {#if config.intro}
        <p class="mt-3 text-lg opacity-90 max-w-2xl mx-auto">{config.intro}</p>
      {/if}
      <p class="mt-3 text-sm font-semibold text-amber-200">
        ★ Pick up to {data.maxFavorites} favorites to help choose the final song
        {#if myFavs.size > 0}· {picksLeft} pick{picksLeft === 1 ? '' : 's'} left (click again to un-pick){/if}
      </p>
      <nav class="mt-5 flex flex-wrap justify-center gap-2 text-sm">
        {#each config.songs as s}
          <a href="#{s.slug}" class="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25">{s.title}</a>
        {/each}
        {#if config.lore?.length}
          <a href="#lore" class="px-3 py-1 rounded-full bg-amber-300/30 hover:bg-amber-300/40">Lyric seed data</a>
        {/if}
      </nav>
    </div>
  </header>

  <div class="max-w-6xl mx-auto px-4 py-8 space-y-10">
    {#each config.songs as song (song.slug)}
      <section id={song.slug} class="bg-white rounded-xl border shadow-sm overflow-hidden scroll-mt-4">
        <div class="px-5 py-4 border-b bg-green-50 flex flex-wrap items-start gap-3">
          <div class="flex-1 min-w-0">
            <h2 class="text-2xl font-bold text-green-900">{song.title}</h2>
            {#if song.genre}<p class="text-sm text-gray-600 mt-0.5">{song.genre}</p>{/if}
          </div>
          <form method="POST" action="?/favorite" use:enhance class="text-right">
            <input type="hidden" name="song" value={song.slug} />
            <button type="submit"
              aria-pressed={myFavs.has(song.slug)}
              class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors
                {myFavs.has(song.slug)
                  ? 'bg-amber-400 border-amber-500 text-amber-950 hover:bg-amber-300'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-amber-400'}">
              <span aria-hidden="true">{myFavs.has(song.slug) ? '★' : '☆'}</span>
              {myFavs.has(song.slug) ? 'Your favorite' : 'Pick as favorite'}
              <span class="ml-1 px-2 py-0.5 rounded-full text-xs bg-black/10" title="Times picked as a favorite">{favCounts[song.slug] || 0}</span>
            </button>
            {#if form?.favSong === song.slug && form?.favError}
              <p class="mt-1 text-xs text-red-700">{form.favError}</p>
            {/if}
          </form>
        </div>

        <div class="grid md:grid-cols-2 gap-0">
          <div class="p-5 space-y-5 md:border-r">
            {#each song.versions as v}
              <div>
                <div class="text-sm font-semibold text-gray-700 mb-1">{v.label}</div>
                <audio class="fh-audio w-full" controls preload="none" src={v.src} on:play={onPlay}></audio>
                <a href={v.src} download class="text-xs text-green-800 underline">Download MP3</a>
              </div>
            {/each}

            <div class="pt-2 border-t">
              <h3 class="font-semibold text-gray-800 mb-2">Requests &amp; feedback</h3>
              {#if form?.song === song.slug && form?.success}
                <div class="p-3 rounded-lg bg-green-50 text-green-800 text-sm">Thanks! Your comment was sent.</div>
              {:else}
                {#if form?.song === song.slug && form?.error}
                  <div class="mb-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.error}</div>
                {/if}
                <form method="POST" action="?/feedback" use:enhance={() => async ({ update }) => update({ reset: true, invalidateAll: false })} class="space-y-2">
                  <input type="hidden" name="song" value={song.slug} />
                  <input type="text" name="website" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
                  <div class="flex flex-wrap gap-3 text-sm">
                    <label class="flex items-center gap-1"><input type="radio" name="kind" value="request" /> Request a change</label>
                    <label class="flex items-center gap-1"><input type="radio" name="kind" value="criticism" /> Criticism</label>
                    <label class="flex items-center gap-1"><input type="radio" name="kind" value="general" checked /> General</label>
                  </div>
                  <input type="text" name="name" maxlength="100" placeholder="Your name (optional)"
                    class="w-full rounded-lg border px-3 py-2 text-sm" />
                  <textarea name="message" rows="4" maxlength="4000" required
                    placeholder="What should change? Wrong facts, names, pronunciation, style…"
                    class="w-full rounded-lg border px-3 py-2 text-sm"></textarea>
                  <button type="submit" class="px-4 py-2 rounded-lg bg-green-800 hover:bg-green-900 text-white text-sm font-semibold">
                    Send comment
                  </button>
                </form>
              {/if}
            </div>
          </div>

          <div class="p-5 bg-amber-50/50">
            <h3 class="font-semibold text-gray-800 mb-2">Lyrics</h3>
            <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800 max-h-[36rem] overflow-y-auto">{song.lyrics}</pre>
          </div>
        </div>
      </section>
    {/each}

    {#if config.lore?.length}
      <section id="lore" class="scroll-mt-4 space-y-4">
        <div>
          <h2 class="text-2xl font-bold text-green-900">Lyric seed data</h2>
          <p class="mt-1 text-gray-700 max-w-3xl">
            {config.loreIntro ||
              'These are the background notes ("lore") our songwriting tool feeds to the AI when it writes the lyrics. Every fact, name and number in the songs comes from here, so a correction here fixes the next round of songs. Please flag anything wrong, outdated or missing.'}
          </p>
        </div>

        {#each config.lore as entry (entry.slug)}
          <details id={entry.slug} class="bg-white rounded-xl border shadow-sm overflow-hidden scroll-mt-4">
            <summary class="cursor-pointer select-none px-5 py-3 font-semibold text-gray-800 bg-amber-50">{entry.title}</summary>
            <div class="grid md:grid-cols-2">
              <div class="p-5 md:border-r text-sm leading-relaxed text-gray-800 whitespace-pre-wrap max-h-[36rem] overflow-y-auto">{@html loreHtml(entry.content)}</div>
              <div class="p-5">
                <h3 class="font-semibold text-gray-800 mb-2">Notes or corrections</h3>
                {#if form?.song === entry.slug && form?.success}
                  <div class="p-3 rounded-lg bg-green-50 text-green-800 text-sm">Thanks! Your note was sent.</div>
                {:else}
                  {#if form?.song === entry.slug && form?.error}
                    <div class="mb-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.error}</div>
                  {/if}
                  <form method="POST" action="?/feedback" use:enhance={() => async ({ update }) => update({ reset: true, invalidateAll: false })} class="space-y-2">
                    <input type="hidden" name="song" value={entry.slug} />
                    <input type="hidden" name="kind" value="correction" />
                    <input type="text" name="website" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
                    <input type="text" name="name" maxlength="100" placeholder="Your name (optional)"
                      class="w-full rounded-lg border px-3 py-2 text-sm" />
                    <textarea name="message" rows="5" maxlength="4000" required
                      placeholder="What's wrong or missing? Quote the line and give the correct version if you can."
                      class="w-full rounded-lg border px-3 py-2 text-sm"></textarea>
                    <button type="submit" class="px-4 py-2 rounded-lg bg-green-800 hover:bg-green-900 text-white text-sm font-semibold">
                      Send note
                    </button>
                  </form>
                {/if}
              </div>
            </div>
          </details>
        {/each}
      </section>
    {/if}
  </div>
</main>
