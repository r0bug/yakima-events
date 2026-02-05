<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let itemType: 'event' | 'shop';
  export let itemId: number;
  export let size: 'sm' | 'md' | 'lg' = 'md';

  const dispatch = createEventDispatcher();

  let showMenu = false;
  let shareData: {
    openGraph: { title: string; description: string; url: string };
    links: { direct: string; facebook: string; twitter: string; email: string };
    hashtags: string[];
  } | null = null;
  let loading = false;
  let copied = false;

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  async function loadShareData() {
    if (shareData) return;

    loading = true;
    try {
      const response = await fetch(`/api/${itemType}s/${itemId}/share`);
      if (response.ok) {
        shareData = await response.json();
      }
    } catch (e) {
      console.error('Failed to load share data:', e);
    } finally {
      loading = false;
    }
  }

  async function toggleMenu() {
    if (!showMenu) {
      await loadShareData();
    }
    showMenu = !showMenu;
  }

  function closeMenu() {
    showMenu = false;
  }

  async function copyLink() {
    if (!shareData) return;

    try {
      await navigator.clipboard.writeText(shareData.links.direct);
      copied = true;
      setTimeout(() => (copied = false), 2000);
      dispatch('share', { platform: 'copy', url: shareData.links.direct });
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }

  function shareToFacebook() {
    if (!shareData) return;
    window.open(shareData.links.facebook, '_blank', 'width=600,height=400');
    dispatch('share', { platform: 'facebook', url: shareData.links.direct });
  }

  function shareToTwitter() {
    if (!shareData) return;
    window.open(shareData.links.twitter, '_blank', 'width=600,height=400');
    dispatch('share', { platform: 'twitter', url: shareData.links.direct });
  }

  function shareViaEmail() {
    if (!shareData) return;
    window.location.href = shareData.links.email;
    dispatch('share', { platform: 'email', url: shareData.links.direct });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeMenu();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="relative">
  <button
    on:click={toggleMenu}
    class="rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors {sizeClasses[size]}"
    aria-label="Share"
    aria-expanded={showMenu}
  >
    {#if loading}
      <svg class="animate-spin w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {:else}
      <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    {/if}
  </button>

  {#if showMenu && shareData}
    <div
      class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-2 z-50"
      on:click|stopPropagation
      role="menu"
    >
      <button
        on:click={shareToFacebook}
        class="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
        role="menuitem"
      >
        <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        <span class="text-gray-700">Facebook</span>
      </button>

      <button
        on:click={shareToTwitter}
        class="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
        role="menuitem"
      >
        <svg class="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        <span class="text-gray-700">X (Twitter)</span>
      </button>

      <button
        on:click={shareViaEmail}
        class="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
        role="menuitem"
      >
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span class="text-gray-700">Email</span>
      </button>

      <div class="border-t my-2"></div>

      <button
        on:click={copyLink}
        class="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
        role="menuitem"
      >
        {#if copied}
          <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-green-600">Copied!</span>
        {:else}
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span class="text-gray-700">Copy Link</span>
        {/if}
      </button>
    </div>

    <!-- Backdrop to close menu -->
    <div
      class="fixed inset-0 z-40"
      on:click={closeMenu}
      on:keydown={(e) => e.key === 'Enter' && closeMenu()}
      role="button"
      tabindex="-1"
      aria-label="Close share menu"
    ></div>
  {/if}
</div>
