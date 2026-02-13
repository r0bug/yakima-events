<script lang="ts">
  export let variant: 'card' | 'row' | 'text' | 'circle' = 'text';
  export let count = 1;
</script>

{#each Array(count) as _}
  {#if variant === 'card'}
    <div class="card p-0 overflow-hidden animate-pulse">
      <div class="w-full h-48 bg-gray-200"></div>
      <div class="p-4 space-y-3">
        <div class="h-4 bg-gray-200 rounded w-3/4"></div>
        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
        <div class="h-3 bg-gray-200 rounded w-full"></div>
        <div class="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  {:else if variant === 'row'}
    <div class="flex items-center gap-4 p-4 animate-pulse">
      <div class="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0"></div>
      <div class="flex-1 space-y-2">
        <div class="h-4 bg-gray-200 rounded w-1/3"></div>
        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
      <div class="h-6 w-16 bg-gray-200 rounded"></div>
    </div>
  {:else if variant === 'circle'}
    <div class="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
  {:else}
    <div class="animate-pulse space-y-2">
      <div class="h-4 bg-gray-200 rounded w-full"></div>
      <div class="h-4 bg-gray-200 rounded w-5/6"></div>
      <div class="h-4 bg-gray-200 rounded w-4/6"></div>
    </div>
  {/if}
{/each}
