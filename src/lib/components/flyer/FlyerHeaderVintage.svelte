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
