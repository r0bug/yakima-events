<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  let showCreateModal = false;
  let newChannel = {
    name: '',
    description: '',
    type: 'public' as 'public' | 'private',
  };
  let creating = false;
  let error = '';

  async function createChannel() {
    if (!newChannel.name.trim()) {
      error = 'Channel name is required';
      return;
    }

    creating = true;
    error = '';

    try {
      const response = await fetch('/api/communication/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChannel),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create channel');
      }

      // Navigate to the new channel
      window.location.href = `/communication/${result.channel.id}`;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create channel';
    } finally {
      creating = false;
    }
  }

  async function joinChannel(channelId: number) {
    try {
      const response = await fetch(`/api/communication/channels/${channelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });

      if (response.ok) {
        window.location.href = `/communication/${channelId}`;
      }
    } catch (e) {
      console.error('Failed to join channel:', e);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'No activity';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Communication Hub - Yakima Events</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Communication Hub</h1>
        <p class="text-gray-600 mt-1">Connect with shop owners and event organizers</p>
      </div>
      <button
        on:click={() => (showCreateModal = true)}
        class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Channel
      </button>
    </div>

    <!-- My Channels -->
    <div class="mb-8">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">My Channels</h2>
      {#if data.userChannels.length === 0}
        <div class="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <p>You haven't joined any channels yet.</p>
          <p class="text-sm mt-1">Join a public channel or create your own!</p>
        </div>
      {:else}
        <div class="grid gap-4">
          {#each data.userChannels as channel}
            <a
              href="/communication/{channel.id}"
              class="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-gray-900">{channel.name}</h3>
                    {#if channel.type === 'private'}
                      <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">Private</span>
                    {:else if channel.type === 'announcement'}
                      <span class="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">Announcements</span>
                    {/if}
                  </div>
                  {#if channel.description}
                    <p class="text-gray-600 text-sm mt-1 line-clamp-2">{channel.description}</p>
                  {/if}
                </div>
                <div class="text-right text-sm text-gray-500">
                  <div>{channel.participantCount} members</div>
                  <div class="text-xs">{formatDate(channel.lastActivityAt)}</div>
                </div>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Public Channels to Join -->
    {#if data.publicChannels.length > 0}
      <div>
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Discover Channels</h2>
        <div class="grid gap-4">
          {#each data.publicChannels as channel}
            <div class="bg-white rounded-lg shadow p-4">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="font-semibold text-gray-900">{channel.name}</h3>
                  {#if channel.description}
                    <p class="text-gray-600 text-sm mt-1 line-clamp-2">{channel.description}</p>
                  {/if}
                  <div class="text-sm text-gray-500 mt-2">
                    {channel.participantCount} members · {channel.messageCount} messages
                  </div>
                </div>
                <button
                  on:click={() => joinChannel(channel.id)}
                  class="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                >
                  Join
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Create Channel Modal -->
{#if showCreateModal}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    on:click|self={() => (showCreateModal = false)}
    on:keydown={(e) => e.key === 'Escape' && (showCreateModal = false)}
    role="button"
    tabindex="-1"
  >
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
      <h2 class="text-xl font-bold text-gray-900 mb-4">Create New Channel</h2>

      {#if error}
        <div class="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      {/if}

      <form on:submit|preventDefault={createChannel}>
        <div class="mb-4">
          <label for="channelName" class="block text-sm font-medium text-gray-700 mb-1">
            Channel Name
          </label>
          <input
            id="channelName"
            type="text"
            bind:value={newChannel.name}
            placeholder="e.g., Shop Owners Network"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        <div class="mb-4">
          <label for="channelDescription" class="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="channelDescription"
            bind:value={newChannel.description}
            placeholder="What is this channel about?"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          ></textarea>
        </div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Channel Type</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                bind:group={newChannel.type}
                value="public"
                class="text-purple-600 focus:ring-purple-500"
              />
              <span class="text-gray-700">Public</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                bind:group={newChannel.type}
                value="private"
                class="text-purple-600 focus:ring-purple-500"
              />
              <span class="text-gray-700">Private</span>
            </label>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            {newChannel.type === 'public'
              ? 'Anyone can join and see messages'
              : 'Only invited members can join'}
          </p>
        </div>

        <div class="flex gap-3">
          <button
            type="button"
            on:click={() => (showCreateModal = false)}
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating}
            class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
