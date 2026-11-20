<template>
	<!-- The tracking card of the job (general redesign step 4): the file, the state, the progress and the facts (layer, Z, times as DWC reports them).
	     READ ONLY: the numbers come from the object model DWC keeps; nothing is sent. The temperatures are NOT repeated here: they are in Status (one link).
	     Only in FFF mode. -->
	<v-card v-if="isFff" outlined class="pa-3 fff-status">
		<div class="pc-actions">
			<h4 class="pc-card-title">{{ fileRow ? fileRow.value : t('fff.print_title') }}</h4>
			<span class="wf-state" :class="running ? 'ok' : 'info'">{{ stateRow ? stateRow.value : '--' }}</span>
		</div>
		<template v-if="progressRow">
			<div class="pc-progress mt-2" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(progressRow.bar)" :aria-label="t('fff.p_progress')"><i :style="{ width: progressRow.bar.toFixed(1) + '%' }" /></div>
			<div class="text-body-2 mt-1">{{ progressRow.value }}</div>
		</template>
		<dl v-if="facts.length" class="pc-facts mt-3">
			<div v-for="r in facts" :key="r.id"><dt>{{ r.label }}</dt><dd>{{ r.value }}</dd></div>
		</dl>
		<div v-if="facts.length" class="wf-field-msg is-hint mt-2">{{ t('fff.times_dwc') }}</div>
		<div class="pc-actions mt-2">
			<v-btn small text @click="$emit('goto', { section: 'state' })"><v-icon small left>mdi-thermometer</v-icon>{{ t('fff.see_temps') }}</v-btn>
		</div>
		<!-- the library's card of the job file (nothing when the library does not know it) -->
		<gcode-info-card v-if="jobFile" :file="jobFile" class="mt-3" />
	</v-card>
</template>

<script>
'use strict'

import { tzFffPanel } from './fff-temps.js'
import { fffJobFile } from './fff-job.js'
import GcodeInfoCard from './GcodeInfoCard.vue'

// the facts of the card, in this order (ids of the rows of tzFffPanel); speed and flow are in Live adjustments, the file and the state are the head
const FACTS = ['layer', 'z', 'elapsed', 'left']

export default {
	components: { GcodeInfoCard },
	props: {
		isFff: { type: Boolean, default: false }
	},
	computed: {
		jobFile() {
			return fffJobFile(this.$store.state.machine.model);
		},
		panel() {
			return tzFffPanel(this.$store.state.machine.model, this.t);
		},
		row() {
			return id => this.panel.print.find(r => r.id === id) || null;
		},
		fileRow() {
			return this.row('file');
		},
		stateRow() {
			return this.row('state');
		},
		progressRow() {
			const r = this.row('progress');
			return r && r.bar != null ? r : null;
		},
		running() {
			return !!this.panel.inProgress;
		},
		facts() {
			return FACTS.map(id => this.row(id)).filter(Boolean);
		}
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.' + key, params);
		}
	}
};
</script>
