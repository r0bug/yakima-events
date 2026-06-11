<script lang="ts">
	import type { JunkRunConfig } from '$lib/types/junk-run';

	export let config: JunkRunConfig;
	export let areaLabel: string;
	export let height: number = 70;
</script>

<div style="position:absolute; top:0; left:0; right:0; height:{height}px; background:{config.theme.headerBg}; display:flex; align-items:center; justify-content:center; flex-direction:column;">
	{#if config.customContent.sponsorLogoUrl && config.customContent.sponsorLogoPlacement === 'header'}
		<img src={config.customContent.sponsorLogoUrl} alt="Sponsor" style="height:24px; position:absolute; left:20px; top:50%; transform:translateY(-50%);" />
	{/if}
	<div style="font-family:'Playfair Display',Georgia,serif; font-size:22px; font-weight:900; color:{config.theme.headerText}; letter-spacing:-0.5px;">
		{config.name}
	</div>
	<div style="font-size:10px; color:{config.theme.accent}; margin-top:1px;">
		{config.tagline} &mdash; {areaLabel}
	</div>
	{#if config.customContent.announcementText}
		<div style="font-size:8px; color:{config.theme.accent}; font-weight:bold; margin-top:1px;">
			{config.customContent.announcementText}
		</div>
	{/if}
</div>
