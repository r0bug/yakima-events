<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  let username = '';
  let password = '';
  let loading = false;
  let errorMsg = '';

  // OAuth error messages
  const errorMessages: Record<string, string> = {
    oauth_denied: 'You cancelled the sign-in process.',
    invalid_request: 'Invalid authentication request.',
    invalid_state: 'Authentication session expired. Please try again.',
    expired_state: 'Authentication session expired. Please try again.',
    oauth_failed: 'Authentication failed. Please try again.',
    account_banned: 'This account has been suspended.',
    email_not_verified: 'Please verify your email with Google first.'
  };

  $: oauthError = $page.url.searchParams.get('error');
  $: oauthErrorMessage = oauthError ? errorMessages[oauthError] || 'An error occurred.' : null;
  $: redirect = $page.url.searchParams.get('redirect') || $page.url.searchParams.get('return') || '/';

  async function handleLogin() {
    errorMsg = '';
    loading = true;

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await res.json();

      if (!res.ok) {
        errorMsg = result.error || 'Login failed';
        return;
      }

      goto(redirect);
    } catch {
      errorMsg = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign In - Yakima Events</title>
</svelte:head>

<div class="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <h1 class="text-center text-3xl font-bold text-gray-900">Yakima Events</h1>
    <h2 class="mt-2 text-center text-xl text-gray-600">Sign in to your account</h2>
  </div>

  <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
      {#if oauthErrorMessage}
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {oauthErrorMessage}
        </div>
      {/if}

      {#if errorMsg}
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {errorMsg}
        </div>
      {/if}

      <!-- Username/Password Form -->
      <form on:submit|preventDefault={handleLogin} class="space-y-4">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700">Username or Email</label>
          <input
            id="username"
            type="text"
            bind:value={username}
            required
            autocomplete="username"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="admin"
          />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            autocomplete="current-password"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <!-- Google OAuth (conditional) -->
      {#if data.googleAuthEnabled}
        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div class="mt-4">
            <a
              href="/auth/google?redirect={encodeURIComponent(redirect)}"
              class="w-full flex justify-center items-center gap-3 py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </a>
          </div>
        </div>
      {/if}
    </div>

    <div class="mt-6 text-center">
      <a href="/" class="text-sm text-blue-600 hover:text-blue-500">
        &larr; Back to home
      </a>
    </div>
  </div>
</div>
