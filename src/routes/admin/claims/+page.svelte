<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  interface ClaimRequest {
    id: number;
    shopId: number | null;
    businessName: string;
    businessAddress: string | null;
    requesterName: string;
    requesterEmail: string;
    requesterPhone: string | null;
    relationshipToBusiness: string | null;
    ownershipProof: string | null;
    status: 'pending' | 'approved' | 'rejected' | null;
    adminNotes: string | null;
    createdAt: string;
    reviewedAt: string | null;
    reviewedBy: string | null;
    shop?: {
      id: number;
      name: string;
      address: string;
    };
  }

  let claims: ClaimRequest[] = [];
  let loading = true;
  let error: string | null = null;
  let statusFilter = 'pending';

  // Modal state
  let showModal = false;
  let selectedClaim: ClaimRequest | null = null;
  let modalAction: 'approve' | 'reject' | null = null;
  let adminNotes = '';
  let processing = false;

  async function loadClaims() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/claims?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load claims');
      }

      const data = await res.json();
      claims = data.claims || [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load claims';
    } finally {
      loading = false;
    }
  }

  function openModal(claim: ClaimRequest, action: 'approve' | 'reject') {
    selectedClaim = claim;
    modalAction = action;
    adminNotes = '';
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedClaim = null;
    modalAction = null;
    adminNotes = '';
  }

  async function processClaim() {
    if (!selectedClaim || !modalAction) return;

    if (modalAction === 'reject' && !adminNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    processing = true;

    try {
      const res = await fetch(`/api/admin/claims/${selectedClaim.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modalAction,
          notes: modalAction === 'approve' ? adminNotes : undefined,
          reason: modalAction === 'reject' ? adminNotes : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process claim');
      }

      closeModal();
      await loadClaims();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to process claim');
    } finally {
      processing = false;
    }
  }

  function formatRelationship(relationship: string | null): string {
    const relationships: Record<string, string> = {
      owner: 'Owner',
      manager: 'Manager',
      employee: 'Authorized Employee',
      representative: 'Authorized Representative',
    };
    return relationship ? (relationships[relationship] || relationship) : 'Not specified';
  }

  $: if (statusFilter !== undefined) {
    loadClaims();
  }

  onMount(() => {
    if (!data.user) {
      goto('/login?return=/admin/claims');
    }
  });
</script>

<svelte:head>
  <title>Manage Claims - Admin - Yakima</title>
</svelte:head>

<main class="container mx-auto px-4 py-8">
  <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Shop Claims</h1>
      <p class="text-gray-600">Review and manage shop ownership claims</p>
    </div>

    <div class="flex items-center gap-2">
      <label for="status" class="text-sm font-medium text-gray-700">Filter:</label>
      <select
        id="status"
        bind:value={statusFilter}
        class="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
      >
        <option value="">All</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {error}
    </div>
  {:else if claims.length === 0}
    <div class="bg-white rounded-lg border p-12 text-center">
      <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-500">No {statusFilter || ''} claims to review</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each claims as claim}
        <div class="bg-white rounded-lg border overflow-hidden">
          <div class="p-6">
            <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">{claim.shop.name}</h3>
                <p class="text-sm text-gray-600">{claim.shop.address}</p>
              </div>
              <span class="px-3 py-1 rounded-full text-sm font-medium {
                claim.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                claim.status === 'approved' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }">
                {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h4 class="text-sm font-medium text-gray-500 mb-1">Requester</h4>
                <p class="text-gray-900">{claim.requesterName}</p>
                <p class="text-sm text-gray-600">{claim.requesterEmail}</p>
                {#if claim.requesterPhone}
                  <p class="text-sm text-gray-600">{claim.requesterPhone}</p>
                {/if}
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-500 mb-1">Relationship</h4>
                <p class="text-gray-900">{formatRelationship(claim.relationshipToBusiness)}</p>
              </div>
            </div>

            <div class="mb-4">
              <h4 class="text-sm font-medium text-gray-500 mb-1">Proof / Notes</h4>
              <p class="text-gray-900">{claim.ownershipProof || 'None provided'}</p>
            </div>

            <div class="flex items-center justify-between text-sm text-gray-500">
              <span>Submitted {new Date(claim.createdAt).toLocaleDateString()}</span>
              {#if claim.reviewedAt}
                <span>Reviewed {new Date(claim.reviewedAt).toLocaleDateString()}</span>
              {/if}
            </div>

            {#if claim.status !== 'pending' && claim.adminNotes}
              <div class="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 class="text-sm font-medium text-gray-700 mb-1">Admin Notes</h4>
                <p class="text-sm text-gray-600">{claim.adminNotes}</p>
              </div>
            {/if}
          </div>

          {#if claim.status === 'pending'}
            <div class="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
              <button
                on:click={() => openModal(claim, 'reject')}
                class="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Reject
              </button>
              <button
                on:click={() => openModal(claim, 'approve')}
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Modal -->
  {#if showModal && selectedClaim}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">
          {modalAction === 'approve' ? 'Approve' : 'Reject'} Claim
        </h2>

        <p class="text-gray-600 mb-4">
          {#if modalAction === 'approve'}
            Approving this claim will add <strong>{selectedClaim.ownerName}</strong> as an admin for <strong>{selectedClaim.shop.name}</strong>.
          {:else}
            Please provide a reason for rejecting this claim. This will be visible to the claimant.
          {/if}
        </p>

        <div class="mb-6">
          <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">
            {modalAction === 'approve' ? 'Notes (optional)' : 'Reason for Rejection *'}
          </label>
          <textarea
            id="notes"
            bind:value={adminNotes}
            rows="3"
            required={modalAction === 'reject'}
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder={modalAction === 'approve' ? 'Add any notes...' : 'Explain why the claim is being rejected...'}
          ></textarea>
        </div>

        <div class="flex gap-3">
          <button
            on:click={closeModal}
            class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={processClaim}
            disabled={processing}
            class="flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 {
              modalAction === 'approve'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }"
          >
            {processing ? 'Processing...' : modalAction === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>
