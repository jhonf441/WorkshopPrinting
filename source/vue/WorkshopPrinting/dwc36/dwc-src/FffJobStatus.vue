<template>
	<!-- Temperatures and print state of the job (moved from the Workbench's "Current job" card, 2026-10-21).
	     READ ONLY: the numbers come from the object model DWC keeps; nothing is sent. Only in FFF mode. -->
	<v-card v-if="isFff" outlined class="pa-3 fff-status">
		<div class="text-subtitle-2">{{ t('fff.temps_title') }}</div>
		<div v-if="!panel.temps.length" class="text-body-2 grey--text">{{ t('fff.no_heaters') }}</div>
		<div v-for="r in panel.temps" :key="r.key" class="fff-row">
			<span class="grey--text">{{ r.name }}</span>
			<b :style="{ color: r.color }">{{ r.value }}<span class="fff-chip grey--text">{{ r.chip }}</span></b>
		</div>
		<div class="text-subtitle-2 mt-3">{{ t('fff.print_title') }}</div>
		<template v-for="(r, i) in panel.print">
			<div :key="'p' + i" class="fff-row">
				<span class="grey--text">{{ r.label }}</span>
				<b :style="r.color ? { color: r.color } : null">{{ r.value }}</b>
			</div>
			<div v-if="r.bar != null" :key="'b' + i" class="fff-bar"><div :style="{ width: r.bar.toFixed(1) + '%' }" /></div>
		</template>
		<div v-if="panel.none" class="text-body-2 grey--text">{{ t('fff.p_none') }}</div>
	</v-card>
</template>

<script>
'use strict'

import { tzFffPanel } from './fff-temps.js'

export default {
	props: {
		isFff: { type: Boolean, default: false }
	},
	computed: {
		panel() {
			return tzFffPanel(this.$store.state.machine.model, this.t);
		}
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.' + key, params);
		}
	}
};
</script>

<style scoped>
.fff-row {
	display: flex;
	gap: 8px;
	align-items: center;
	justify-content: space-between;
	margin-top: 3px;
}
.fff-chip {
	font-size: 11px;
	margin-left: 6px;
	font-weight: normal;
}
.fff-bar {
	height: 6px;
	border-radius: 3px;
	background: rgba(128, 128, 128, 0.25);
	margin-top: 3px;
	overflow: hidden;
}
.fff-bar > div {
	height: 100%;
	background: #66bb6a;
}
</style>
