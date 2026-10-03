<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  const KIND_STYLE: Record<string, string> = {
    request: 'bg-blue-100 text-blue-800',
    criticism: 'bg-red-100 text-red-800',
    general: 'bg-gray-100 text-gray-700',
    correction: 'bg-amber-100 text-amber-800',
  };
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Fresh Hop song feedback</h1>
    <a href="/freshhop" class="text-sm underline">View page</a>
  </div>

  <div class="bg-white rounded-lg border p-4">
    <h2 class="font-semibold mb-2">Favorites <span class="text-sm font-normal text-gray-500">({data.voters} voter{data.voters === 1 ? '' : 's'})</span></h2>
    <table class="text-sm">
      {#each data.ranking as r}
        <tr><td class="pr-6 py-0.5">{r.title}</td><td class="text-right font-semibold">★ {r.count}</td></tr>
      {/each}
    </table>
  </div>

  <details class="bg-white rounded-lg border p-4 text-sm">
    <summary class="font-semibold cursor-pointer">How to update this page</summary>
    <div class="mt-3 space-y-2 text-gray-700">
      <p>
        Song content comes from Song Factory on <b>hairydel</b>: every song tagged <b>FreshHop</b>.
        After tagging new songs, run on hairydel:
      </p>
      <pre class="bg-gray-100 rounded px-3 py-2 overflow-x-auto">cd ~/YakimaFindsSongWriter && python3 scripts/export_tag_to_drive.py --web</pre>
      <p>This refreshes both this page and the Google Drive <b>FreshHop</b> folder. No rebuild or restart needed.</p>
      <ul class="list-disc pl-5 space-y-1">
        <li>Songs with the same lyrics share one card; each re-generation is a "Take" with two versions.</li>
        <li>Different lyrics under the same title get the genre added to the card name, e.g. "(Hip-Hop)".</li>
        <li>Duplicate audio is skipped. The script removes only files it created earlier, so anything the board adds to the Drive folder is kept.</li>
        <li>Comments and favorites are never touched by an update.</li>
        <li><b>Caution:</b> favorites are keyed by recording position on a card (e.g. <code>fresh-hop-celebration-3</code>). Brand-new songs are safe, but adding a new take to a card that already has votes can shift that card's votes. Avoid it once voting is underway.</li>
        <li>Lore shown under "Lyric seed data" is the fixed list <code>WEB_LORE</code> in the script (lore ids 74, 58, 16, 1); edit the lore in Song Factory, then rerun.</li>
      </ul>
      <p class="text-gray-500">
        Files on backoffice (<code>~/yakima</code>, gitignored): <code>data/freshhop.json</code> (content),
        <code>data/freshhop-feedback.jsonl</code> (comments), <code>data/freshhop-favorites.json</code> (votes),
        <code>uploads/freshhop/</code> (audio).
      </p>
    </div>
  </details>

  {#if data.feedback.length === 0}
    <p class="text-gray-500">No feedback yet.</p>
  {:else}
    <p class="text-sm text-gray-500">{data.feedback.length} comment(s), newest first.</p>
    {#each data.feedback as f}
      <div class="bg-white rounded-lg border p-4">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          {#if f.section === 'lore'}<span class="text-xs text-gray-500">Lore:</span>{/if}
          <span class="font-semibold">{f.song}</span>
          <span class="px-2 py-0.5 rounded-full text-xs {KIND_STYLE[f.kind] || KIND_STYLE.general}">{f.kind}</span>
          <span class="text-gray-500">{f.name || 'Anonymous'}</span>
          <span class="ml-auto text-gray-400 text-xs">{new Date(f.at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}</span>
        </div>
        <p class="mt-2 whitespace-pre-wrap text-gray-800">{f.message}</p>
      </div>
    {/each}
  {/if}
</div>
