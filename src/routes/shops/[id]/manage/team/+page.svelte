<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  interface StaffMember {
    id: number;
    userId: number;
    role: 'admin' | 'staff';
    permissions: {
      canEditShop: boolean;
      canCreateEvents: boolean;
      canPostDiscussions: boolean;
      canManageStaff: boolean;
    };
    user: {
      id: number;
      username: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
    };
    acceptedAt: string | null;
    createdAt: string;
  }

  interface PendingInvite {
    id: number;
    email: string;
    role: 'admin' | 'staff';
    permissions: {
      canEditShop: boolean;
      canCreateEvents: boolean;
      canPostDiscussions: boolean;
      canManageStaff: boolean;
    };
    invitedBy: {
      id: number;
      username: string;
      email: string;
    };
    expiresAt: string;
    createdAt: string;
  }

  let shopId: number;
  let shopName = '';
  let staff: StaffMember[] = [];
  let invites: PendingInvite[] = [];
  let loading = true;
  let error: string | null = null;

  // Invite form
  let showInviteForm = false;
  let inviteEmail = '';
  let inviteRole: 'admin' | 'staff' = 'staff';
  let invitePermissions = {
    canEditShop: true,
    canCreateEvents: true,
    canPostDiscussions: true,
    canManageStaff: false,
  };
  let inviting = false;
  let inviteError: string | null = null;
  let inviteSuccess: string | null = null;

  async function loadTeam() {
    if (!data.user) {
      goto(`/login?return=${encodeURIComponent($page.url.pathname)}`);
      return;
    }

    loading = true;
    error = null;
    shopId = parseInt($page.params.id);

    try {
      // Load shop name
      const shopRes = await fetch(`/api/shops/${shopId}`);
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        shopName = shopData.shop?.name || shopData.name || 'Shop';
      }

      // Load staff
      const staffRes = await fetch(`/api/shops/${shopId}/team`);
      if (!staffRes.ok) {
        const data = await staffRes.json();
        throw new Error(data.error || 'Failed to load team');
      }
      const staffData = await staffRes.json();
      staff = staffData.staff || [];

      // Load pending invites
      const invitesRes = await fetch(`/api/shops/${shopId}/invites`);
      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        invites = invitesData.invites || [];
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load team';
    } finally {
      loading = false;
    }
  }

  function openInviteForm() {
    showInviteForm = true;
    inviteEmail = '';
    inviteRole = 'staff';
    invitePermissions = {
      canEditShop: true,
      canCreateEvents: true,
      canPostDiscussions: true,
      canManageStaff: false,
    };
    inviteError = null;
    inviteSuccess = null;
  }

  async function sendInvite() {
    inviting = true;
    inviteError = null;
    inviteSuccess = null;

    try {
      const res = await fetch(`/api/shops/${shopId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          permissions: invitePermissions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invite');
      }

      inviteSuccess = `Invitation sent to ${inviteEmail}`;
      inviteEmail = '';

      // Reload invites
      const invitesRes = await fetch(`/api/shops/${shopId}/invites`);
      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        invites = invitesData.invites || [];
      }
    } catch (e) {
      inviteError = e instanceof Error ? e.message : 'Failed to send invite';
    } finally {
      inviting = false;
    }
  }

  async function cancelInvite(inviteId: number) {
    if (!confirm('Cancel this invitation?')) return;

    try {
      const res = await fetch(`/api/shops/${shopId}/invites/${inviteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel invite');
      }

      invites = invites.filter(i => i.id !== inviteId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel invite');
    }
  }

  async function removeMember(userId: number, username: string) {
    if (!confirm(`Remove ${username} from the team?`)) return;

    try {
      const res = await fetch(`/api/shops/${shopId}/team/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      staff = staff.filter(s => s.userId !== userId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove member');
    }
  }

  async function updateMemberRole(member: StaffMember, newRole: 'admin' | 'staff') {
    try {
      const res = await fetch(`/api/shops/${shopId}/team/${member.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole,
          permissions: {
            ...member.permissions,
            canManageStaff: newRole === 'admin',
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update role');
      }

      // Refresh team
      await loadTeam();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update role');
    }
  }

  $: if (inviteRole === 'admin') {
    invitePermissions.canManageStaff = true;
  }

  onMount(loadTeam);
</script>

<svelte:head>
  <title>Team - {shopName} - Yakima</title>
</svelte:head>

<main class="container mx-auto px-4 py-8 max-w-4xl">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
      {error}
    </div>
    <a href="/shops" class="text-purple-600 hover:underline">← Back to shops</a>
  {:else}
    <!-- Breadcrumb -->
    <nav class="mb-6 text-sm">
      <a href="/shops/{shopId}/manage" class="text-purple-600 hover:underline">← Back to Dashboard</a>
    </nav>

    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Team Management</h1>
        <p class="text-gray-600">{shopName}</p>
      </div>
      <button
        on:click={openInviteForm}
        class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        + Invite Member
      </button>
    </div>

    <!-- Invite Form Modal -->
    {#if showInviteForm}
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg max-w-md w-full p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Invite Team Member</h2>

          {#if inviteError}
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {inviteError}
            </div>
          {/if}

          {#if inviteSuccess}
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
              {inviteSuccess}
            </div>
          {/if}

          <form on:submit|preventDefault={sendInvite} class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                id="email"
                bind:value={inviteEmail}
                required
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="colleague@example.com"
              />
            </div>

            <div>
              <label for="role" class="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                id="role"
                bind:value={inviteRole}
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="staff">Staff Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
              <div class="space-y-2">
                <label class="flex items-center gap-2">
                  <input type="checkbox" bind:checked={invitePermissions.canEditShop} class="rounded" />
                  <span class="text-sm">Can edit shop profile</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" bind:checked={invitePermissions.canCreateEvents} class="rounded" />
                  <span class="text-sm">Can create events</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" bind:checked={invitePermissions.canPostDiscussions} class="rounded" />
                  <span class="text-sm">Can post discussions</span>
                </label>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={invitePermissions.canManageStaff}
                    disabled={inviteRole === 'admin'}
                    class="rounded"
                  />
                  <span class="text-sm">Can manage team members</span>
                </label>
              </div>
            </div>

            <div class="flex gap-3 pt-4">
              <button
                type="button"
                on:click={() => showInviteForm = false}
                class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviting}
                class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}

    <!-- Current Team -->
    <div class="bg-white rounded-lg border mb-8">
      <div class="px-6 py-4 border-b">
        <h2 class="text-lg font-semibold text-gray-900">Team Members ({staff.length})</h2>
      </div>
      {#if staff.length === 0}
        <div class="p-6 text-center text-gray-500">
          No team members yet. Invite someone to get started!
        </div>
      {:else}
        <div class="divide-y">
          {#each staff as member}
            <div class="p-4 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                {#if member.user.avatarUrl}
                  <img
                    src={member.user.avatarUrl}
                    alt={member.user.username}
                    class="w-10 h-10 rounded-full"
                  />
                {:else}
                  <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                    {member.user.username.charAt(0).toUpperCase()}
                  </div>
                {/if}
                <div>
                  <div class="font-medium text-gray-900">
                    {member.user.firstName && member.user.lastName
                      ? `${member.user.firstName} ${member.user.lastName}`
                      : member.user.username}
                  </div>
                  <div class="text-sm text-gray-500">{member.user.email}</div>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <select
                  value={member.role}
                  on:change={(e) => updateMemberRole(member, e.currentTarget.value as 'admin' | 'staff')}
                  class="px-3 py-1 border rounded-lg text-sm {member.role === 'admin' ? 'bg-purple-50' : 'bg-gray-50'}"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>

                {#if member.userId !== data.user?.id}
                  <button
                    on:click={() => removeMember(member.userId, member.user.username)}
                    class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove member"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                {:else}
                  <span class="text-sm text-gray-400 px-2">You</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Pending Invitations -->
    {#if invites.length > 0}
      <div class="bg-white rounded-lg border">
        <div class="px-6 py-4 border-b">
          <h2 class="text-lg font-semibold text-gray-900">Pending Invitations ({invites.length})</h2>
        </div>
        <div class="divide-y">
          {#each invites as invite}
            <div class="p-4 flex items-center justify-between gap-4">
              <div>
                <div class="font-medium text-gray-900">{invite.email}</div>
                <div class="text-sm text-gray-500">
                  Invited by {invite.invitedBy.username} · Expires {new Date(invite.expiresAt).toLocaleDateString()}
                </div>
              </div>

              <div class="flex items-center gap-3">
                <span class="px-2 py-1 rounded text-xs font-medium {invite.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">
                  {invite.role}
                </span>
                <button
                  on:click={() => cancelInvite(invite.id)}
                  class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cancel invite"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</main>
