<template>
	<!-- Read-only: the G-code the service sends in this step, exactly as the plan of the service lists it (bedcal.plan). Collapsed by default; no Copy button because nobody has to copy anything. -->
	<details class="bcg" @toggle="onToggle">
		<summary class="text-body-2">{{ t('gcode_show') }}</summary>
		<div v-if="loading" class="text-caption grey--text">{{ t('gcode_loading') }}</div>
		<div v-else-if="error" class="text-caption error--text">{{ error }}</div>
		<template v-else-if="text">
			<pre class="bcg-text">{{ text }}</pre>
			<div class="text-caption grey--text">{{ t('gcode_note') }}</div>
		</template>
		<div v-else class="text-caption grey--text">{{ t('gcode_empty') }}</div>
	</details>
</template>

<script>
'use strict'

import { linesText } from './bed-cal-run.js'

export default {
	props: {
		lines: { type: Array, default: () => [] }, // planLines() of the answer of bedcal.plan
		error: { type: String, default: '' },
		loading: { type: Boolean, default: false }
	},
	computed: {
		text() {
			return linesText(this.lines, bed => this.t('gcode_zone', { bed }), s => this.t('gcode_after', { s }))
		}
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.bedCal.' + key, params || {})
		},
		onToggle(ev) {
			if (ev && ev.target && ev.target.open) this.$emit('open')
		}
	}
}
</script>

<style scoped>
.bcg { margin-top: 8px; }
.bcg summary { cursor: pointer; }
.bcg-text { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: pre; overflow-x: auto; padding: 8px; margin: 4px 0; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.4)); border-radius: 8px; }
</style>
