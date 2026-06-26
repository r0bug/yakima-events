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
