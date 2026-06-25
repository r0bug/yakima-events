# Vintiques Junk Run — Vintage-Guide Flyer Redesign

**Date:** 2026-06-25
**Status:** Approved design, ready for implementation plan
**Area:** `yakima-events` SvelteKit app → junk-run printable flyer
**Target route:** `https://yfevents.yakimafinds.com/junk-run/vintiques` ("Print Flyer")

---

## 1. Context & Problem

The Junk Run page lets visitors generate a printable US-Letter flyer/map of antique &
vintage shops. The live flyer uses the `map-focus` template. Rendered output before
this work is captured in:

- `assets/2026-06-25-vintiques-flyer-BEFORE-p1.png` (page 1: map + name grid)
- `assets/2026-06-25-vintiques-flyer-BEFORE-p2.png` (page 2: directory)

Problems observed in the live flyer:

1. **No brand identity in the body.** The theme palette (rust `#b7410e`, gold
   `#c8a951`, cream `#faf6f0`, black header) barely appears — the page reads as a
   stark white map with two black bars. It does not feel like an "antique & vintage"
   guide.
2. **Flat masthead.** Plain centered text, wide empty margins, no logo/ornament/edition.
3. **Phone-book directory.** Page 1 is a cramped 4-column pill grid; page 2 is a flat
   numbered list with weak hierarchy and no grouping.
4. **Map legibility.** In "All Areas" the map zooms out so far that shops collapse into
   an unreadable central blob (a secondary concern; see §9).

## 2. Goals / Non-Goals

**Goals**
- Give the flyer a cohesive **rustic flea-market / kraft "vintage-guide"** look.
- Replace the flat directory with a **region-grouped ledger** that scans easily.
- Keep it **print-correct** on US Letter (8.5"×11"), 1–2 pages, color-accurate.
- Be **reversible**: shipping should not disturb the existing templates.

**Non-Goals (this iteration)**
- Per-region inset maps (the "editorial spread"; deferred — see §9).
- Changing the shop dataset, categories, or the map-capture pipeline mechanics.
- Redesigning the public (on-screen) junk-run directory page — flyer only.

## 3. Approved Design Decisions

Chosen collaboratively via the visual brainstorming companion:

| Decision | Choice |
|---|---|
| **Aesthetic** | **D — Rustic Flea-Market / Kraft**: kraft-paper texture, stamped/typewriter labels, woodtype title, hand-tag accents |
| **Page-1 layout** | **1 — Top Map + Region Directory**: one map up top, directory grouped under region headers below |
| **Directory entry** | **B — Ledger Rows**: catalog rows with dotted leader lines to a category tag, alternating tint stripes |

Approved assembled mockup: `assets/2026-06-25-vintiques-flyer-mockup.png`.

## 4. Visual System

**Palette** (extends existing theme; kraft tones are new, derived — not stored on the
theme object unless we choose to):
- Paper / kraft base: `#efe3cd`; subtle diagonal hatch overlay at ~5% brown.
- Masthead band: `#b9a07c` with darker hatch; bottom border `#5a3a22`.
- Ink / headings: `#3d2a18`; secondary ink: `#5a3a22`.
- Accents from theme: rust `#b7410e` (numbers, rules, SALE), gold `#c8a951` (ornaments).
- Footer band: `#5a3a22` with cream text `#f3e6cf`.
- Category pin colors: unchanged — keep each `shop.category.color` for pins + legend.

**Texture:** CSS-generated only (paper color + `linear-gradient` hatch). **No external
image** — guarantees it prints and never depends on a network asset.

**Typography** (Google Fonts, preloaded — see §9):
- Display / masthead title: **Rye** (woodtype) — falls back to Playfair Display, serif.
- Stamps / section labels / meta: **Special Elite** and **Courier Prime** (typewriter).
- Body / shop names: **Playfair Display** (already used in the app).

**Reusable components/blocks:**
- *Stamped tag* — rotated dark chip ("EST · YAKIMA VALLEY", "SALE").
- *Section header* — `✦ REGION NAME` in Special Elite over a rust hairline.
- *Ledger row* — `№ · Name …dotted leader… CATEGORY`, even rows tinted.
- *Kraft footer* — QR + handwritten-style call-to-action + URL.
- *Yakima Finds wordmark* — see §4a.

### 4a. Yakima Finds Branding (kraft wordmark)

Yakima Finds is credited as the platform/presenter; "Vintiques Junk Run" remains the
dominant visual brand. **No logo file** is used (none exists in the repo) — the mark is
purely typographic so it always prints and needs no asset.

- **Wordmark:** a compact "maker's stamp" — `★ YAKIMA FINDS ★` (or a `Y✦F` monogram in a
  thin gold-ruled oval) set in **Special Elite** caps, ink `#5a3a22` on kraft, with a
  gold `#c8a951` ornament. Sized clearly **below** the Rye title — secondary, not
  competing.
- **Placement:** (1) masthead — pair the wordmark with the existing
  `headerHtml` "*Presented by* Yakima Finds" credit (wordmark above/beside the italic
  line, top-right of the band); (2) footer band — small wordmark to the left of the URL.
- **Build:** render the wordmark as a small inline component/snippet driven by config (so
  other junk-runs can opt in/out). It does **not** use `customContent.sponsorLogoUrl`,
  which stays reserved for actual event sponsors. If a real YF logo is supplied later,
  it can drop into the same slot without layout changes.

## 5. Page 1 — "Map & Guide" (816×1056 px @ 96dpi)

Top → bottom:
1. **Masthead band** (kraft): edition line (`JUNE 2026 · {AREA}`) top-left; the **Yakima
   Finds kraft wordmark + "Presented by" credit** (§4a) top-right; centered stamped tag,
   "Vintiques Junk Run" in Rye, italic tagline. Sponsor-logo slot still honored
   separately if `customContent.sponsorLogoUrl` is set.
2. **Map** (~41% height): the existing captured Leaflet PNG, framed with a `#8a6a44`
   border + inset shadow; numbered pins overlaid (existing SVG pin system, slightly
   larger heads for legibility).
3. **Category legend** strip (Special Elite labels + color dots), when ≥2 categories.
4. **Region-grouped ledger directory** (2 columns): shops grouped by `region`, each group
   led by a `✦ Region` header, then ledger rows (number, name, dotted leader, category
   tag, optional SALE stamp). Names only on page 1 (no address) to control density.
5. **Kraft footer**: route QR (when `qrMode = route`) + CTA + the Yakima Finds wordmark
   (§4a) + `yakimafinds.com · #VintiquesJunkRun`.

## 6. Page 2 — "The Full Directory"

Same kraft world; emitted when shops overflow page 1 (always, for All Areas):
- Centered Rye sub-masthead "The Full Directory" + italic tagline, over a rust hairline.
- Region-grouped ledger, 2 columns, **with** address / phone (and hours if
  `showHours`). SALE stamp where applicable.
- Kraft footer with the online-guide QR / URL: `…/junk-run/{slug}`.

## 7. Implementation Approach

**Add a new template, do not mutate the live ones.** This keeps `map-focus`,
`directory-focus`, `postcard` intact and makes rollback a one-line config flip.

- **`src/lib/types/junk-run.ts`** — extend `FlyerTemplate` union with `'vintage-guide'`.
  (Leave `DEFAULT_FLYER_OPTIONS.template` as `map-focus` so other runs are unaffected.)
- **`src/lib/components/flyer/FlyerVintageGuide.svelte`** — new component implementing
  §5–§6. Modeled on `FlyerMapFocus.svelte` (same props: `shops`, `config`,
  `salesTodayIds`, `mapImageUrl`, `markerPositions`, `areaLabel`; same `PAGE_W/H`,
  `MAP_W/H`, pin overlay, QR logic) so the existing capture pipeline in
  `JunkRunFlyer.svelte` works unchanged.
- **`src/lib/components/flyer/FlyerHeaderVintage.svelte`** + **`FlyerFooterVintage.svelte`**
  — new kraft masthead/footer (or vintage variants); keep originals untouched.
- **`JunkRunFlyer.svelte`** — add a `{:else if config.flyer.template === 'vintage-guide'}`
  branch in the template switch. **Verify `mapW`/`mapH` reactive values** cover the new
  template (it shares map-focus dimensions: `MAP_W = 816 − 24·2`, `MAP_H = 620`).
- **Region grouping helper** — region→label/order currently lives as `AREAS` inside
  `JunkRunFlyer.svelte`. Extract a shared `regionGroups(shops)` (and label/order map)
  into `src/lib/components/flyer/flyer-utils.ts` so both the selector and the directory
  group consistently.
- **`src/lib/config/junk-runs/vintiques.json`** (and `data/junk-runs/vintiques.json` if
  present on the server) — set `"flyer": { "template": "vintage-guide" }` (merged over
  `DEFAULT_FLYER_OPTIONS`). This is the switch that makes vintiques use the new design.

**Config-load note:** `+page.server.ts` prefers `data/junk-runs/<slug>.json` over
`src/lib/config/junk-runs/<slug>.json`. Implementation must set the template in whichever
file is authoritative for vintiques on the server (confirm during the plan; the admin UI
at `/admin/junk-runs/[slug]` writes `data/`).

## 8. Fonts & Print Correctness

- Add **Rye, Special Elite, Courier Prime** (Playfair already present). Prefer
  self-hosting or `<link rel="preload">` in `src/app.html` so glyphs are ready before
  `window.print()` and before the offscreen Leaflet capture.
- Keep `-webkit-print-color-adjust: exact; print-color-adjust: exact;` on `.flyer-page`
  (already set globally in `JunkRunFlyer.svelte`) so kraft tones and bands actually print.
- Verify `@media print` rules size each `.flyer-page` to one US-Letter sheet with no
  clipping of the footer band.

## 9. Out of Scope / Future

- **Regional inset maps** (brainstorming option 2): a small map per region beside its
  shops. Higher impact on the All-Areas legibility problem but requires capturing
  multiple Leaflet maps. Deferred to a follow-up; this redesign mitigates density via
  region grouping instead.
- Optionally expose kraft tones on the theme object / admin UI later.

## 10. Testing / Verification

- Headless render (Playwright + the repo's Chromium) of
  `/junk-run/vintiques` → Print Flyer → All Areas → Generate, screenshot each
  `.flyer-page`; compare against the approved mockup. Repeat for a single small area
  (e.g. Wine Country) to confirm 1-page behavior and grouping.
- Visual checks: masthead/edition correct, pins legible & aligned, region groups ordered,
  category tags/legend correct, SALE stamps appear for today's sales, QR scans to the
  route, footer not clipped.
- Confirm the three existing templates still render (no regression) by temporarily
  switching `template` back.
- `npm run check` / typecheck clean for the new union member and components.

## 11. Risks & Mitigations

- **Print color stripped by browser** → rely on existing color-adjust rules; verify in a
  real print preview.
- **Fonts not loaded at capture/print time** → preload; fall back to Playfair/serif so
  layout never breaks.
- **All-Areas density still high** → region grouping + names-only page 1; full detail on
  page 2; inset maps available as a future step.
- **Editing the wrong config file** (`data/` vs `src/lib/config/`) → confirm authoritative
  path on the server during the plan before flipping the template.

## 12. Rollback

Set `vintiques.json` `flyer.template` back to `"map-focus"` (or remove the key). New
components are additive and unreferenced by other runs, so no other flyer is affected.

## 13. Affected Files (summary)

- `src/lib/types/junk-run.ts` (union member)
- `src/lib/components/flyer/FlyerVintageGuide.svelte` *(new)*
- `src/lib/components/flyer/FlyerHeaderVintage.svelte` *(new; includes Yakima Finds kraft wordmark §4a)*
- `src/lib/components/flyer/FlyerFooterVintage.svelte` *(new; includes Yakima Finds kraft wordmark §4a)*
- `src/lib/components/flyer/flyer-utils.ts` (shared region grouping)
- `src/lib/components/JunkRunFlyer.svelte` (template switch + map dims)
- `src/app.html` (font preload)
- `src/lib/config/junk-runs/vintiques.json` and/or `data/junk-runs/vintiques.json` (template switch)
