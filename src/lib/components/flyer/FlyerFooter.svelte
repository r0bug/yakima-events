<script lang="ts">
	import type { JunkRunConfig } from '$lib/types/junk-run';

	export let config: JunkRunConfig;
	export let height: number = 36;
</script>

<div style="position:absolute; bottom:0; left:0; right:0; height:{height}px; background:{config.theme.headerBg}; display:flex; align-items:center; justify-content:center; padding:0 20px;">
	{#if config.customContent.sponsorLogoUrl && config.customContent.sponsorLogoPlacement === 'footer'}
		<img src={config.customContent.sponsorLogoUrl} alt="Sponsor" style="height:20px; margin-right:12px;" />
	{/if}
	<span style="font-size:8px; color:{config.theme.accent};">{@html config.footerHtml}</span>
	<span style="font-size:7px; color:{config.theme.headerText}; opacity:0.4; margin-left:auto;">yfevents.yakimafinds.com</span>
</div>
