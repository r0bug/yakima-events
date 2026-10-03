<script lang="ts">
  export let pages: { slug: string; title: string; count: number }[];
  export let current = '';
</script>

<nav class="flex flex-wrap justify-center gap-2 text-sm" aria-label="Music pages">
  <a href="/music"
    class="px-3 py-1 rounded-full {current === '' ? 'bg-amber-400 text-amber-950 font-semibold' : 'bg-white/15 hover:bg-white/25'}">All music</a>
  {#each pages as p}
    <a href="/music/{p.slug}" aria-current={current === p.slug ? 'page' : undefined}
      class="px-3 py-1 rounded-full {current === p.slug ? 'bg-amber-400 text-amber-950 font-semibold' : 'bg-white/15 hover:bg-white/25'}">
      {p.title}
    </a>
  {/each}
  <a href="/music/saying-yakima"
    class="px-3 py-1 rounded-full {current === 'saying-yakima' ? 'bg-amber-400 text-amber-950 font-semibold' : 'bg-amber-300/30 hover:bg-amber-300/40'}">Saying "Yakima"</a>
</nav>
