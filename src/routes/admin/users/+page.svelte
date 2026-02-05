<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';

  export let data: PageData;

  let search = data.filters.search;

  function handleSearch() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (data.filters.role !== 'all') params.set('role', data.filters.role);
    goto(`/admin/users?${params.toString()}`);
  }

  function setRoleFilter(role: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (role !== 'all') params.set('role', role);
    goto(`/admin/users?${params.toString()}`);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getRoleBadges(user: typeof data.users[0]): { label: string; class: string }[] {
    const badges = [];

    if (user.role === 'admin') {
      badges.push({ label: 'Admin', class: 'bg-red-100 text-red-700' });
    } else if (user.role === 'moderator') {
      badges.push({ label: 'Mod', class: 'bg-orange-100 text-orange-700' });
    }

    if (user.isBusinessOwner) {
      badges.push({ label: 'Business Owner', class: 'bg-blue-100 text-blue-700' });
    }

    if (user.isYfStaff) {
      badges.push({ label: 'YF Staff', class: 'bg-purple-100 text-purple-700' });
    }

    if (user.isYfVendor) {
      badges.push({ label: 'Vendor', class: 'bg-green-100 text-green-700' });
    }

    return badges;
  }
</script>

<svelte:head>
  <title>Users - Admin</title>
</svelte:head>

<div>
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Users</h1>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-purple-600">{data.pagination.totalCount}</div>
      <div class="text-gray-500 text-sm">Total Users</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-red-600">{data.counts.admins}</div>
      <div class="text-gray-500 text-sm">Admins</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-blue-600">{data.counts.businessOwners}</div>
      <div class="text-gray-500 text-sm">Business Owners</div>
    </div>
    <div class="bg-white rounded-lg shadow p-4">
      <div class="text-2xl font-bold text-purple-600">{data.counts.yfStaff}</div>
      <div class="text-gray-500 text-sm">YF Staff</div>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <div class="flex flex-col md:flex-row gap-4">
      <form on:submit|preventDefault={handleSearch} class="flex-1 flex gap-2">
        <input
          type="text"
          bind:value={search}
          placeholder="Search by username or email..."
          class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
        <button
          type="submit"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Search
        </button>
      </form>

      <div class="flex flex-wrap gap-2">
        <button
          on:click={() => setRoleFilter('all')}
          class="px-4 py-2 rounded-lg {data.filters.role === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          All
        </button>
        <button
          on:click={() => setRoleFilter('admin')}
          class="px-4 py-2 rounded-lg {data.filters.role === 'admin' ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          Admins
        </button>
        <button
          on:click={() => setRoleFilter('business_owner')}
          class="px-4 py-2 rounded-lg {data.filters.role === 'business_owner' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          Business Owners
        </button>
        <button
          on:click={() => setRoleFilter('yf_staff')}
          class="px-4 py-2 rounded-lg {data.filters.role === 'yf_staff' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
        >
          YF Staff
        </button>
      </div>
    </div>
  </div>

  <!-- Users List -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    {#if data.users.length === 0}
      <div class="p-8 text-center text-gray-500">
        No users found.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">User</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Roles</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Last Login</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-gray-500">Joined</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            {#each data.users as user}
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    {#if user.avatarUrl}
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        class="w-10 h-10 rounded-full object-cover"
                      />
                    {:else}
                      <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    {/if}
                    <div class="font-medium text-gray-900">{user.username}</div>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {user.email}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    {#each getRoleBadges(user) as badge}
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium {badge.class}">
                        {badge.label}
                      </span>
                    {/each}
                    {#if getRoleBadges(user).length === 0}
                      <span class="text-gray-400 text-sm">User</span>
                    {/if}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-full text-xs font-medium
                    {user.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                    {user.status === 'inactive' ? 'bg-gray-100 text-gray-700' : ''}
                    {user.status === 'banned' ? 'bg-red-100 text-red-700' : ''}
                  ">
                    {user.status}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {formatDate(user.lastLogin)}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {formatDate(user.createdAt)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if data.pagination.totalPages > 1}
        <div class="border-t px-4 py-3 flex items-center justify-between">
          <div class="text-sm text-gray-500">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </div>
          <div class="flex gap-2">
            {#if data.pagination.page > 1}
              <a
                href="/admin/users?page={data.pagination.page - 1}&role={data.filters.role}&search={data.filters.search}"
                class="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Previous
              </a>
            {/if}
            {#if data.pagination.page < data.pagination.totalPages}
              <a
                href="/admin/users?page={data.pagination.page + 1}&role={data.filters.role}&search={data.filters.search}"
                class="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Next
              </a>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
