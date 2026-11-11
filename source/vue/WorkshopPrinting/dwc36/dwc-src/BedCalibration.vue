<template>
	<v-card outlined class="pa-3 mt-3 bc-card" aria-labelledby="bc-title">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon small>mdi-tune-variant</v-icon>
			<span id="bc-title" class="text-subtitle-1">{{ tx('title') }}</span>
			<span class="wf-pill">{{ tx('does_the_work') }}</span>
		</div>
		<div class="text-caption grey--text mt-1">{{ tx('lead') }}</div>
		<help-guide :title="$t('plugins.WorkshopPrinting.common.how_it_works')" :what="tx('guide_what')" :why="tx('guide_why')" :if-missing="tx('guide_miss')" :how="tx('guide_how')" class="mt-2" />
		<error-notice v-if="failure" :error="failure" :action="tx('acting')" retry class="mt-2" @retry="load()" />
		<v-alert v-if="ui.error" dense text type="error" class="mt-2 mb-0" role="alert">{{ ui.error.message }}</v-alert>

		<!-- 1. the map: zone <-> bed <-> heater <-> sensor, and what is missing before anything can be tuned -->
		<div class="wf-sub">
			<div class="d-flex align-center" style="gap:4px"><h4>{{ tx('step_map') }}</h4><help-tip v-bind="help('map')" /></div>
			<div v-if="!rows.length" class="text-body-2 grey--text">{{ tx('map_empty') }}</div>
			<v-simple-table v-else dense class="bc-table">
				<thead><tr><th>{{ tx('col_zone') }}</th><th>{{ tx('col_bed') }}</th><th>{{ tx('col_heater') }}</th><th>{{ tx('col_sensor') }}</th><th>{{ tx('col_max') }}</th><th>{{ tx('col_model') }}</th></tr></thead>
				<tbody>
					<tr v-for="r in rows" :key="'m' + r.bed">
						<td>{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: r.n }) }}<span v-if="!r.active" class="grey--text text-caption"> · {{ $t('plugins.WorkshopPrinting.bedZones.inactive') }}</span></td>
						<td class="bc-mono">P{{ r.bed }}</td>
						<td class="bc-mono">{{ r.heater === null ? '--' : 'H' + r.heater }}</td>
						<td class="bc-mono">{{ r.sensor === null ? '--' : 'S' + r.sensor + (r.sensorName ? ' ' + r.sensorName : '') }}</td>
						<td class="bc-mono">{{ r.max === null ? '--' : r.max + ' °C' }}</td>
						<td><span class="wf-state" :class="r.problems.length ? 'warn' : 'ok'">{{ r.problems.length ? tx(r.problems[0]) : tx('map_ok') }}</span></td>
					</tr>
				</tbody>
			</v-simple-table>
		</div>

		<!-- 2. the order of heating, the stagger between starts, and the preheat the service does -->
		<div class="wf-sub">
			<div class="d-flex align-center" style="gap:4px"><h4>{{ tx('step_order') }}</h4><help-tip v-bind="help('order')" /></div>
			<div class="d-flex align-end flex-wrap" style="gap:12px">
				<wf-field id="bc-stagger" :label="tx('f_stagger')" :message="issueText('stagger')" level="error">
					<template #help><help-tip v-bind="help('stagger')" /></template>
					<v-text-field id="bc-stagger" v-model="stagger" dense outlined hide-details suffix="s" inputmode="numeric" style="max-width:120px" :aria-label="tx('f_stagger')" />
				</wf-field>
				<wf-field id="bc-hold" :label="tx('f_hold')" :message="issueText('hold')" level="error">
					<template #help><help-tip v-bind="help('hold')" /></template>
					<v-text-field id="bc-hold" v-model="hold" dense outlined hide-details suffix="min" inputmode="numeric" style="max-width:120px" :aria-label="tx('f_hold')" />
				</wf-field>
				<wf-field id="bc-temp-pre" :label="tx('f_temp')" :message="issueText('temp')" level="error">
					<template #help><help-tip v-bind="help('temp')" /></template>
					<v-text-field id="bc-temp-pre" v-model="temp" dense outlined hide-details suffix="°C" inputmode="decimal" style="max-width:120px" :aria-label="tx('f_temp')" />
				</wf-field>
			</div>
			<ol v-if="order.length" class="text-body-2 bc-order">
				<li v-for="o in order" :key="'o' + o.bed">{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: o.n }) }} (P{{ o.bed }}): {{ tx(o.reason) }}<span v-if="o.delay_s"> · {{ tx('order_after', { s: o.delay_s }) }}</span></li>
			</ol>
			<div v-else class="text-body-2 grey--text">{{ tx('order_empty') }}</div>
			<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
				<v-btn small color="amber darken-3" dark class="bc-start-preheat" :disabled="!!whyNot('preheat')" :loading="ui.step === 'planning' && ui.action && ui.action.kind === 'preheat'" @click="ask('preheat')">
					<v-icon small left>mdi-radiator</v-icon>{{ tx('start_preheat') }}
				</v-btn>
				<help-tip v-bind="help('start_preheat')" />
				<span v-if="whyNot('preheat')" class="text-caption grey--text">{{ whyNot('preheat') }}</span>
			</div>
			<bed-cal-run v-if="ui.view && ui.view.kind === 'preheat' && ui.step !== 'idle'" :view="ui.view" :stopping="ui.stopping" :numbers="numbers" @stop="stop()" @dismiss="dismiss()" />
			<bed-cal-gcode :lines="gcode.preheat.lines" :error="gcode.preheat.error" :loading="gcode.preheat.loading" @open="loadGcode('preheat')" />
		</div>

		<!-- 3. the tuning the service does: one zone or all in order, alone or with the neighbours held -->
		<div class="wf-sub">
			<div class="d-flex align-center" style="gap:4px"><h4>{{ tx('step_tune') }}</h4><help-tip v-bind="help('tune')" /></div>
			<div class="d-flex align-end flex-wrap" style="gap:12px">
				<wf-field id="bc-temp" :label="tx('f_temp')" :message="issueText('temp')" level="error">
					<template #help><help-tip v-bind="help('temp')" /></template>
					<v-text-field id="bc-temp" v-model="temp" dense outlined hide-details suffix="°C" inputmode="decimal" style="max-width:120px" :aria-label="tx('f_temp')" />
				</wf-field>
				<div class="help-tip-row d-flex align-center" style="gap:4px">
					<v-switch v-model="together" dense hide-details class="mt-0 pt-0" :label="tx('f_together')" :aria-label="tx('f_together')" />
					<help-tip v-bind="help('together')" />
				</div>
			</div>
			<div class="wf-note is-warn" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('tune_warn') }}</span></div>
			<div v-if="!tunableRows.length" class="text-body-2 grey--text">{{ tx('tune_empty') }}</div>
			<v-simple-table v-else dense class="bc-table mt-1">
				<tbody>
					<tr v-for="r in tunableRows" :key="'t' + r.bed">
						<td>{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: r.n }) }} <span class="bc-mono grey--text text-caption">(P{{ r.bed }} H{{ r.heater }})</span></td>
						<td><span class="wf-state" :class="r.problems.indexOf('map_no_model') < 0 ? 'ok' : 'warn'">{{ r.problems.indexOf('map_no_model') < 0 ? tx('tuned_yes') : tx('map_no_model') }}</span></td>
						<td class="text-right">
							<v-btn x-small outlined color="error" class="bc-tune-zone" :disabled="!!whyNot('tune')" :aria-label="tx('tune_zone_label', { n: r.n })" @click="ask('tune', [r.bed])">
								<v-icon x-small left>mdi-tune</v-icon>{{ tx('tune_zone') }}
							</v-btn>
						</td>
					</tr>
				</tbody>
			</v-simple-table>
			<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
				<v-btn small color="error" class="bc-tune-all" :disabled="!!whyNot('tune')" :loading="ui.step === 'planning' && ui.action && ui.action.kind === 'tune'" @click="ask('tune')">
					<v-icon small left>mdi-tune-variant</v-icon>{{ tx('tune_all') }}
				</v-btn>
				<help-tip v-bind="help('tune_run')" />
				<span v-if="whyNot('tune')" class="text-caption grey--text">{{ whyNot('tune') }}</span>
			</div>
			<bed-cal-run v-if="ui.view && ui.view.kind === 'tune' && ui.step !== 'idle'" :view="ui.view" :stopping="ui.stopping" :trace="trace" :numbers="numbers" @stop="stop()" @dismiss="dismiss()" />
			<bed-cal-gcode :lines="gcode.tune.lines" :error="gcode.tune.error" :loading="gcode.tune.loading" @open="loadGcode('tune')" />
		</div>

		<!-- 4. what the board holds now: the M307 of each heater and the M143 caps, saved through the plan with a backup -->
		<div class="wf-sub">
			<div class="d-flex align-center" style="gap:4px"><h4>{{ tx('step_models') }}</h4><help-tip v-bind="help('models')" /></div>
			<div v-if="!modelItems.length && !capItems.length" class="text-body-2 grey--text">{{ tx('models_empty') }}</div>
			<template v-if="modelItems.length">
				<div class="text-subtitle-2 mt-1">{{ tx('models_title') }}</div>
				<div v-for="m in modelItems" :key="'mo' + m.heater" class="text-body-2"><code class="bc-mono">{{ m.line }}</code></div>
				<bed-cal-save kind="config.heater_model" :heaters="modelItems.map(m => m.values)" :busy="ui.step === 'running'" />
			</template>
			<template v-if="capItems.length">
				<div class="text-subtitle-2 mt-3">{{ tx('limits_title') }}</div>
				<div v-for="c in capItems" :key="'li' + c.heater" class="text-body-2"><code class="bc-mono">{{ c.line }}</code><span v-if="c.fromSettings" class="grey--text text-caption"> · {{ tx('cap_from_settings') }}</span></div>
				<bed-cal-save kind="config.heater_cap" :heaters="capItems.map(c => ({ heater: c.heater, max: c.max }))" :busy="ui.step === 'running'" />
			</template>
		</div>

		<!-- 5. the thermal map: a thermometer reading per zone -> the offsets of the settings -->
		<div class="wf-sub">
			<div class="d-flex align-center" style="gap:4px"><h4>{{ tx('step_offsets') }}</h4><help-tip v-bind="help('offsets')" /></div>
			<div class="text-body-2">{{ tx('offsets_intro') }}</div>
			<div class="d-flex align-end flex-wrap" style="gap:12px">
				<wf-field v-for="r in measurable" :id="'bc-meas-' + r.bed" :key="'me' + r.bed" :label="tx('f_measured', { n: r.n })" :message="issueText('measured.' + r.bed)" level="error">
					<v-text-field :id="'bc-meas-' + r.bed" v-model="measured[r.bed]" dense outlined hide-details suffix="°C" inputmode="decimal" style="max-width:120px" :aria-label="tx('f_measured', { n: r.n })" />
				</wf-field>
			</div>
			<div v-if="map.ready" class="text-body-2">{{ tx('offsets_reference', { t: map.reference }) }}</div>
			<bed-cal-offsets :map="map" :config="config" :rev="rev" :why="offsetsWhy" @saved="onOffsetsSaved" @conflict="load()" />
		</div>

		<bed-cal-confirm v-if="ui.step === 'confirming' || ui.step === 'starting'" :kind="ui.action.kind" :plan="ui.plan" :numbers="numbers" :busy="ui.step === 'starting'" @cancel="cancel()" @confirm="confirm($event)" />
	</v-card>
</template>

<script>
'use strict'

// Calibration assistant of a multizone bed (Printing > Bed zones, under the map). The SERVICE does the work, with the person present: it heats the zones in the order
// computed here (bedcal.preheat), tunes them (bedcal.tune), turns every zone off at once on Stop (bedcal.stop) and saves the results through the plans with a backup
// (machine.config.plan / apply) or bedzones.set. The page sends no G-code and writes no file; every action that heats asks first, with a dialog that names the zones and
// the temperatures and says the person must stay (nothing is sent before it). The numbers are bed-calibration.js, the steps of an action bed-cal-run.js (pure, tested).
import { api } from './workshop-api.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import HelpGuide from './HelpGuide.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import WfField from './WfField.vue' // vue/_shared36
import BedCalRun from './BedCalRun.vue'
import BedCalConfirm from './BedCalConfirm.vue'
import BedCalGcode from './BedCalGcode.vue'
import BedCalSave from './BedCalSave.vue'
import BedCalOffsets from './BedCalOffsets.vue'
import { emptyConfig } from './bed-zones.js'
import { fromService } from './pid-trace.js'
import { zoneMap, heatingOrder, tunable, offsetsFromMap, inputIssues, modelValues, capValues, startArgs, DEFAULT_TUNE_TEMP, DEFAULT_STAGGER_S, DEFAULT_HOLD_MIN } from './bed-calibration.js'
import { initial, reduce, canAsk, planLines, runView, POLL_MS } from './bed-cal-run.js'

const HELP = ['map', 'order', 'stagger', 'hold', 'start_preheat', 'tune', 'tune_run', 'temp', 'together', 'models', 'offsets']
const noGcode = () => ({ lines: [], error: '', loading: false })

export default {
	mixins: [roleMixin],
	sessionData: ['measured'], // what the person who left typed stays nowhere (role-mixin.js)
	sessionErrors: ['failure'],
	components: { HelpGuide, HelpTip, ErrorNotice, WfField, BedCalRun, BedCalConfirm, BedCalGcode, BedCalSave, BedCalOffsets },
	data() {
		return {
			loaded: false, config: emptyConfig(), rev: '0', failure: null, temp: String(DEFAULT_TUNE_TEMP), stagger: String(DEFAULT_STAGGER_S), hold: String(DEFAULT_HOLD_MIN), together: true, measured: {},
			ui: initial(), trace: null, timer: null, destroyed: false, gcode: { preheat: noGcode(), tune: noGcode() }
		}
	},
	computed: {
		model() {
			return this.$store.state.machine.model
		},
		rows() {
			return this.loaded ? zoneMap(this.model, this.config) : []
		},
		numbers() {
			const out = {}
			this.rows.forEach(r => { out[r.bed] = r.n })
			return out
		},
		measurable() {
			return this.rows.filter(r => r.heater !== null)
		},
		tunableRows() {
			return tunable(this.rows)
		},
		opts() {
			return { temp: this.temp, stagger: this.stagger, hold: this.hold, together: this.together, measured: this.measured }
		},
		issues() {
			return inputIssues(this.opts)
		},
		order() {
			return this.issues.some(i => i.field === 'stagger') ? [] : heatingOrder(this.rows, this.config.layout, this.stagger)
		},
		map() {
			return offsetsFromMap(this.rows, this.measured, this.config.max_offset)
		},
		modelItems() {
			return modelValues(this.rows)
		},
		capItems() {
			return capValues(this.rows, this.config.max_temp)
		},
		machineIdle() {
			const st = this.model && this.model.state && this.model.state.status
			return !st || st === 'idle'
		},
		offsetsWhy() {
			return this.canDo('bedzones.set') ? '' : this.lockTextOp('bedzones.set', 'technician')
		}
	},
	mounted() {
		this.load()
		this.poll() // a run the service has in progress is picked up again after a reload
	},
	beforeDestroy() {
		this.destroyed = true
		clearTimeout(this.timer)
	},
	methods: {
		tx(key, params) {
			return this.$t('plugins.WorkshopPrinting.bedCal.' + key, params || {})
		},
		help(k) {
			return HELP.indexOf(k) < 0 ? {} : { title: this.tx('help_' + k + '_title'), what: this.tx('help_' + k + '_what'), why: this.tx('help_' + k + '_why'), ifMissing: this.tx('help_' + k + '_miss'), how: this.tx('help_' + k + '_how') }
		},
		onSessionChange() {
			this.load()
			this.poll()
		},
		issueText(field) {
			const it = this.issues.find(i => i.field === field)
			return it ? this.tx(it.key) : ''
		},
		// why a button that heats is off ('' = it is on): the role, a wrong number, nothing to do, the machine not idle, another action
		whyNot(kind) {
			const op = kind === 'tune' ? 'bedcal.tune' : 'bedcal.preheat'
			if (!(kind === 'tune' ? this.canDo('bedcal.tune') : this.canDo('bedcal.preheat'))) return this.lockTextOp(op, 'technician')
			const bad = this.issues.find(i => i.field === 'temp' || (kind === 'preheat' && (i.field === 'stagger' || i.field === 'hold')))
			if (bad) return this.tx(bad.key)
			if (kind === 'tune' ? !this.tunableRows.length : !this.order.length) return this.tx(kind === 'tune' ? 'tune_empty' : 'order_empty')
			if (!this.machineIdle) return this.tx('why_not_idle')
			if (!canAsk(this.ui)) return this.tx('why_running')
			return ''
		},
		// the same settings the Bed zones section reads (zones, offsets, caps, geometry); the service is the owner, this only reads
		async load() {
			try {
				const g = await api('bedzones.get', {}, { quiet: true })
				this.config = g.config
				this.rev = String(g.rev)
				this.failure = null
				this.loaded = true
			} catch (e) {
				this.failure = e
			}
		},
		onOffsetsSaved(r) {
			if (r && r.config) this.config = r.config
			if (r && r.rev) this.rev = String(r.rev)
		},
		// ---- an action that heats: plan (reads) -> dialog (nothing sent) -> confirmation -> the service starts ----
		async ask(kind, only) {
			if (this.whyNot(kind)) return
			const args = startArgs(kind, this.rows, this.config, this.opts, only)
			this.ui = reduce(this.ui, { type: 'ask', action: { kind, args } })
			if (this.ui.step !== 'planning') return
			try {
				const plan = await api('bedcal.plan', Object.assign({ kind }, args), { quiet: true })
				this.ui = reduce(this.ui, { type: 'plan', plan })
			} catch (e) {
				this.ui = reduce(this.ui, { type: 'plan_failed', error: { message: (e && e.message) || String(e) } })
			}
		},
		cancel() {
			this.ui = reduce(this.ui, { type: 'cancel' })
		},
		async confirm(stays) {
			this.ui = reduce(this.ui, { type: 'confirm', stays })
			if (this.ui.step !== 'starting') return
			const { kind, args } = this.ui.action
			try {
				await api('bedcal.' + kind, args, { confirm: true }) // the dialog above is the confirmation (it named the zones and said to stay)
				this.ui = reduce(this.ui, { type: 'started' })
				this.trace = null
				this.poll()
			} catch (e) {
				this.ui = reduce(this.ui, { type: 'start_failed', error: { message: (e && e.message) || String(e) } })
			}
		},
		dismiss() {
			this.ui = reduce(this.ui, { type: 'dismiss' })
			this.trace = null
		},
		// Stop: ends the run and turns EVERY zone off at once. Never blocked.
		async stop() {
			this.ui = reduce(this.ui, { type: 'stop' })
			try {
				await api('bedcal.stop', {}, { noLogin: true })
			} catch (e) {
				this.ui = Object.assign({}, this.ui, { error: { message: this.tx('stop_failed', { error: (e && e.message) || String(e) }) } })
			}
			this.poll()
		},
		async poll() {
			if (this.destroyed) return
			clearTimeout(this.timer)
			try {
				const status = await api('bedcal.status', {}, { quiet: true, noLogin: true })
				this.ui = reduce(this.ui, { type: 'status', status })
				const view = runView(status)
				if (view.active && view.kind === 'tune') this.readTrace(view)
				if (view.active) this.timer = setTimeout(() => this.poll(), POLL_MS)
			} catch (e) {
				if (this.ui.step === 'running') this.timer = setTimeout(() => this.poll(), POLL_MS) // a lost answer is not the end of the run: ask again
			}
		},
		// the chart of the tuning is the one of the PID page: the service samples whichever heater is in `tuning`
		async readTrace(view) {
			try {
				const r = await api('pid.trace', {}, { quiet: true, noLogin: true })
				const raw = r && r.trace
				const z = raw ? view.zones.find(x => x.heater === raw.heater) : null
				this.trace = fromService(raw, z ? this.$t('plugins.WorkshopPrinting.bedZones.zone_n', { n: this.numbers[z.bed] || z.bed + 1 }) : '', z ? z.target : 0)
			} catch (e) {
				/* the chart keeps what it had */
			}
		},
		// "show the G-code this does": the plan of the service for the current numbers (a read: nothing is sent)
		async loadGcode(kind) {
			if (!this.rows.length) return
			const slot = this.gcode[kind]
			slot.loading = true
			slot.error = ''
			try {
				const plan = await api('bedcal.plan', Object.assign({ kind }, startArgs(kind, this.rows, this.config, this.opts)), { quiet: true })
				slot.lines = planLines(plan)
			} catch (e) {
				slot.lines = []
				slot.error = (e && e.message) || String(e)
			} finally {
				slot.loading = false
			}
		}
	}
}
</script>

<style scoped>
.bc-mono { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
.bc-order { padding-left: 20px; margin: 0; }
.bc-table th { font-size: 11px; text-transform: uppercase; }
</style>
