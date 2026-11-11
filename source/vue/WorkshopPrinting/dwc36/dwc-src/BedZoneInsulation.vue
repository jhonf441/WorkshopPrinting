<template>
	<div class="bzi">
		<div class="d-flex align-center" style="gap:4px">
			<div class="text-subtitle-1 font-weight-medium">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_title') }}</div>
			<help-tip :title="$t('plugins.WorkshopPrinting.bedZones.insulation_title')" :what="$t('plugins.WorkshopPrinting.bedZones.insulation_help_what')" :why="$t('plugins.WorkshopPrinting.bedZones.insulation_help_why')" :if-missing="$t('plugins.WorkshopPrinting.bedZones.insulation_help_miss')" :how="$t('plugins.WorkshopPrinting.bedZones.insulation_help_how')" />
		</div>
		<p class="text-caption mt-1 mb-2">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_intro') }}</p>
		<ol class="text-body-2 mb-3">
			<li>{{ $t('plugins.WorkshopPrinting.bedZones.insulation_step_1') }}</li>
			<li>{{ $t('plugins.WorkshopPrinting.bedZones.insulation_step_2') }}</li>
			<li>{{ $t('plugins.WorkshopPrinting.bedZones.insulation_step_3') }}</li>
		</ol>

		<div class="d-flex align-end flex-wrap" style="gap:12px">
			<v-btn-toggle v-model="kind" mandatory dense color="primary" class="bzi-toggle" :aria-label="$t('plugins.WorkshopPrinting.bedZones.insulation_kind')">
				<v-btn small value="before" class="bzi-btn" :disabled="!!rec">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_before') }}</v-btn>
				<v-btn small value="after" class="bzi-btn" :disabled="!!rec">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_after') }}</v-btn>
			</v-btn-toggle>
			<v-btn v-if="!rec" small color="primary" class="bzi-btn" :disabled="!rows.length" @click="start()">
				<v-icon small left>mdi-record-circle-outline</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.insulation_start') }}
			</v-btn>
			<template v-else>
				<v-btn small color="primary" class="bzi-btn" @click="stop(true)"><v-icon small left>mdi-stop</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.insulation_stop') }}</v-btn>
				<v-btn small outlined class="bzi-btn" @click="stop(false)">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_discard') }}</v-btn>
			</template>
		</div>

		<!-- while recording: what is being read and what the person has to do next -->
		<div v-if="rec" class="wf-note mt-3" role="status" aria-live="polite">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-timer-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.insulation_recording', { temp: liveTemp, min: elapsedText, n: rec.samples.length }) }} {{ hint }}</span>
		</div>
		<div v-if="message" class="wf-note is-warn mt-3" role="note">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.' + message) }}</span>
		</div>

		<v-simple-table v-if="runs.before || runs.after" dense class="bzi-table mt-3">
			<thead>
				<tr>
					<th>{{ $t('plugins.WorkshopPrinting.bedZones.insulation_run') }}</th>
					<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_col_tau') }}</th>
					<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_col_rate') }}</th>
					<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_col_len') }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="k in ['before', 'after']" v-show="runs[k]" :key="k">
					<td>{{ $t('plugins.WorkshopPrinting.bedZones.insulation_' + k) }} <span v-if="runs[k] && typeof runs[k].zone === 'number'" class="grey--text text-caption">{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: runs[k].zone + 1 }) }}</span><span v-else-if="runs[k]" class="grey--text text-caption">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_whole_bed') }}</span></td>
					<td class="text-right bzi-num">{{ runs[k] ? runs[k].fit.tau + ' min' : '' }}</td>
					<td class="text-right bzi-num">{{ runs[k] ? runs[k].fit.rate + ' °C/min' : '' }}</td>
					<td class="text-right bzi-num">{{ runs[k] ? runs[k].fit.minutes + ' min / ' + runs[k].fit.drop + ' °C' : '' }}</td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-if="verdict" class="wf-note mt-3" role="note" aria-live="polite">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-check-circle-outline</v-icon>
			<span>{{ verdict }}</span>
		</div>
		<div v-if="runs.before || runs.after" class="d-flex flex-wrap align-center mt-2" style="gap:8px">
			<span class="text-caption">{{ roomText }}</span>
			<v-btn small text class="bzi-btn" @click="clearRuns()">{{ $t('plugins.WorkshopPrinting.bedZones.insulation_clear') }}</v-btn>
		</div>
	</div>
</template>

<script>
'use strict'

// The insulation test of the bed: it only READS. The person heats the whole bed (every zone) with the usual controls and turns it off; this card records the temperature of the bed
// (the area-weighted average of the zones) every few seconds, measures how fast it cools (the time constant, bed-zones-insulation.js) and compares a run without cover with a run with cover. It sends
// nothing to the machine. The finished runs belong to the page, which keeps them in the service (bedestimates.*), so every screen shows the same comparison; a recording in progress is only here.
import { addSample, fitCooling, compareRuns, lossWatts, bedTemperature, plateCapacity, SAMPLE_S, ASSUMED_ROOM } from './bed-zones-insulation.js'
import { MATERIALS } from './bed-zones-power.js'
import WfField from './WfField.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36

export default {
	components: { WfField, HelpTip },
	props: {
		rows: { type: Array, required: true }, // zoneRows(): the live temperature of every zone
		inputs: { type: Object, default: () => ({}) }, // the inputs of the power card (room temperature, plate)
		runs: { type: Object, default: () => ({ before: null, after: null }) } // the two finished runs {at, fit} (null = not done; an old run may also carry a zone)
	},
	data() {
		return { kind: 'before', rec: null, timer: null, now: 0, message: null }
	},
	computed: {
		room() {
			const n = parseFloat(String(this.inputs.ambient === undefined ? '' : this.inputs.ambient).replace(',', '.'))
			return isFinite(n) ? n : null
		},
		bedTemp() {
			return bedTemperature(this.rows)
		},
		liveTemp() {
			return this.rec && this.bedTemp !== null ? Math.round(this.bedTemp * 10) / 10 : '-'
		},
		elapsedText() {
			return this.rec ? Math.floor((this.now - this.rec.start) / 60000) : 0
		},
		// what to do next, from what the bed is doing now (any zone with a target above zero is still heating)
		hint() {
			if (!this.rec || !this.rows.length) return ''
			return this.$t('plugins.WorkshopPrinting.bedZones.' + (this.rows.some(r => r.target > 0) ? 'insulation_hint_on' : 'insulation_hint_off'))
		},
		verdict() {
			const c = compareRuns(this.runs.before && this.runs.before.fit, this.runs.after && this.runs.after.fit)
			if (!c) return ''
			const t = k => this.$t('plugins.WorkshopPrinting.bedZones.' + k, { gain: Math.abs(c.gain), cut: Math.abs(c.lossCut) })
			let text = c.gain >= 1 ? t('insulation_better') : c.gain <= -1 ? t('insulation_worse') : t('insulation_same')
			const b = this.runs.before
			const w = this.watts(b)
			if (w !== null && c.gain >= 1) text += ' ' + this.$t('plugins.WorkshopPrinting.bedZones.insulation_watts', { before: w, after: this.watts(this.runs.after) })
			return text
		},
		roomText() {
			const given = [this.runs.before, this.runs.after].filter(Boolean).every(r => r.fit.roomGiven)
			return given ? this.$t('plugins.WorkshopPrinting.bedZones.insulation_room_given') : this.$t('plugins.WorkshopPrinting.bedZones.insulation_room_assumed', { t: ASSUMED_ROOM })
		}
	},
	beforeDestroy() {
		clearInterval(this.timer)
	},
	methods: {
		// the heat capacity of the whole plate (J/K) when the plate and the zone geometry are known, to turn the time constant into watts lost; null when not
		capacity() {
			const i = this.inputs
			const m = MATERIALS[i.material]
			const thickness = parseFloat(String(i.thickness).replace(',', '.'))
			const density = i.material === 'custom' ? parseFloat(String(i.density).replace(',', '.')) : m && m.density
			const cp = i.material === 'custom' ? parseFloat(String(i.cp).replace(',', '.')) : m && m.cp
			return plateCapacity(this.rows, thickness, density, cp)
		},
		watts(run) {
			return run ? lossWatts(this.capacity(), run.fit.tau, 40) : null
		},
		start() {
			if (!this.rows.length) return
			this.message = null
			this.rec = { kind: this.kind, start: Date.now(), samples: [] }
			this.now = Date.now()
			this.sample()
			clearInterval(this.timer)
			this.timer = setInterval(() => this.sample(), SAMPLE_S * 1000)
		},
		sample() {
			if (!this.rec) return
			this.now = Date.now()
			if (this.bedTemp !== null) this.rec.samples = addSample(this.rec.samples, (this.now - this.rec.start) / 1000, this.bedTemp)
		},
		stop(keep) {
			clearInterval(this.timer)
			const rec = this.rec
			this.rec = null
			if (!keep || !rec) return
			const fit = fitCooling(rec.samples, this.room)
			if (!fit.ok) { this.message = fit.why; return }
			this.$emit('runs', Object.assign({}, this.runs, { [rec.kind]: { fit, at: Math.round(Date.now() / 1000) } }))
		},
		clearRuns() {
			this.$emit('runs', { before: null, after: null })
		}
	}
}
</script>

<style scoped>
.bzi-btn.v-btn { height: 44px; min-height: 44px; }
.bzi-toggle.v-btn-toggle { height: 44px; align-items: stretch; }
.bzi-num { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
</style>
