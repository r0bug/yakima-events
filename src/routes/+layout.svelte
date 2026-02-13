<script lang="ts">
  import '../app.css';
  import { navigating } from '$app/stores';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import type { LayoutData } from './$types';

  export let data: LayoutData;
</script>

{#if $navigating}
  <div class="fixed top-0 left-0 right-0 z-[100] h-1 bg-primary-200">
    <div class="h-full bg-primary-600 animate-loading-bar"></div>
  </div>
{/if}

<div class="min-h-screen flex flex-col">
  <Header user={data.user} />
  <slot />
  <Footer />
</div>
