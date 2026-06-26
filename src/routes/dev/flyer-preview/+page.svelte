<script lang="ts">
  import { dev } from '$app/environment';
  import { error } from '@sveltejs/kit';
  import FlyerVintageGuide from '$lib/components/flyer/FlyerVintageGuide.svelte';
  import { applyConfigDefaults } from '$lib/types/junk-run';
  import type { FlyerShop } from '$lib/types/junk-run';
  import type { MarkerPosition } from '$lib/components/flyer/flyer-utils';

  if (!dev) throw error(404, 'Not found');

  const config = applyConfigDefaults({
    slug: 'vintiques', name: 'Vintiques Junk Run',
    tagline: 'Yakima Valley Antique & Vintage Shop Guide',
    headerHtml: '<em>Presented by</em> Yakima Finds',
    footerHtml: 'yakimafinds.com | #VintiquesJunkRun',
    flyer: { template: 'vintage-guide', showPhoneNumbers: true, showHours: false, qrMode: 'route', showSaleBadges: true, showCategoryLegend: true, maxShopsPerPage: 15, fontSize: 'normal', columnCount: 'auto' },
  });

  const cat = (name: string, color: string) => ({ name, color, slug: name.toLowerCase() });
  const mk = (id: number, name: string, region: string, c: { name: string; color: string; slug: string }): FlyerShop =>
    ({ id, name, address: `${100 + id} Main St, ${region}, WA`, phone: '(509) 555-0' + (100 + id), latitude: 46.6, longitude: -120.5, operatingHours: null, description: null, region, category: c });

  const ANT = cat('Antique', '#b7410e'), CHA = cat('Charity', '#2b6e6a'), SPE = cat('Specialty', '#9c6b3f');
  const shops: FlyerShop[] = [
    mk(1, 'Vintage Me', 'yakima', ANT), mk(2, "Yesterday’s Village", 'yakima', ANT),
    mk(3, 'Sideshow Antiques', 'yakima', ANT), mk(4, 'Olive Branch Thrift Shop', 'yakima', CHA),
    mk(5, "Churchill’s Booklovers’ Haunt", 'yakima', SPE), mk(6, "Granny’s Attic", 'uniongap', CHA),
    mk(7, 'Country Garden Antiques', 'wapato', ANT), mk(8, 'Trinket Box Antiques', 'selah', ANT),
  ];
  const markerPositions: MarkerPosition[] = shops.map((shop, i) => ({ shop, num: i + 1, x: 80 + (i % 4) * 160, y: 90 + Math.floor(i / 4) * 200 }));
  const salesTodayIds = new Set<number>([1, 6]);
</script>

<div style="padding:20px; background:#888;">
  <FlyerVintageGuide {shops} {config} {salesTodayIds} mapImageUrl="/og-default.png" {markerPositions} areaLabel="All Areas" />
</div>
