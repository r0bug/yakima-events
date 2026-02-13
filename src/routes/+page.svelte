<script lang="ts">
  import Calendar from '$components/Calendar.svelte';
  import Toast from '$components/Toast.svelte';

  let toastMessage = '';
  let toastType: 'success' | 'error' = 'success';
  let showToast = false;

  function handleToast(event: CustomEvent<{ message: string; type: 'success' | 'error' }>) {
    toastMessage = event.detail.message;
    toastType = event.detail.type;
    showToast = true;
    setTimeout(() => (showToast = false), 5000);
  }
</script>

<svelte:head>
  <title>Yakima Events Calendar</title>
  <meta name="description" content="Discover local events and shops in Yakima, WA" />
</svelte:head>

<main class="flex-1">
  <Calendar on:toast={handleToast} />
</main>

{#if showToast}
  <Toast message={toastMessage} type={toastType} on:close={() => (showToast = false)} />
{/if}
