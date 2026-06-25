# Vintiques Junk Run — Vintage-Guide Flyer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new rustic flea-market / "kraft" flyer template (`vintage-guide`) to the Junk Run flyer system and make Vintiques use it, giving the printable flyer a cohesive antique-guide look with a region-grouped ledger directory.

**Architecture:** The flyer is generated client-side: `JunkRunFlyer.svelte` captures a Leaflet map to a PNG + numbered pin positions, then renders one of several US-Letter templates. We add `vintage-guide` as a **new, additive** template (existing `map-focus` / `directory-focus` / `postcard` untouched) made of three new presentational Svelte components plus one new pure helper. Vintiques opts in via its config JSON; rollback is a one-line config flip.

**Tech Stack:** SvelteKit (Svelte 4 syntax), TypeScript, `qrcode-svg`, Leaflet (already wired), vitest + jsdom (unit tests), svelte-check (type gate). Fonts via Google Fonts `<link>` in `src/app.html`.

## Global Constraints

- **Page geometry is fixed by the capture pipeline:** the new template MUST render its map image at exactly **MAP_W = 768px** (`816 − MARGIN*2`, MARGIN=24) by **MAP_H = 620px**, because `JunkRunFlyer.svelte` captures the offscreen map at those dimensions for every non-`postcard`/non-`directory-focus` template. Page is **816 × 1056 px** (US Letter @ 96dpi).
- **Pin ↔ list numbering must match:** a shop's number on the map equals its index in the `shops` prop + 1 (`markerPositions[i].num = i + 1`). The region-grouped directory reorders shops, so it MUST look numbers up by shop id from the original `shops` order — never renumber per group.
- **Print correctness:** `.flyer-page` already carries `print-color-adjust: exact` globally (set in `JunkRunFlyer.svelte`). Use solid colors / CSS gradients only — **no external image assets** for texture.
- **No new runtime dependencies.** Reuse `qrcode-svg`, `$lib/utils/geo`, and `flyer-utils`.
- **Palette (verbatim):** paper `#efe3cd`; masthead band `#b9a07c`; dark ink `#3d2a18`; secondary ink `#5a3a22`; rust `#b7410e`; gold `#c8a951`; footer band `#5a3a22`; cream text `#f3e6cf`. Category pin colors come from `shop.category.color` — do not hardcode them.
- **Vitest imports must stay alias-free at runtime:** import runtime values via **relative** paths (`../../utils/geo`), use `import type` for types. `$lib` runtime resolution is not assumed in tests.
- **Spec:** `docs/superpowers/specs/2026-06-25-vintiques-flyer-vintage-guide-design.md`.

---

### Task 1: Type foundation + `groupShopsByRegion` helper

**Files:**
- Modify: `src/lib/types/junk-run.ts:11` (extend `FlyerTemplate` union)
- Modify: `src/lib/utils/geo.ts` (add `REGION_ORDER` after `REGION_LABELS`, ~line 137)
- Modify: `src/lib/components/flyer/flyer-utils.ts` (add `groupShopsByRegion`; add relative geo import)
- Test: `src/lib/components/flyer/flyer-utils.test.ts` (new)

**Interfaces:**
- Consumes: `FlyerShop` (has `id`, `name`, `region`), `REGION_LABELS` (from geo.ts).
- Produces: `groupShopsByRegion(shops: FlyerShop[]): { region: string; label: string; shops: FlyerShop[] }[]` — groups by `shop.region`, ordered by `REGION_ORDER` (unknown regions appended alphabetically), empty/missing region treated as `'yakima'`. `REGION_ORDER: string[]`. `FlyerTemplate` now includes `'vintage-guide'`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/flyer/flyer-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupShopsByRegion } from './flyer-utils';
import type { FlyerShop } from '../../types/junk-run';

const mk = (id: number, name: string, region: string): FlyerShop => ({
  id, name, address: null, phone: null, latitude: 46.6, longitude: -120.5,
  operatingHours: null, description: null, region,
});

describe('groupShopsByRegion', () => {
  it('groups by region and orders Yakima before Union Gap', () => {
    const groups = groupShopsByRegion([mk(1, 'A', 'uniongap'), mk(2, 'B', 'yakima'), mk(3, 'C', 'yakima')]);
    expect(groups.map(g => g.region)).toEqual(['yakima', 'uniongap']);
    expect(groups[0].shops.map(s => s.id)).toEqual([2, 3]);
    expect(groups[0].label).toBe('Yakima');
    expect(groups[1].label).toBe('Union Gap');
  });

  it('treats empty region as yakima', () => {
    const groups = groupShopsByRegion([mk(1, 'A', '')]);
    expect(groups[0].region).toBe('yakima');
  });

  it('appends unknown regions alphabetically after known ones', () => {
    const groups = groupShopsByRegion([mk(1, 'A', 'zzz'), mk(2, 'B', 'aaa'), mk(3, 'C', 'yakima')]);
    expect(groups.map(g => g.region)).toEqual(['yakima', 'aaa', 'zzz']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/projects/yakima-events && npm test -- flyer-utils`
Expected: FAIL — `groupShopsByRegion is not exported` / not a function.

- [ ] **Step 3: Add `REGION_ORDER` to `src/lib/utils/geo.ts`**

Immediately after the `REGION_LABELS` object (ends ~line 137), add:

```ts
/** Display order for region groups (north/central Yakima first, then valley, then wine country) */
export const REGION_ORDER: string[] = [
  'yakima', 'uniongap', 'selah', 'naches', 'tieton',
  'wapato', 'toppenish', 'granger', 'sunnyside', 'zillah',
  'prosser', 'bentoncity',
];
```

- [ ] **Step 4: Implement `groupShopsByRegion` in `src/lib/components/flyer/flyer-utils.ts`**

At the top of the file, add a relative runtime import (keep the existing `import type … from '$lib/types/junk-run'` as-is):

```ts
import { REGION_LABELS, REGION_ORDER } from '../../utils/geo';
```

Append at the end of the file:

```ts
export function groupShopsByRegion(
  shops: FlyerShop[],
): { region: string; label: string; shops: FlyerShop[] }[] {
  const groups = new Map<string, FlyerShop[]>();
  for (const s of shops) {
    const r = s.region || 'yakima';
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(s);
  }
  const ordered: { region: string; label: string; shops: FlyerShop[] }[] = [];
  for (const r of REGION_ORDER) {
    if (groups.has(r)) {
      ordered.push({ region: r, label: REGION_LABELS[r] ?? r, shops: groups.get(r)! });
      groups.delete(r);
    }
  }
  for (const r of [...groups.keys()].sort()) {
    ordered.push({ region: r, label: REGION_LABELS[r] ?? r, shops: groups.get(r)! });
  }
  return ordered;
}
```

- [ ] **Step 5: Extend the `FlyerTemplate` union**

In `src/lib/types/junk-run.ts`, change:

```ts
export type FlyerTemplate = 'map-focus' | 'directory-focus' | 'postcard';
```

to:

```ts
export type FlyerTemplate = 'map-focus' | 'directory-focus' | 'postcard' | 'vintage-guide';
```

(Leave `DEFAULT_FLYER_OPTIONS.template` as `'map-focus'` — other junk-runs are unaffected.)

- [ ] **Step 6: Run tests + typecheck**

Run: `npm test -- flyer-utils && npm run check`
Expected: tests PASS (3 passing); svelte-check reports no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/junk-run.ts src/lib/utils/geo.ts src/lib/components/flyer/flyer-utils.ts src/lib/components/flyer/flyer-utils.test.ts
git commit -m "feat(flyer): add groupShopsByRegion helper, REGION_ORDER, vintage-guide template type"
```

---

### Task 2: Load the vintage fonts

**Files:**
- Modify: `src/app.html` (add a Google Fonts `<link>` after the existing one, ~line 10)

**Interfaces:**
- Produces: `Rye`, `Special Elite`, `Courier Prime`, `Playfair Display` available to all components (used by Tasks 3–5).

- [ ] **Step 1: Add the font link**

In `src/app.html`, directly after the existing `<link href="https://fonts.googleapis.com/css2?family=Fraunces…">` line, add:

```html
    <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Rye&family=Special+Elite&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Verify it loads**

Run: `npm run dev` then in another shell:
`curl -s http://localhost:5173/ | grep -o 'family=Rye'`
Expected: prints `family=Rye` (the link is in the served `<head>`). Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app.html
git commit -m "feat(flyer): load Rye/Special Elite/Courier Prime/Playfair fonts"
```

---

### Task 3: `FlyerHeaderVintage.svelte` (kraft masthead + Yakima Finds wordmark)

**Files:**
- Create: `src/lib/components/flyer/FlyerHeaderVintage.svelte`

**Interfaces:**
- Consumes: `JunkRunConfig` (`name`, `tagline`, `headerHtml`, `customContent.sponsorLogoUrl`, `customContent.sponsorLogoPlacement`).
- Produces: `<FlyerHeaderVintage {config} {areaLabel} height={84} />` — an absolutely-positioned masthead band of the given height.

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import type { JunkRunConfig } from '$lib/types/junk-run';

  export let config: JunkRunConfig;
  export let areaLabel: string;
  export let height: number = 84;

  const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const now = new Date();
  $: edition = `${MONTHS[now.getMonth()]} ${now.getFullYear()} · ${(areaLabel || 'All Areas').toUpperCase()}`;
</script>

<div style="position:absolute; top:0; left:0; right:0; height:{height}px; background:#b9a07c; background-image:linear-gradient(135deg,rgba(0,0,0,0.06) 25%,transparent 25%,transparent 50%,rgba(0,0,0,0.06) 50%,rgba(0,0,0,0.06) 75%,transparent 75%); background-size:7px 7px; border-bottom:2px solid #5a3a22; display:flex; flex-direction:column; align-items:center; justify-content:center;">
  <div style="position:absolute; left:12px; top:8px; font:bold 7px 'Special Elite',monospace; letter-spacing:1px; color:#5a3a22;">{edition}</div>

  <div style="position:absolute; right:12px; top:7px; text-align:right;">
    {#if config.customContent.sponsorLogoUrl && config.customContent.sponsorLogoPlacement === 'header'}
      <img src={config.customContent.sponsorLogoUrl} alt="Sponsor" style="height:22px; display:block; margin-left:auto; margin-bottom:2px;" />
    {/if}
    <div style="font:bold 7px 'Special Elite',monospace; letter-spacing:1.5px; color:#5a3a22;">&#9733; YAKIMA FINDS &#9733;</div>
    <div style="font:italic 400 6.5px 'Playfair Display',Georgia,serif; color:#6b4f33;">{@html config.headerHtml}</div>
  </div>

  <div style="display:inline-block; background:#5a3a22; color:#f3e6cf; font:bold 7px 'Special Elite',monospace; letter-spacing:2px; padding:2px 9px; transform:rotate(-1.5deg);">EST &middot; YAKIMA VALLEY</div>
  <div style="font:400 30px 'Rye','Playfair Display',serif; color:#3d2a18; line-height:1; margin:6px 0 2px; text-shadow:1px 1px 0 rgba(255,255,255,0.35);">{config.name}</div>
  <div style="font:italic 400 10px 'Playfair Display',Georgia,serif; color:#5a3a22;">{config.tagline}</div>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: no new errors. (Visual confirmation happens in Task 5 via the preview route.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/flyer/FlyerHeaderVintage.svelte
git commit -m "feat(flyer): kraft vintage masthead with Yakima Finds wordmark"
```

---

### Task 4: `FlyerFooterVintage.svelte` (kraft footer + wordmark + QR slot)

**Files:**
- Create: `src/lib/components/flyer/FlyerFooterVintage.svelte`

**Interfaces:**
- Consumes: `JunkRunConfig` (`footerHtml`, `customContent.sponsorLogoUrl/Placement`).
- Produces: `<FlyerFooterVintage {config} height={40} qrSvg={string} ctaText={string} url={string} />` — absolutely-positioned bottom band. `qrSvg` is raw SVG markup (may be `''`), `url` overrides `config.footerHtml` when provided.

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import type { JunkRunConfig } from '$lib/types/junk-run';

  export let config: JunkRunConfig;
  export let height: number = 40;
  export let qrSvg: string = '';
  export let ctaText: string = '';
  export let url: string = '';
</script>

<div style="position:absolute; bottom:0; left:0; right:0; height:{height}px; background:#5a3a22; color:#f3e6cf; display:flex; align-items:center; gap:8px; padding:0 12px;">
  {#if config.customContent.sponsorLogoUrl && config.customContent.sponsorLogoPlacement === 'footer'}
    <img src={config.customContent.sponsorLogoUrl} alt="Sponsor" style="height:20px;" />
  {/if}
  {#if qrSvg}
    <div style="width:26px; height:26px; background:white; padding:1px; flex-shrink:0; line-height:0;">{@html qrSvg}</div>
  {/if}
  {#if ctaText}
    <span style="font:italic 400 8px 'Playfair Display',serif; color:#e7cd86;">{ctaText}</span>
  {/if}
  <span style="margin-left:auto; text-align:right; line-height:1.3;">
    <span style="font:bold 7px 'Special Elite',monospace; letter-spacing:1px; color:#e7cd86;">&#9733; YAKIMA FINDS &#9733;</span><br>
    <span style="font:7px 'Courier Prime',monospace; opacity:0.85;">{@html url || config.footerHtml}</span>
  </span>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/flyer/FlyerFooterVintage.svelte
git commit -m "feat(flyer): kraft vintage footer with QR slot + wordmark"
```

---

### Task 5: `FlyerVintageGuide.svelte` (the template) + dev preview route

**Files:**
- Create: `src/lib/components/flyer/FlyerVintageGuide.svelte`
- Create: `src/routes/dev/flyer-preview/+page.svelte` (dev-only visual harness)

**Interfaces:**
- Consumes (same prop shape as `FlyerMapFocus.svelte`): `shops: FlyerShop[]`, `config: JunkRunConfig`, `salesTodayIds: Set<number>`, `mapImageUrl: string`, `markerPositions: MarkerPosition[]`, `areaLabel: string`. Uses `pinPath`, `pinLabelY`, `truncate`, `getHoursText`, `buildRouteQrUrl`, `getUniqueCategories`, `groupShopsByRegion` from `./flyer-utils`; `FlyerHeaderVintage`, `FlyerFooterVintage`; `QRCode` from `qrcode-svg`.
- Produces: `<FlyerVintageGuide … />` — one or two `.flyer-page` blocks.

- [ ] **Step 1: Create `FlyerVintageGuide.svelte`**

```svelte
<script lang="ts">
  import type { JunkRunConfig, FlyerShop } from '$lib/types/junk-run';
  import FlyerHeaderVintage from './FlyerHeaderVintage.svelte';
  import FlyerFooterVintage from './FlyerFooterVintage.svelte';
  import { pinPath, pinLabelY, truncate, getHoursText, buildRouteQrUrl, getUniqueCategories, groupShopsByRegion, type MarkerPosition } from './flyer-utils';
  import QRCode from 'qrcode-svg';

  export let shops: FlyerShop[];
  export let config: JunkRunConfig;
  export let salesTodayIds: Set<number>;
  export let mapImageUrl: string;
  export let markerPositions: MarkerPosition[] = [];
  export let areaLabel: string;

  const PAGE_W = 816;
  const PAGE_H = 1056;
  const HEADER_H = 84;
  const FOOTER_H = 40;
  const MARGIN = 24;
  const MAP_X = MARGIN;
  const MAP_Y = HEADER_H;
  const MAP_W = PAGE_W - MARGIN * 2; // 768 — must match JunkRunFlyer capture width
  const MAP_H = 620;                 // must match JunkRunFlyer capture height
  const LIST_Y = MAP_Y + MAP_H + 6;

  // Pin number == index in the original shops order + 1 (matches markerPositions)
  $: numberById = new Map(shops.map((s, i) => [s.id, i + 1] as const));
  $: groups = groupShopsByRegion(shops);
  $: categories = getUniqueCategories(shops);
  $: showLegend = config.flyer.showCategoryLegend && categories.length >= 2;

  $: routeQrSvg = config.flyer.qrMode === 'route' ? (() => {
    const url = buildRouteQrUrl(shops);
    if (!url) return '';
    return new QRCode({ content: url, padding: 0, width: 72, height: 72, ecl: 'L', join: true }).svg();
  })() : '';

  $: onlineUrl = `yfevents.yakimafinds.com/junk-run/${config.slug}`;
  $: onlineQrSvg = new QRCode({ content: `https://${onlineUrl}`, padding: 0, width: 72, height: 72, ecl: 'L', join: true }).svg();
</script>

<!-- Page 1: kraft masthead + map + region ledger (names only) -->
<div class="flyer-page" style="width:{PAGE_W}px; height:{PAGE_H}px; background:#efe3cd; background-image:linear-gradient(135deg,rgba(90,58,34,0.045) 25%,transparent 25%,transparent 50%,rgba(90,58,34,0.045) 50%,rgba(90,58,34,0.045) 75%,transparent 75%); background-size:9px 9px; position:relative; overflow:hidden; margin:0 auto; box-shadow:0 2px 20px rgba(0,0,0,0.18);">
  <FlyerHeaderVintage {config} {areaLabel} height={HEADER_H} />

  {#if mapImageUrl}
    <img src={mapImageUrl} alt="Map" style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; border:2px solid #8a6a44; border-radius:4px;" />
    <div style="position:absolute; left:{MAP_X}px; top:{MAP_Y + MAP_H - 13}px; width:{MAP_W}px; text-align:right; pointer-events:none;">
      <span style="font-size:6px; color:#5a3a22; background:rgba(243,230,207,0.85); padding:1px 5px;">&copy; OpenStreetMap contributors &copy; CARTO</span>
    </div>
  {:else}
    <div style="position:absolute; left:{MAP_X}px; top:{MAP_Y}px; width:{MAP_W}px; height:{MAP_H}px; background:#d8c39a; border:2px solid #8a6a44; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#5a3a22; font:14px 'Special Elite',monospace;">
      Map unavailable &mdash; try Generate Flyer again
    </div>
  {/if}

  <!-- numbered pins -->
  <svg style="position:absolute; top:0; left:0; width:{PAGE_W}px; height:{PAGE_H}px; pointer-events:none;" viewBox="0 0 {PAGE_W} {PAGE_H}">
    <defs>
      <filter id="pinShadowVG" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1.2" stdDeviation="1" flood-opacity="0.45" />
      </filter>
    </defs>
    {#each markerPositions as m}
      <path d={pinPath(MAP_X + m.x, MAP_Y + m.y)} fill={m.shop.category?.color || '#6b7280'} stroke="white" stroke-width="1.5" filter="url(#pinShadowVG)" />
      <text x={MAP_X + m.x} y={pinLabelY(MAP_Y + m.y) + 3.2} text-anchor="middle" fill="white" font-size="9.5" font-weight="bold" font-family="Arial, sans-serif">{m.num}</text>
    {/each}
  </svg>

  <!-- legend -->
  {#if showLegend}
    <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:{MAP_Y + MAP_H + 4}px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
      {#each categories as cat}
        <span style="display:flex; align-items:center; gap:3px; font:bold 6px 'Courier Prime',monospace; letter-spacing:0.3px; color:#5a3a22;">
          <span style="width:7px; height:7px; border-radius:50%; background:{cat.color || '#6b7280'}; display:inline-block;"></span>{cat.name.toUpperCase()}
        </span>
      {/each}
    </div>
  {/if}

  <!-- region-grouped ledger (names only) -->
  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:{LIST_Y + (showLegend ? 14 : 0)}px; bottom:{FOOTER_H + 4}px; overflow:hidden;">
    <div style="column-count:2; column-gap:16px;">
      {#each groups as g}
        <div style="break-inside:avoid; margin-bottom:6px;">
          <div style="font:bold 7.5px 'Special Elite',monospace; letter-spacing:1px; text-transform:uppercase; color:#5a3a22; border-bottom:1.5px solid #b7410e; padding-bottom:1px; margin-bottom:2px;"><span style="color:#c8a951;">&#10022;</span> {g.label}</div>
          {#each g.shops as shop, i}
            <div style="display:flex; align-items:center; gap:4px; padding:1.5px 2px; background:{i % 2 ? 'rgba(183,65,14,0.06)' : 'transparent'}; font:9px/1.2 'Playfair Display',Georgia,serif; color:#3d2a18;">
              <span style="font:bold 7px 'Courier Prime',monospace; color:#b7410e; min-width:13px;">{numberById.get(shop.id)}</span>
              <span style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{truncate(shop.name, 26)}</span>
              {#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
                <span style="font:bold 5.5px 'Special Elite',monospace; background:#b7410e; color:#fff; padding:0 2px; border-radius:1px; flex-shrink:0;">SALE</span>
              {/if}
              <span style="flex:1; border-bottom:1px dotted #a07a4a; height:6px; min-width:6px;"></span>
              <span style="font:6px 'Courier Prime',monospace; color:#7a5a36; flex-shrink:0;">{(shop.category?.name || '').toUpperCase()}</span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <FlyerFooterVintage {config} height={FOOTER_H} qrSvg={routeQrSvg} ctaText={routeQrSvg ? 'Scan for a route to every shop' : ''} />
</div>

<!-- Page 2: full directory with address/phone -->
<div class="flyer-page" style="width:{PAGE_W}px; height:{PAGE_H}px; background:#efe3cd; background-image:linear-gradient(135deg,rgba(90,58,34,0.045) 25%,transparent 25%,transparent 50%,rgba(90,58,34,0.045) 50%,rgba(90,58,34,0.045) 75%,transparent 75%); background-size:9px 9px; position:relative; overflow:hidden; margin:20px auto 0; box-shadow:0 2px 20px rgba(0,0,0,0.18); page-break-before:always;">
  <div style="text-align:center; padding:14px 8px 8px; border-bottom:2px solid #5a3a22;">
    <div style="font:400 22px 'Rye','Playfair Display',serif; color:#3d2a18;">The Full Directory</div>
    <div style="font:italic 400 9px 'Playfair Display',Georgia,serif; color:#5a3a22;">{config.name} &mdash; addresses, hours &amp; phone</div>
  </div>

  <div style="position:absolute; left:{MARGIN}px; right:{MARGIN}px; top:64px; bottom:{FOOTER_H + 4}px; overflow:hidden;">
    <div style="column-count:2; column-gap:18px;">
      {#each groups as g}
        <div style="break-inside:avoid; margin-bottom:7px;">
          <div style="font:bold 8px 'Special Elite',monospace; letter-spacing:1px; text-transform:uppercase; color:#5a3a22; border-bottom:1.5px solid #b7410e; padding-bottom:1px; margin-bottom:3px;"><span style="color:#c8a951;">&#10022;</span> {g.label}</div>
          {#each g.shops as shop}
            <div style="break-inside:avoid; margin-bottom:4px; padding-bottom:3px; border-bottom:1px dotted #c2a877;">
              <div style="display:flex; align-items:center; gap:4px;">
                <span style="font:bold 7px 'Courier Prime',monospace; color:#b7410e; min-width:13px;">{numberById.get(shop.id)}</span>
                <strong style="font:700 9.5px 'Playfair Display',serif; color:#3d2a18;">{shop.name}</strong>
                {#if config.flyer.showSaleBadges && salesTodayIds.has(shop.id)}
                  <span style="font:bold 5.5px 'Special Elite',monospace; background:#b7410e; color:#fff; padding:0 2px;">SALE</span>
                {/if}
              </div>
              {#if shop.address}<div style="font:7px 'Courier Prime',monospace; color:#6b4f33; margin-left:17px;">{shop.address}</div>{/if}
              {#if config.flyer.showPhoneNumbers && shop.phone}<div style="font:7px 'Courier Prime',monospace; color:#5a3a22; margin-left:17px;">{shop.phone}</div>{/if}
              {#if config.flyer.showHours && getHoursText(shop.operatingHours)}<div style="font:7px 'Courier Prime',monospace; color:#8a6a44; margin-left:17px;">{getHoursText(shop.operatingHours)}</div>{/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <FlyerFooterVintage {config} height={FOOTER_H} qrSvg={onlineQrSvg} ctaText={'Full guide & today’s sales online'} url={onlineUrl} />
</div>
```

- [ ] **Step 2: Create the dev-only preview route `src/routes/dev/flyer-preview/+page.svelte`**

```svelte
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
    mk(1, 'Vintage Me', 'yakima', ANT), mk(2, 'Yesterday’s Village', 'yakima', ANT),
    mk(3, 'Sideshow Antiques', 'yakima', ANT), mk(4, 'Olive Branch Thrift Shop', 'yakima', CHA),
    mk(5, 'Churchill’s Booklovers’ Haunt', 'yakima', SPE), mk(6, 'Granny’s Attic', 'uniongap', CHA),
    mk(7, 'Country Garden Antiques', 'wapato', ANT), mk(8, 'Trinket Box Antiques', 'selah', ANT),
  ];
  const markerPositions: MarkerPosition[] = shops.map((shop, i) => ({ shop, num: i + 1, x: 80 + (i % 4) * 160, y: 90 + Math.floor(i / 4) * 200 }));
  const salesTodayIds = new Set<number>([1, 6]);
</script>

<div style="padding:20px; background:#888;">
  <FlyerVintageGuide {shops} {config} {salesTodayIds} mapImageUrl="/og-default.png" {markerPositions} areaLabel="All Areas" />
</div>
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: no new errors. (The `FlyerTemplate` union already includes `'vintage-guide'` from Task 1, so the preview route's `template: 'vintage-guide'` typechecks.)

- [ ] **Step 4: Visual verification via headless render**

Start dev server: `npm run dev` (note the port, default 5173).
Then render the preview with the repo's Chromium (adjust port if different):

```bash
cat > /tmp/vg-shot.mjs <<'EOF'
import { chromium } from 'playwright-core';
const exe = '/home/robug/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5173/dev/flyer-preview', { waitUntil: 'networkidle', timeout: 45000 });
await p.waitForTimeout(2500);
const pages = p.locator('.flyer-page');
for (let i = 0; i < await pages.count(); i++) await pages.nth(i).screenshot({ path: `/tmp/vg-page-${i + 1}.png` });
await b.close(); console.log('done');
EOF
node /tmp/vg-shot.mjs
```

Open `/tmp/vg-page-1.png` and `/tmp/vg-page-2.png`. Expected: kraft paper; masthead with "Vintiques Junk Run" in Rye + "★ YAKIMA FINDS ★" wordmark + "Presented by" credit; framed map (the og-default placeholder) with 8 numbered pins; category legend; two-column region-grouped ledger (Yakima, Union Gap, Selah, Wapato in that order) with dotted leaders, category tags, alternating tint, SALE stamps on #1/#6; brown footer with QR + wordmark. Page 2 shows the same groups with addresses/phones. Compare against `docs/superpowers/specs/assets/2026-06-25-vintiques-flyer-mockup.png`. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/flyer/FlyerVintageGuide.svelte src/routes/dev/flyer-preview/+page.svelte
git commit -m "feat(flyer): vintage-guide template + dev preview route"
```

---

### Task 6: Wire the template in + enable it for Vintiques + verify end-to-end

**Files:**
- Modify: `src/lib/components/JunkRunFlyer.svelte` (import + template switch branch)
- Modify: `src/lib/config/junk-runs/vintiques.json` (set `flyer.template`)

(The `FlyerTemplate` union member was added in Task 1.)

**Interfaces:**
- Consumes: `FlyerVintageGuide` (Task 5). Relies on existing `mapW`/`mapH` reactive values in `JunkRunFlyer.svelte` already resolving to 768×620 for `vintage-guide` (it is neither `postcard` nor `directory-focus`) — **do not change them**.

- [ ] **Step 1: Verify the union member is present**

Run: `grep "vintage-guide" src/lib/types/junk-run.ts`
Expected: prints the `FlyerTemplate` line including `'vintage-guide'` (added in Task 1). If missing, add it now before proceeding.

- [ ] **Step 2: Add the switch branch in `JunkRunFlyer.svelte`**

Add the import alongside the other flyer imports (~line 6):

```ts
  import FlyerVintageGuide from './flyer/FlyerVintageGuide.svelte';
```

In the template block at the bottom, change the final selection (currently `directory-focus` / `postcard` / else map-focus) so it reads:

```svelte
  {#if flyerReady && selectedArea}
    {#if config.flyer.template === 'directory-focus'}
      <FlyerDirectoryFocus shops={areaShops} {config} {salesTodayIds} {mapImageUrl} {markerPositions} {areaLabel} />
    {:else if config.flyer.template === 'postcard'}
      <FlyerPostcard shops={areaShops} {config} {salesTodayIds} {mapImageUrl} {markerPositions} {areaLabel} />
    {:else if config.flyer.template === 'vintage-guide'}
      <FlyerVintageGuide shops={areaShops} {config} {salesTodayIds} {mapImageUrl} {markerPositions} {areaLabel} />
    {:else}
      <FlyerMapFocus shops={areaShops} {config} {salesTodayIds} {mapImageUrl} {markerPositions} {areaLabel} />
    {/if}
  {/if}
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: zero errors (the Task 5 preview now typechecks too).

- [ ] **Step 4: Enable it for Vintiques (local config)**

In `src/lib/config/junk-runs/vintiques.json`, add a `flyer` block (merge over defaults). Insert after the `"theme": { … },` block:

```json
  "flyer": { "template": "vintage-guide" },
```

- [ ] **Step 5: Full local verification**

Run: `npm test && npm run check`
Expected: all tests pass; no type errors.
Then repeat the Task 5 Step 4 render (the preview already uses `vintage-guide`) and re-confirm both pages look right.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/JunkRunFlyer.svelte src/lib/config/junk-runs/vintiques.json
git commit -m "feat(flyer): wire vintage-guide template + enable for Vintiques"
```

- [ ] **Step 7: Push the branch**

```bash
git push -u origin feat/vintiques-flyer-vintage-guide
```

- [ ] **Step 8: Deploy to backoffice (production) — coordinated**

> Fleet property `backoffice:yakima` is already claimed for this work. Do NOT guess the restart method (a wrong `kill` took teamtime down before). First discover how `~/yakima` is supervised, then restart it that way.

1. On backoffice, confirm the **authoritative config** path and set the template there too (server prefers `data/junk-runs/`):
   ```bash
   ssh robug@backoffice.fleet 'ls -la ~/yakima/data/junk-runs/vintiques.json 2>/dev/null || echo "no data/ override — src/lib/config is authoritative"'
   ```
   If `data/junk-runs/vintiques.json` exists, set its `flyer.template` to `"vintage-guide"` (the admin UI at `/admin/junk-runs/vintiques` is the safe editor); otherwise the committed `src/lib/config` change is authoritative after build.
2. Pull + build:
   ```bash
   ssh robug@backoffice.fleet 'cd ~/yakima && git fetch && git checkout feat/vintiques-flyer-vintage-guide && git pull && npm install && npm run build'
   ```
   Expected: build completes with no errors.
3. Determine the supervisor and restart accordingly:
   ```bash
   ssh robug@backoffice.fleet 'systemctl list-units --type=service 2>/dev/null | grep -i yakima; pm2 describe yakima 2>/dev/null | head'
   ```
   Restart via whichever owns it (systemd: `sudo systemctl restart <unit>`; pm2: `pm2 restart yakima`). Confirm a single process now serves port 3002.
4. Log the deploy:
   ```bash
   ~/.claude-fleet/scripts/fleet.sh log backoffice:yakima "Deployed vintage-guide flyer template; vintiques set to vintage-guide; <restart method used>"
   ```

- [ ] **Step 9: End-to-end verification on the live site**

Render the live flyer with the existing harness pattern (navigate to `/junk-run/vintiques`, click **Print Flyer**, click **All Areas**, click **Generate Flyer**, wait, screenshot each `.flyer-page`). Expected: the live flyer now shows the kraft vintage-guide design with the region-grouped ledger and all 46 eligible shops (including the 6 newly-added). Also render a single small area (e.g. **Naches / Tieton**) and confirm it produces a clean one-page flyer with correct grouping.

- [ ] **Step 10: Release the claim (after verification)**

```bash
~/.claude-fleet/scripts/fleet.sh release backoffice:yakima
```

---

## Notes / Deliberate Simplifications (YAGNI)

- The Yakima Finds wordmark is **intrinsic** to the vintage-guide header/footer rather than behind a new config flag. Any junk-run that selects `vintage-guide` gets it; add a toggle only if a future run needs the template without the wordmark.
- The "All Areas" map remains a single zoomed-out capture (per the approved Layout 1). Per-region **inset maps** are a documented future enhancement (spec §9), not in this plan.
- The two duplicate shop records (id 171, id 24) were intentionally left in place (data decision, not this plan).
- The dev preview route is gated with `if (!dev) throw error(404)` so it never serves in production; it doubles as a reusable harness for future flyer work.
