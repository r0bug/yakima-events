<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Header from '$lib/components/Header.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  interface Shop {
    id: number;
    name: string;
    address: string;
    imageUrl: string | null;
  }

  interface ClaimStatus {
    claimed: boolean;
    userClaim: {
      id: number;
      status: 'pending' | 'approved' | 'rejected';
      createdAt: string;
      reviewedAt: string | null;
      adminNotes: string | null;
    } | null;
  }

  let shop: Shop | null = null;
  let claimStatus: ClaimStatus | null = null;
  let loading = true;
  let submitting = false;
  let error: string | null = null;
  let success = false;

  let formData = {
    businessName: '',
    requesterName: '',
    requesterEmail: '',
    requesterPhone: '',
    relationshipToBusiness: '',
    ownershipProof: '',
  };

  async function loadData() {
    loading = true;
    error = null;

    try {
      const shopId = $page.params.id;

      // Load shop
      const shopRes = await fetch(`/api/shops/${shopId}`);
      if (!shopRes.ok) {
        throw new Error('Shop not found');
      }
      const shopData = await shopRes.json();
      shop = shopData.shop || shopData;

      // Pre-fill business name
      formData.businessName = shop?.name || '';

      // Load claim status
      const claimRes = await fetch(`/api/shops/${shopId}/claim`);
      if (claimRes.ok) {
        claimStatus = await claimRes.json();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
    } finally {
      loading = false;
    }
  }

  async function handleSubmit() {
    if (!data.user) {
      goto(`/login?return=${encodeURIComponent($page.url.pathname)}`);
      return;
    }

    submitting = true;
    error = null;

    try {
      const res = await fetch(`/api/shops/${$page.params.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to submit claim');
      }

      success = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to submit claim';
    } finally {
      submitting = false;
    }
  }

  onMount(loadData);
</script>

<svelte:head>
  <title>Claim {shop?.name || 'Shop'} - Yakima</title>
</svelte:head>

<Header user={data.user} />

<main class="container mx-auto px-4 py-8 max-w-2xl">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else if error && !shop}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      {error}
    </div>
    <a href="/shops" class="text-purple-600 hover:underline">← Back to shops</a>
  {:else if shop}
    <!-- Breadcrumb -->
    <nav class="mb-6 text-sm">
      <a href="/shops" class="text-purple-600 hover:underline">Shops</a>
      <span class="mx-2 text-gray-400">/</span>
      <a href="/shops/{shop.id}" class="text-purple-600 hover:underline">{shop.name}</a>
      <span class="mx-2 text-gray-400">/</span>
      <span class="text-gray-600">Claim</span>
    </nav>

    <!-- Shop Already Claimed -->
    {#if claimStatus?.claimed}
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <svg class="mx-auto h-12 w-12 text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 class="text-xl font-semibold text-yellow-900 mb-2">Shop Already Claimed</h1>
        <p class="text-yellow-700">This shop has already been claimed by its owner.</p>
        <a href="/shops/{shop.id}" class="inline-block mt-4 text-purple-600 hover:underline">
          ← Back to shop
        </a>
      </div>

    <!-- User Has Pending Claim -->
    {:else if claimStatus?.userClaim?.status === 'pending'}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <svg class="mx-auto h-12 w-12 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 class="text-xl font-semibold text-blue-900 mb-2">Claim Pending Review</h1>
        <p class="text-blue-700 mb-2">Your claim for this shop is currently being reviewed.</p>
        <p class="text-sm text-blue-600">
          Submitted on {new Date(claimStatus.userClaim.createdAt).toLocaleDateString()}
        </p>
        <a href="/shops/{shop.id}" class="inline-block mt-4 text-purple-600 hover:underline">
          ← Back to shop
        </a>
      </div>

    <!-- User Claim Rejected -->
    {:else if claimStatus?.userClaim?.status === 'rejected'}
      <div class="bg-red-50 border border-red-200 rounded-lg p-6">
        <div class="text-center mb-6">
          <svg class="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 class="text-xl font-semibold text-red-900 mb-2">Claim Rejected</h1>
          <p class="text-red-700">Your previous claim for this shop was not approved.</p>
        </div>
        {#if claimStatus.userClaim.adminNotes}
          <div class="bg-white rounded-lg p-4 mb-4">
            <p class="text-sm font-medium text-gray-700 mb-1">Reason:</p>
            <p class="text-gray-600">{claimStatus.userClaim.adminNotes}</p>
          </div>
        {/if}
        <p class="text-center text-sm text-red-600">
          If you believe this was in error, please contact support.
        </p>
        <div class="text-center mt-4">
          <a href="/shops/{shop.id}" class="text-purple-600 hover:underline">
            ← Back to shop
          </a>
        </div>
      </div>

    <!-- Success -->
    {:else if success}
      <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <svg class="mx-auto h-12 w-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 class="text-xl font-semibold text-green-900 mb-2">Claim Submitted!</h1>
        <p class="text-green-700 mb-4">
          Your claim has been submitted and is pending review. We'll notify you once it's been processed.
        </p>
        <a href="/shops/{shop.id}" class="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Back to Shop
        </a>
      </div>

    <!-- Claim Form -->
    {:else}
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Claim This Business</h1>
        <p class="text-gray-600">Verify your ownership of {shop.name}</p>
      </div>

      <!-- Shop Preview -->
      <div class="bg-gray-50 rounded-lg p-4 mb-6 flex items-center gap-4">
        {#if shop.imageUrl}
          <img src={shop.imageUrl} alt={shop.name} class="w-16 h-16 rounded-lg object-cover" />
        {:else}
          <div class="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        {/if}
        <div>
          <h2 class="font-semibold text-gray-900">{shop.name}</h2>
          <p class="text-sm text-gray-600">{shop.address}</p>
        </div>
      </div>

      {#if !data.user}
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center mb-6">
          <p class="text-yellow-800 mb-4">Please sign in to claim this business.</p>
          <a
            href="/login?return={encodeURIComponent($page.url.pathname)}"
            class="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Sign In
          </a>
        </div>
      {:else}
        {#if error}
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        {/if}

        <form on:submit|preventDefault={handleSubmit} class="bg-white rounded-lg border p-6 space-y-6">
          <!-- Business Info -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Business Information</h3>
            <div class="space-y-4">
              <div>
                <label for="businessName" class="block text-sm font-medium text-gray-700 mb-1">
                  Business Name <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="businessName"
                  bind:value={formData.businessName}
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          <!-- Your Info -->
          <div class="border-t pt-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Your Information</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="requesterName" class="block text-sm font-medium text-gray-700 mb-1">
                  Your Name <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="requesterName"
                  bind:value={formData.requesterName}
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label for="requesterEmail" class="block text-sm font-medium text-gray-700 mb-1">
                  Email <span class="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="requesterEmail"
                  bind:value={formData.requesterEmail}
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div class="md:col-span-2">
                <label for="requesterPhone" class="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="requesterPhone"
                  bind:value={formData.requesterPhone}
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          <!-- Verification -->
          <div class="border-t pt-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Verification</h3>
            <p class="text-sm text-gray-600 mb-4">
              Tell us about your relationship to this business.
            </p>
            <div class="space-y-4">
              <div>
                <label for="relationshipToBusiness" class="block text-sm font-medium text-gray-700 mb-1">
                  Relationship to Business <span class="text-red-500">*</span>
                </label>
                <select
                  id="relationshipToBusiness"
                  bind:value={formData.relationshipToBusiness}
                  required
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select your relationship</option>
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Authorized Employee</option>
                  <option value="representative">Authorized Representative</option>
                </select>
              </div>
              <div>
                <label for="ownershipProof" class="block text-sm font-medium text-gray-700 mb-1">
                  Proof of Ownership / Authorization
                </label>
                <textarea
                  id="ownershipProof"
                  bind:value={formData.ownershipProof}
                  rows="3"
                  class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Describe how you can prove your connection to this business (business license, utility bill, etc.)..."
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Submit -->
          <div class="flex gap-4 pt-4">
            <a
              href="/shops/{shop.id}"
              class="flex-1 px-6 py-3 border rounded-lg text-center hover:bg-gray-50 transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting}
              class="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Claim'}
            </button>
          </div>
        </form>
      {/if}
    {/if}
  {/if}
</main>
