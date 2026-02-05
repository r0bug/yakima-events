<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  let messageInput = '';
  let sending = false;
  let messagesContainer: HTMLDivElement;
  let shouldScrollToBottom = true;
  let showParticipants = false;
  let showPinned = false;
  let lastMessageId = 0;

  // Initialize lastMessageId
  $: if (data.messages.length > 0) {
    lastMessageId = Math.max(...data.messages.map(m => m.id));
  }

  // Auto-scroll to bottom when new messages arrive
  afterUpdate(() => {
    if (shouldScrollToBottom && messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  onMount(() => {
    // Scroll to bottom on mount
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Mark as read
    if (data.isParticipant && data.unreadCount > 0) {
      markAsRead();
    }

    // Poll for new messages every 5 seconds
    const pollInterval = setInterval(pollNewMessages, 5000);

    return () => clearInterval(pollInterval);
  });

  async function markAsRead() {
    try {
      await fetch(`/api/communication/channels/${data.channel.id}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
      });
    } catch (e) {
      console.error('Failed to mark as read:', e);
    }
  }

  async function pollNewMessages() {
    if (!data.isParticipant) return;

    try {
      const response = await fetch(
        `/api/communication/channels/${data.channel.id}/messages?after=${lastMessageId}`
      );
      const result = await response.json();

      if (result.messages && result.messages.length > 0) {
        data.messages = [...data.messages, ...result.messages];
        lastMessageId = Math.max(...data.messages.map(m => m.id));
        shouldScrollToBottom = true;
      }
    } catch (e) {
      console.error('Failed to poll messages:', e);
    }
  }

  async function sendMessage() {
    if (!messageInput.trim() || sending) return;

    sending = true;
    const content = messageInput.trim();
    messageInput = '';

    try {
      const response = await fetch(`/api/communication/channels/${data.channel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const result = await response.json();

      if (response.ok && result.message) {
        data.messages = [...data.messages, result.message];
        lastMessageId = result.message.id;
        shouldScrollToBottom = true;
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      messageInput = content; // Restore on error
    } finally {
      sending = false;
    }
  }

  async function joinChannel() {
    try {
      const response = await fetch(`/api/communication/channels/${data.channel.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to join channel:', e);
    }
  }

  async function leaveChannel() {
    if (!confirm('Are you sure you want to leave this channel?')) return;

    try {
      const response = await fetch(`/api/communication/channels/${data.channel.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      if (response.ok) {
        window.location.href = '/communication';
      }
    } catch (e) {
      console.error('Failed to leave channel:', e);
    }
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    }
  }

  function shouldShowDateDivider(index: number): boolean {
    if (index === 0) return true;
    const current = new Date(data.messages[index].createdAt).toDateString();
    const previous = new Date(data.messages[index - 1].createdAt).toDateString();
    return current !== previous;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleScroll() {
    if (messagesContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      shouldScrollToBottom = scrollHeight - scrollTop - clientHeight < 100;
    }
  }
</script>

<svelte:head>
  <title>{data.channel.name} - Communication Hub</title>
</svelte:head>

<div class="h-screen flex flex-col bg-gray-100">
  <!-- Header -->
  <div class="bg-white border-b px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <a href="/communication" class="text-gray-500 hover:text-gray-700" aria-label="Back to channels">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </a>
      <div>
        <h1 class="font-semibold text-gray-900">{data.channel.name}</h1>
        <p class="text-sm text-gray-500">{data.participants.length} members</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      {#if data.pinnedMessages.length > 0}
        <button
          on:click={() => (showPinned = !showPinned)}
          class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          title="Pinned messages"
          aria-label="Show pinned messages"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      {/if}
      <button
        on:click={() => (showParticipants = !showParticipants)}
        class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        title="Participants"
        aria-label="Show participants"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Main content -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Messages area -->
    <div class="flex-1 flex flex-col">
      <!-- Pinned messages banner -->
      {#if showPinned && data.pinnedMessages.length > 0}
        <div class="bg-yellow-50 border-b border-yellow-200 p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium text-yellow-800">Pinned Messages</h3>
            <button on:click={() => (showPinned = false)} class="text-yellow-600 hover:text-yellow-800" aria-label="Close pinned messages">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {#each data.pinnedMessages as pinned}
            <div class="bg-white rounded p-3 mb-2 last:mb-0 shadow-sm">
              <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span class="font-medium text-gray-700">{pinned.user.username}</span>
                <span>·</span>
                <span>{formatTime(pinned.createdAt)}</span>
              </div>
              <p class="text-gray-800">{pinned.content}</p>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Messages -->
      <div
        bind:this={messagesContainer}
        on:scroll={handleScroll}
        class="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {#if data.messages.length === 0}
          <div class="text-center text-gray-500 py-8">
            <p>No messages yet.</p>
            {#if data.isParticipant}
              <p class="text-sm mt-1">Be the first to say something!</p>
            {/if}
          </div>
        {:else}
          {#each data.messages as message, i}
            {#if shouldShowDateDivider(i)}
              <div class="flex items-center gap-4 my-4">
                <div class="flex-1 border-t border-gray-200"></div>
                <span class="text-xs text-gray-500 font-medium">{formatDate(message.createdAt)}</span>
                <div class="flex-1 border-t border-gray-200"></div>
              </div>
            {/if}

            <div class="flex items-start gap-3 group">
              <!-- Avatar -->
              {#if message.user.avatarUrl}
                <img
                  src={message.user.avatarUrl}
                  alt={message.user.username}
                  class="w-10 h-10 rounded-full"
                />
              {:else}
                <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                  {message.user.username.charAt(0).toUpperCase()}
                </div>
              {/if}

              <!-- Message content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2">
                  <span class="font-medium text-gray-900">{message.user.username}</span>
                  <span class="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                  {#if message.isEdited}
                    <span class="text-xs text-gray-400">(edited)</span>
                  {/if}
                  {#if message.isPinned}
                    <span class="text-xs text-yellow-600">📌 Pinned</span>
                  {/if}
                </div>
                <p class="text-gray-800 whitespace-pre-wrap break-words mt-0.5">
                  {message.content}
                </p>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Input area -->
      {#if data.isParticipant}
        <div class="border-t bg-white p-4">
          <form on:submit|preventDefault={sendMessage} class="flex gap-2">
            <textarea
              bind:value={messageInput}
              on:keydown={handleKeydown}
              placeholder="Type a message..."
              rows="1"
              class="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            ></textarea>
            <button
              type="submit"
              disabled={sending || !messageInput.trim()}
              class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      {:else if data.channel.type === 'public'}
        <div class="border-t bg-white p-4 text-center">
          <p class="text-gray-600 mb-2">Join this channel to participate</p>
          <button
            on:click={joinChannel}
            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Join Channel
          </button>
        </div>
      {:else}
        <div class="border-t bg-white p-4 text-center text-gray-500">
          You need an invitation to participate in this channel
        </div>
      {/if}
    </div>

    <!-- Participants sidebar -->
    {#if showParticipants}
      <div class="w-64 border-l bg-white overflow-y-auto">
        <div class="p-4 border-b">
          <h3 class="font-medium text-gray-900">Participants ({data.participants.length})</h3>
        </div>
        <div class="p-2">
          {#each data.participants as p}
            <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
              {#if p.user.avatarUrl}
                <img
                  src={p.user.avatarUrl}
                  alt={p.user.username}
                  class="w-8 h-8 rounded-full"
                />
              {:else}
                <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-medium">
                  {p.user.username.charAt(0).toUpperCase()}
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm text-gray-900 truncate">{p.user.username}</div>
                {#if p.role === 'admin'}
                  <div class="text-xs text-purple-600">Admin</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        {#if data.isParticipant}
          <div class="p-4 border-t">
            <button
              on:click={leaveChannel}
              class="w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
            >
              Leave Channel
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
