<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  const KIND_STYLE: Record<string, string> = {
    request: 'bg-blue-100 text-blue-800',
    criticism: 'bg-red-100 text-red-800',
    general: 'bg-gray-100 text-gray-700',
  };
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Fresh Hop song feedback</h1>
    <a href="/freshhop" class="text-sm underline">View page</a>
  </div>

  {#if data.feedback.length === 0}
    <p class="text-gray-500">No feedback yet.</p>
  {:else}
    <p class="text-sm text-gray-500">{data.feedback.length} comment(s), newest first.</p>
    {#each data.feedback as f}
      <div class="bg-white rounded-lg border p-4">
        <div class="flex flex-wrap items-center gap-2 text-sm">
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
