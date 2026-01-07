<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let message: string;
  export let type: 'success' | 'error' = 'success';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }
</script>

<div
  class="fixed top-4 right-4 z-50 toast-enter max-w-md shadow-lg rounded-lg overflow-hidden {type === 'success'
    ? 'bg-green-500'
    : 'bg-red-500'}"
>
  <div class="flex items-center gap-3 px-4 py-3 text-white">
    {#if type === 'success'}
      <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    {:else}
      <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    {/if}
    <span class="flex-1">{message}</span>
    <button on:click={close} class="ml-2 hover:bg-white/20 rounded p-1">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</div>
