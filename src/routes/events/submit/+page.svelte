<script lang="ts">
  let formData = {
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    address: '',
    externalUrl: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    category: '',
  };

  let categories: { id: number; name: string; slug: string }[] = [];
  let loading = false;
  let submitted = false;
  let error: string | null = null;

  async function loadCategories() {
    try {
      const res = await fetch('/api/events/categories');
      if (res.ok) {
        const data = await res.json();
        categories = data.categories || data;
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    error = null;

    try {
      // Combine date and time
      const startDatetime = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
      let endDatetime = null;
      if (formData.endDate && formData.endTime) {
        endDatetime = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();
      }

      const contactInfo = {
        name: formData.contactName || null,
        email: formData.contactEmail || null,
        phone: formData.contactPhone || null,
      };

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          location: formData.location || null,
          address: formData.address || null,
          external_url: formData.externalUrl || null,
          contact_info: Object.values(contactInfo).some(v => v) ? contactInfo : null,
          category_id: formData.category ? parseInt(formData.category) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit event');
      }

      submitted = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to submit event';
    } finally {
      loading = false;
    }
  }

  import { onMount } from 'svelte';
  onMount(loadCategories);
</script>

<svelte:head>
  <title>Submit Event - Yakima</title>
</svelte:head>

<main class="container mx-auto px-4 py-8 max-w-2xl">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Submit an Event</h1>
    <p class="text-gray-600">Share your event with the Yakima community</p>
  </div>

  {#if submitted}
    <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
      <svg class="mx-auto h-12 w-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h2 class="text-xl font-semibold text-green-900 mb-2">Event Submitted!</h2>
      <p class="text-green-700 mb-4">Your event has been submitted and is pending approval.</p>
      <div class="flex gap-4 justify-center">
        <a href="/calendar" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          View Calendar
        </a>
        <button
          class="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
          on:click={() => { submitted = false; formData = { title: '', description: '', startDate: '', startTime: '', endDate: '', endTime: '', location: '', address: '', externalUrl: '', contactName: '', contactEmail: '', contactPhone: '', category: '' }; }}
        >
          Submit Another
        </button>
      </div>
    </div>
  {:else}
    {#if error}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
        {error}
      </div>
    {/if}

    <form on:submit={handleSubmit} class="bg-white rounded-lg border p-6 space-y-6">
      <!-- Event Title -->
      <div>
        <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
          Event Title <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          bind:value={formData.title}
          required
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter event title"
        />
      </div>

      <!-- Category -->
      <div>
        <label for="category" class="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          id="category"
          bind:value={formData.category}
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Select a category</option>
          {#each categories as category}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
      </div>

      <!-- Description -->
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          bind:value={formData.description}
          rows="4"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Describe your event"
        ></textarea>
      </div>

      <!-- Date & Time -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
            Start Date <span class="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="startDate"
            bind:value={formData.startDate}
            required
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label for="startTime" class="block text-sm font-medium text-gray-700 mb-1">
            Start Time <span class="text-red-500">*</span>
          </label>
          <input
            type="time"
            id="startTime"
            bind:value={formData.startTime}
            required
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            bind:value={formData.endDate}
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label for="endTime" class="block text-sm font-medium text-gray-700 mb-1">
            End Time
          </label>
          <input
            type="time"
            id="endTime"
            bind:value={formData.endTime}
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <!-- Location -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="location" class="block text-sm font-medium text-gray-700 mb-1">
            Venue Name
          </label>
          <input
            type="text"
            id="location"
            bind:value={formData.location}
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="e.g., Capitol Theatre"
          />
        </div>
        <div>
          <label for="address" class="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            type="text"
            id="address"
            bind:value={formData.address}
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="123 Main St, Yakima, WA"
          />
        </div>
      </div>

      <!-- External URL -->
      <div>
        <label for="externalUrl" class="block text-sm font-medium text-gray-700 mb-1">
          Event Website/Link
        </label>
        <input
          type="url"
          id="externalUrl"
          bind:value={formData.externalUrl}
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          placeholder="https://..."
        />
      </div>

      <!-- Contact Info -->
      <div class="border-t pt-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="contactName" class="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="contactName"
              bind:value={formData.contactName}
              class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label for="contactEmail" class="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="contactEmail"
              bind:value={formData.contactEmail}
              class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label for="contactPhone" class="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              id="contactPhone"
              bind:value={formData.contactPhone}
              class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="flex justify-end gap-4 pt-4">
        <a href="/calendar" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </a>
        <button
          type="submit"
          disabled={loading}
          class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if loading}
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          {:else}
            Submit Event
          {/if}
        </button>
      </div>
    </form>
  {/if}
</main>
