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
  <title>Yakima Events Calendar - What's Happening in the Valley</title>
  <meta name="description" content="Discover local events, community happenings, and things to do in the Yakima Valley" />
</svelte:head>

<main class="flex-1">
  <!-- Hero Section -->
  <section class="relative bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 text-white overflow-hidden">
    <div class="absolute inset-0 opacity-10">
      <div class="absolute inset-0" style="background-image: radial-gradient(circle at 20% 50%, rgba(251, 191, 36, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(234, 88, 12, 0.2) 0%, transparent 40%), radial-gradient(circle at 50% 80%, rgba(120, 53, 15, 0.3) 0%, transparent 45%);"></div>
    </div>
    <div class="max-w-7xl mx-auto px-4 py-12 md:py-16 relative z-10">
      <div class="text-center max-w-3xl mx-auto">
        <h1 class="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-4">
          What's Happening in
          <span class="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Yakima</span>
        </h1>
        <p class="text-lg md:text-xl text-stone-300 leading-relaxed max-w-2xl mx-auto">
          Your community calendar for events, markets, live music, and everything happening across the Yakima Valley.
        </p>
        <div class="flex items-center justify-center gap-4 mt-8">
          <a href="/events/submit" class="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-semibold shadow-lg shadow-amber-900/30 transition-all hover:shadow-xl hover:shadow-amber-900/40">
            Submit an Event
          </a>
          <a href="/shops" class="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-semibold transition-all">
            Browse Shops
          </a>
        </div>
      </div>
    </div>
    <!-- Wave divider -->
    <div class="absolute bottom-0 left-0 right-0">
      <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full" preserveAspectRatio="none">
        <path d="M0 60L48 52C96 44 192 28 288 22C384 16 480 20 576 28C672 36 768 48 864 50C960 52 1056 44 1152 36C1248 28 1344 20 1392 16L1440 12V60H1392C1344 60 1248 60 1152 60C1056 60 960 60 864 60C768 60 672 60 576 60C480 60 384 60 288 60C192 60 96 60 48 60H0Z" class="fill-warm-50"/>
      </svg>
    </div>
  </section>

  <!-- Calendar -->
  <Calendar on:toast={handleToast} />
</main>

{#if showToast}
  <Toast message={toastMessage} type={toastType} on:close={() => (showToast = false)} />
{/if}
