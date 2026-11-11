<template>
	<!-- The confirmation of an action that HEATS: the zones, the temperatures and the order, read from the plan the service made (bedcal.plan). Nothing has been sent to the machine
	     yet; the start button works only with the "I will stay" box ticked, and Cancel sends nothing. -->
	<v-dialog :value="true" persistent max-width="560" @keydown.esc="$emit('cancel')">
		<v-card role="alertdialog" aria-labelledby="bcc-title">
			<v-card-title id="bcc-title" class="text-h6">{{ t(kind === 'tune' ? 'confirm_tune_title' : 'confirm_preheat_title') }}</v-card-title>
			<v-card-text>
				<div class="text-body-2 mb-2">{{ t(kind === 'tune' ? 'confirm_tune_text' : 'confirm_preheat_text', { temp: plan.temp }) }}</div>
				<v-simple-table dense class="bcc-zones">
					<thead><tr><th>{{ t('col_zone') }}</th><th>{{ t('col_bed') }}</th><th>{{ t('col_target') }}</th><th>{{ kind === 'tune' ? t('col_action') : t('col_start') }}</th></tr></thead>
					<tbody>
						<tr v-for="z in zones" :key="'z' + z.bed">
							<td>{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: z.n }) }}</td>
							<td class="bcc-mono">P{{ z.bed }} / H{{ z.heater }}</td>
							<td class="bcc-mono">{{ z.target }} °C</td>
							<td>{{ kind === 'tune' ? t(z.tune ? 'confirm_tuned' : (plan.together ? 'confirm_held' : 'confirm_off')) : t('order_after_start', { s: z.startS }) }}</td>
						</tr>
					</tbody>
				</v-simple-table>
				<div v-if="kind === 'preheat'" class="text-body-2 mt-2">{{ t('confirm_hold', { min: Math.round(plan.hold_s / 60) }) }}</div>
				<div class="wf-note is-warn mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ t('confirm_present') }}</span></div>
				<v-checkbox v-model="stays" dense hide-details class="mt-2" :label="t('confirm_stays')" :aria-label="t('confirm_stays')" />
				<help-tip v-bind="help" />
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn text @click="$emit('cancel')">{{ t('cancel') }}</v-btn>
				<v-btn :color="kind === 'tune' ? 'error' : 'amber darken-3'" dark :disabled="!stays || busy" :loading="busy" @click="$emit('confirm', stays)">
					<v-icon left>mdi-fire</v-icon>{{ t(kind === 'tune' ? 'confirm_tune_go' : 'confirm_preheat_go') }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
'use strict'

import HelpTip from './HelpTip.vue' // vue/_shared36
import { planZones } from './bed-cal-run.js'

export default {
	components: { HelpTip },
	props: {
		kind: { type: String, default: 'preheat' },
		plan: { type: Object, required: true }, // the answer of bedcal.plan
		numbers: { type: Object, default: () => ({}) }, // bed -> zone number (n) on the map
		busy: { type: Boolean, default: false }
	},
	data() {
		return { stays: false }
	},
	computed: {
		zones() {
			return planZones(this.plan).map((z, i) => Object.assign({ n: this.numbers[z.bed] || i + 1 }, z))
		},
		help() {
			return { title: this.t('help_confirm_title'), what: this.t('help_confirm_what'), why: this.t('help_confirm_why'), ifMissing: this.t('help_confirm_miss'), how: this.t('help_confirm_how') }
		}
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.bedCal.' + key, params || {})
		}
	}
}
</script>

<style scoped>
.bcc-mono { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
</style>
