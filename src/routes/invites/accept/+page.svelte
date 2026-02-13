<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  interface InviteInfo {
    invite: {
      id: number;
      email: string;
      role: string;
      status: string;
      expiresAt: string;
    };
    shop: {
      id: number;
      name: string;
      imageUrl: string | null;
    };
    invitedBy: {
      username: string;
      email: string;
    };
  }

  let inviteInfo: InviteInfo | null = null;
  let loading = true;
  let accepting = false;
  let error: string | null = null;
  let success = false;

  async function loadInvite() {
    const token = $page.url.searchParams.get('token');
    if (!token) {
      error = 'No invite token provided';
      loading = false;
      return;
    }

    try {
      const res = await fetch(`/api/invites/info?token=${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid or expired invite');
      }
      inviteInfo = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load invite';
    } finally {
      loading = false;
    }
  }

  async function acceptInvite() {
    if (!data.user) {
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent($page.url.pathname + $page.url.search);
      goto(`/login?return=${returnUrl}`);
      return;
    }

    const token = $page.url.searchParams.get('token');
    if (!token) return;

    accepting = true;
    error = null;

    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to accept invite');
      }

      success = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to accept invite';
    } finally {
      accepting = false;
    }
  }

  onMount(loadInvite);
</script>

<svelte:head>
  <title>Accept Invitation - Yakima</title>
</svelte:head>

<main class="container mx-auto px-4 py-8 max-w-xl">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else if success}
    <div class="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
      <svg class="mx-auto h-16 w-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h1 class="text-2xl font-bold text-green-900 mb-2">Welcome to the Team!</h1>
      <p class="text-green-700 mb-6">
        You are now a {inviteInfo?.invite.role} at {inviteInfo?.shop.name}.
      </p>
      <a
        href="/shops/{inviteInfo?.shop.id}/manage"
        class="inline-block px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
      >
        Go to Shop Dashboard
      </a>
    </div>
  {:else if error && !inviteInfo}
    <div class="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
      <svg class="mx-auto h-16 w-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h1 class="text-2xl font-bold text-red-900 mb-2">Invalid Invitation</h1>
      <p class="text-red-700 mb-6">{error}</p>
      <a
        href="/shops"
        class="inline-block px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
      >
        Browse Shops
      </a>
    </div>
  {:else if inviteInfo}
    <div class="bg-white rounded-lg border shadow-sm overflow-hidden">
      <!-- Header -->
      <div class="bg-purple-600 text-white p-6 text-center">
        <h1 class="text-2xl font-bold mb-2">You're Invited!</h1>
        <p class="text-purple-100">Join the team at {inviteInfo.shop.name}</p>
      </div>

      <!-- Shop Info -->
      <div class="p-6 border-b">
        <div class="flex items-center gap-4">
          {#if inviteInfo.shop.imageUrl}
            <img
              src={inviteInfo.shop.imageUrl}
              alt={inviteInfo.shop.name}
              class="w-16 h-16 rounded-lg object-cover"
            />
          {:else}
            <div class="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          {/if}
          <div>
            <h2 class="text-xl font-semibold text-gray-900">{inviteInfo.shop.name}</h2>
            <p class="text-gray-600">
              Invited by {inviteInfo.invitedBy.username}
            </p>
          </div>
        </div>
      </div>

      <!-- Role Info -->
      <div class="p-6 border-b">
        <h3 class="text-sm font-medium text-gray-500 mb-2">Your Role</h3>
        <span class="inline-block px-3 py-1 rounded-full text-sm font-medium {inviteInfo.invite.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">
          {inviteInfo.invite.role === 'admin' ? 'Shop Admin' : 'Staff Member'}
        </span>
        <p class="mt-2 text-sm text-gray-600">
          {#if inviteInfo.invite.role === 'admin'}
            As an admin, you'll be able to manage the shop profile, team members, and create events.
          {:else}
            As a staff member, you can help manage the shop profile and create events.
          {/if}
        </p>
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="mx-6 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      {/if}

      <!-- Actions -->
      <div class="p-6">
        {#if !data.user}
          <p class="text-center text-gray-600 mb-4">
            Please sign in to accept this invitation.
          </p>
          <a
            href="/login?return={encodeURIComponent($page.url.pathname + $page.url.search)}"
            class="block w-full bg-purple-600 text-white text-center py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Sign in to Accept
          </a>
        {:else}
          <button
            on:click={acceptInvite}
            disabled={accepting}
            class="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {#if accepting}
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Accepting...
            {:else}
              Accept Invitation
            {/if}
          </button>
        {/if}

        <p class="text-center text-sm text-gray-500 mt-4">
          This invitation expires on {new Date(inviteInfo.invite.expiresAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  {/if}
</main>
