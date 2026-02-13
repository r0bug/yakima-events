<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>{$page.status} - Yakima Events</title>
</svelte:head>

<main class="flex-1 flex items-center justify-center px-4 py-16">
  <div class="text-center max-w-md">
    <p class="text-6xl font-bold text-primary-600 mb-4">{$page.status}</p>

    {#if $page.status === 404}
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
      <p class="text-gray-600 mb-8">The page you're looking for doesn't exist or has been moved.</p>
    {:else if $page.status >= 500}
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
      <p class="text-gray-600 mb-8">We're having trouble loading this page. Please try again later.</p>
    {:else}
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Error</h1>
      <p class="text-gray-600 mb-8">{$page.error?.message || 'An unexpected error occurred.'}</p>
    {/if}

    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      <a
        href="/"
        class="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
      >
        Go Home
      </a>
      <a
        href="/calendar"
        class="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
      >
        View Calendar
      </a>
    </div>
  </div>
</main>
