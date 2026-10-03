<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: config = data.config;

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
      <nav class="mt-5 flex flex-wrap justify-center gap-2 text-sm">
        {#each config.songs as s}
          <a href="#{s.slug}" class="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25">{s.title}</a>
        {/each}
      </nav>
    </div>
  </header>

  <div class="max-w-6xl mx-auto px-4 py-8 space-y-10">
    {#each config.songs as song (song.slug)}
      <section id={song.slug} class="bg-white rounded-xl border shadow-sm overflow-hidden scroll-mt-4">
        <div class="px-5 py-4 border-b bg-green-50">
          <h2 class="text-2xl font-bold text-green-900">{song.title}</h2>
          {#if song.genre}<p class="text-sm text-gray-600 mt-0.5">{song.genre}</p>{/if}
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
  </div>
</main>
