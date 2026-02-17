<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	let activeTab = data.tab || 'stats';
	let actionLoading = '';

	async function deleteMessage(messageId: number) {
		if (!confirm('Delete this message?')) return;
		actionLoading = `delete-${messageId}`;
		try {
			const res = await fetch('/api/admin/forum', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'deleteMessage', messageId }),
			});
			if (res.ok) {
				data.recentMessages = data.recentMessages.filter(m => m.id !== messageId);
			}
		} finally {
			actionLoading = '';
		}
	}

	async function pinMessage(messageId: number, pinned: boolean) {
		actionLoading = `pin-${messageId}`;
		try {
			const res = await fetch('/api/admin/forum', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'pinMessage', messageId, pinned }),
			});
			if (res.ok) {
				const msg = data.recentMessages.find(m => m.id === messageId);
				if (msg) msg.isPinned = pinned;
				data.recentMessages = data.recentMessages;
			}
		} finally {
			actionLoading = '';
		}
	}

	async function banUser(userId: number) {
		if (!confirm('Ban this user? They will lose access to all channels.')) return;
		actionLoading = `ban-${userId}`;
		try {
			await fetch('/api/admin/forum', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'banUser', userId }),
			});
			const member = data.members.find(m => m.userId === userId);
			if (member) member.userStatus = 'banned';
			data.members = data.members;
		} finally {
			actionLoading = '';
		}
	}

	async function archiveChannel(channelId: number, archived: boolean) {
		actionLoading = `archive-${channelId}`;
		try {
			const res = await fetch('/api/admin/forum', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'archiveChannel', channelId, archived }),
			});
			if (res.ok) {
				const ch = data.channels.find(c => c.id === channelId);
				if (ch) ch.isArchived = archived;
				data.channels = data.channels;
			}
		} finally {
			actionLoading = '';
		}
	}

	function formatDate(dateStr: string | Date | null): string {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleString();
	}

	function truncate(text: string, len: number): string {
		return text.length > len ? text.substring(0, len) + '...' : text;
	}
</script>

<svelte:head>
	<title>Forum Moderation - Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Forum Moderation</h1>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
		<div class="bg-white rounded-lg border p-4">
			<div class="text-sm text-gray-500">Channels</div>
			<div class="text-2xl font-bold text-gray-900">{data.stats.channels}</div>
		</div>
		<div class="bg-white rounded-lg border p-4">
			<div class="text-sm text-gray-500">Messages</div>
			<div class="text-2xl font-bold text-gray-900">{data.stats.messages}</div>
		</div>
		<div class="bg-white rounded-lg border p-4">
			<div class="text-sm text-gray-500">Members</div>
			<div class="text-2xl font-bold text-gray-900">{data.stats.members}</div>
		</div>
		<div class="bg-white rounded-lg border p-4">
			<div class="text-sm text-gray-500">Active Today</div>
			<div class="text-2xl font-bold text-purple-600">{data.stats.activeToday}</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="border-b">
		<div class="flex gap-4">
			{#each ['members', 'messages', 'channels'] as tab}
				<button
					on:click={() => (activeTab = tab)}
					class="pb-3 px-1 text-sm font-medium border-b-2 transition-colors {activeTab === tab
						? 'border-purple-600 text-purple-600'
						: 'border-transparent text-gray-500 hover:text-gray-700'}"
				>
					{tab.charAt(0).toUpperCase() + tab.slice(1)}
				</button>
			{/each}
		</div>
	</div>

	<!-- Members Tab -->
	{#if activeTab === 'members'}
		<div class="bg-white rounded-lg border overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shop</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each data.members as member}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									{#if member.avatarUrl}
										<img src={member.avatarUrl} alt="" class="w-8 h-8 rounded-full" />
									{:else}
										<div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-medium">
											{member.username.charAt(0).toUpperCase()}
										</div>
									{/if}
									<div>
										<div class="font-medium text-gray-900">{member.username}</div>
										<div class="text-xs text-gray-500">{member.email}</div>
									</div>
								</div>
							</td>
							<td class="px-4 py-3 text-sm text-gray-700">{member.shopName}</td>
							<td class="px-4 py-3">
								<span class="px-2 py-0.5 text-xs rounded-full {member.shopRole === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}">
									{member.shopRole}
								</span>
							</td>
							<td class="px-4 py-3">
								<span class="px-2 py-0.5 text-xs rounded-full {member.userStatus === 'active' ? 'bg-green-100 text-green-700' : member.userStatus === 'banned' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}">
									{member.userStatus}
								</span>
							</td>
							<td class="px-4 py-3 text-sm text-gray-500">{formatDate(member.joinedAt)}</td>
							<td class="px-4 py-3 text-right">
								{#if member.userStatus !== 'banned'}
									<button
										on:click={() => banUser(member.userId)}
										disabled={actionLoading === `ban-${member.userId}`}
										class="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
									>
										Ban
									</button>
								{:else}
									<span class="text-gray-400 text-sm">Banned</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if data.members.length === 0}
				<div class="p-8 text-center text-gray-500">No forum members found</div>
			{/if}
		</div>
	{/if}

	<!-- Messages Tab -->
	{#if activeTab === 'messages'}
		<div class="bg-white rounded-lg border overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each data.recentMessages as msg}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 text-sm font-medium text-gray-900">{msg.username}</td>
							<td class="px-4 py-3">
								<a href="/communication/{msg.channelId}" class="text-sm text-purple-600 hover:underline">
									{msg.channelName}
								</a>
							</td>
							<td class="px-4 py-3 text-sm text-gray-700 max-w-md truncate">
								{#if msg.isPinned}
									<span class="text-yellow-600 mr-1">Pinned</span>
								{/if}
								{truncate(msg.content, 100)}
							</td>
							<td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(msg.createdAt)}</td>
							<td class="px-4 py-3 text-right space-x-2 whitespace-nowrap">
								<button
									on:click={() => pinMessage(msg.id, !msg.isPinned)}
									disabled={actionLoading === `pin-${msg.id}`}
									class="text-sm {msg.isPinned ? 'text-yellow-600' : 'text-gray-500'} hover:text-yellow-700 disabled:opacity-50"
								>
									{msg.isPinned ? 'Unpin' : 'Pin'}
								</button>
								<button
									on:click={() => deleteMessage(msg.id)}
									disabled={actionLoading === `delete-${msg.id}`}
									class="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
								>
									Delete
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if data.recentMessages.length === 0}
				<div class="p-8 text-center text-gray-500">No messages found</div>
			{/if}
		</div>
	{/if}

	<!-- Channels Tab -->
	{#if activeTab === 'channels'}
		<div class="bg-white rounded-lg border overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Messages</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each data.channels as channel}
						<tr class="hover:bg-gray-50 {channel.isArchived ? 'opacity-50' : ''}">
							<td class="px-4 py-3">
								<a href="/communication/{channel.id}" class="font-medium text-purple-600 hover:underline">
									{channel.name}
								</a>
								{#if channel.isArchived}
									<span class="ml-1 text-xs text-gray-400">(archived)</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<span class="px-2 py-0.5 text-xs rounded-full {
									channel.type === 'public' ? 'bg-green-100 text-green-700' :
									channel.type === 'private' ? 'bg-gray-100 text-gray-700' :
									channel.type === 'announcement' ? 'bg-blue-100 text-blue-700' :
									'bg-purple-100 text-purple-700'
								}">
									{channel.type}
								</span>
							</td>
							<td class="px-4 py-3 text-sm text-gray-700">{channel.messageCount}</td>
							<td class="px-4 py-3 text-sm text-gray-700">{channel.participantCount}</td>
							<td class="px-4 py-3 text-sm text-gray-500">{formatDate(channel.lastActivityAt)}</td>
							<td class="px-4 py-3 text-right">
								<button
									on:click={() => archiveChannel(channel.id, !channel.isArchived)}
									disabled={actionLoading === `archive-${channel.id}`}
									class="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
								>
									{channel.isArchived ? 'Unarchive' : 'Archive'}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if data.channels.length === 0}
				<div class="p-8 text-center text-gray-500">No channels found</div>
			{/if}
		</div>
	{/if}
</div>
