<template>
	<!-- The run the SERVICE is doing (or did last): which zone, the temperatures, the result of each zone and the Stop button that turns every zone off at once. -->
	<div class="bcr" :class="'bcr-' + view.outcome" role="status" aria-live="polite">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-progress-circular v-if="view.active" indeterminate size="16" width="2" />
			<v-icon v-else small :color="view.outcome === 'done' ? 'success' : view.outcome === 'stopped' ? 'grey' : 'error'">{{ view.outcome === 'done' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline' }}</v-icon>
			<span class="text-body-2 font-weight-medium">{{ t('run_' + view.outcome) }}</span>
			<span class="text-body-2">{{ t(phase) }}</span>
			<span class="text-caption grey--text">{{ clock(view.elapsedS) }}</span>
			<span v-if="view.holdLeftS !== null && view.active" class="text-caption grey--text">{{ t('run_hold_left', { t: clock(view.holdLeftS) }) }}</span>
			<v-spacer />
			<v-btn v-if="view.canStop" small color="error" :loading="stopping" class="bcr-stop" :aria-label="t('stop_label')" @click="$emit('stop')">
				<v-icon small left>mdi-stop</v-icon>{{ t('stop') }}
			</v-btn>
		</div>
		<div v-if="view.canStop" class="text-caption grey--text mt-1">{{ t('stop_hint') }}</div>
		<v-simple-table v-if="view.zones.length" dense class="mt-2 bcr-zones">
			<thead><tr><th>{{ t('col_zone') }}</th><th>{{ t('col_now') }}</th><th>{{ t('col_target') }}</th><th>{{ t('col_state') }}</th></tr></thead>
			<tbody>
				<tr v-for="z in view.zones" :key="'r' + z.bed" :class="{ 'bcr-current': z.state === 'tuning' }">
					<td>{{ zoneName(z) }}<span class="grey--text text-caption"> (P{{ z.bed }} H{{ z.heater }})</span></td>
					<td class="bcr-mono">{{ z.current === null ? '--' : Math.round(z.current * 10) / 10 + ' °C' }}</td>
					<td class="bcr-mono">{{ z.target }} °C</td>
					<td>
						<v-chip x-small outlined :color="resultColor(z)">{{ t('zone_' + z.result) }}</v-chip>
						<span v-if="z.error" class="text-caption error--text"> {{ t(zoneErr(z.error)) }}</span>
					</td>
				</tr>
			</tbody>
		</v-simple-table>
		<pid-tune-chart v-if="trace && trace.points.length > 1" :trace="trace" class="mt-2" />
		<template v-if="models.length">
			<div class="text-subtitle-2 mt-2">{{ t('run_models') }}</div>
			<div v-for="m in models" :key="'m' + m.heater" class="text-body-2"><code class="bcr-mono">{{ m.modelLine }}</code></div>
			<div class="text-caption grey--text">{{ t('run_models_note') }}</div>
		</template>
		<v-alert v-if="view.errorCode && view.outcome === 'failed'" dense text type="error" class="mt-2 mb-0">{{ t(errKey(view.errorCode)) }}</v-alert>
		<v-alert v-else-if="view.outcome === 'stopped'" dense text type="info" class="mt-2 mb-0">{{ t('run_stopped_note') }}</v-alert>
		<v-alert v-if="!view.active && view.offProblem" dense text type="error" class="mt-2 mb-0">{{ t('run_off_problem') }}</v-alert>
		<div v-else-if="!view.active && view.off" class="text-caption grey--text mt-1"><v-icon x-small class="mr-1">mdi-power</v-icon>{{ t('run_all_off') }}</div>
		<v-btn v-if="!view.active" small text class="mt-1" @click="$emit('dismiss')">{{ t('run_close') }}</v-btn>
	</div>
</template>

<script>
'use strict'

import PidTuneChart from './PidTuneChart.vue'
import { phaseKey, clock, errorKey, zoneErrorKey } from './bed-cal-run.js'

export default {
	components: { PidTuneChart },
	props: {
		view: { type: Object, required: true }, // runView() of bedcal.status
		stopping: { type: Boolean, default: false },
		trace: { type: Object, default: null }, // the chart of the tuning (pid.trace), only while one goes on
		numbers: { type: Object, default: () => ({}) } // bed -> zone number on the map
	},
	computed: {
		phase() {
			return phaseKey(this.view)
		},
		models() {
			return this.view.zones.filter(z => z.modelLine)
		}
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.bedCal.' + key, params || {})
		},
		clock,
		errKey: errorKey,
		zoneErr: zoneErrorKey,
		zoneName(z) {
			return this.$t('plugins.WorkshopPrinting.bedZones.zone_n', { n: this.numbers[z.bed] || z.bed + 1 })
		},
		resultColor(z) {
			return z.result === 'ok' || z.result === 'reached' ? 'success' : z.result === 'failure' || z.result === 'cut' ? 'error' : z.result === 'in_progress' || z.result === 'heating' ? 'amber darken-3' : 'grey'
		}
	}
}
</script>

<style scoped>
.bcr { margin-top: 8px; padding: 8px 12px; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.4)); border-radius: 8px; }
.bcr-mono { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
.bcr-current { font-weight: 500; }
</style>
