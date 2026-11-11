<template>
	<div class="bz-page">
		<error-notice v-if="failure" :error="failure" :action="$t('plugins.WorkshopPrinting.bedZones.acting')" retry class="mb-3" @retry="load()" />

		<!-- first step: the board has no bed, so there is nothing to set or watch yet. Define the zone first (name, heater, size of the limit), then the rest of the page appears -->
		<v-card v-if="showSetup && loaded && definition.needed" outlined class="pa-4 mb-3 bz-define">
			<div class="text-subtitle-1 font-weight-medium">{{ $t('plugins.WorkshopPrinting.bedZones.define_title') }}</div>
			<p class="text-body-2 mt-1 mb-2">{{ $t('plugins.WorkshopPrinting.bedZones.define_body') }}</p>
			<ol class="text-body-2 mb-3">
				<li>{{ $t('plugins.WorkshopPrinting.bedZones.define_step_name') }}</li>
				<li>{{ $t('plugins.WorkshopPrinting.bedZones.define_step_heater') }}</li>
				<li>{{ $t('plugins.WorkshopPrinting.bedZones.define_step_size') }}</li>
			</ol>
			<v-btn v-if="machineActive && canConfigure" color="primary" @click="defineFirst()"><v-icon left>mdi-plus-circle-outline</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.define_btn') }}</v-btn>
			<div v-else class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.bedZones.define_blocked') }}</div>
		</v-card>

		<!-- live part: the zones are defined in the setup section -->
		<div v-if="!showSetup && loaded && definition.needed" class="wf-note mb-3" role="note">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.live_define_note') }}</span>
			<v-btn v-if="canConfigure" small color="primary" class="ml-3" @click="$emit('goto', { section: 'bedsetup' })">{{ $t('plugins.WorkshopPrinting.bedZones.live_define_go') }}</v-btn>
		</div>

		<template v-if="!definition.needed">
		<div v-if="loaded && !config.enabled" class="wf-note is-warn mb-3" role="note">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.off_note') }}</span>
		</div>
		<div v-if="problems.length" class="wf-note is-warn mb-3" role="note">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.problems_note') }} {{ problems[0] }}</span>
		</div>
		<div v-if="loaded && check.missing.length" class="wf-note is-warn mb-3" role="note">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.board_note', { board: check.board, beds: check.missing.join(', ') }) }}</span>
		</div>

		<!-- the beds the board does not define are defined in Machine (its plan: exact lines, backup, history); this page writes no heater line -->
		<v-card v-if="showSetup && loaded && check.missing.length && machineActive && canConfigure" outlined class="pa-3 mb-3">
			<div class="text-body-2">{{ $t('plugins.WorkshopPrinting.bedZones.machine_note', { beds: check.missing.join(', ') }) }}</div>
			<v-btn small color="primary" class="mt-2" @click="openMachine()"><v-icon small left>mdi-open-in-new</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.open_machine') }}</v-btn>
		</v-card>

		<div v-if="showSetup && preview" class="wf-note mb-3" role="note">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-eye-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.preview_note') }}</span>
		</div>

		<!-- a bed the board defines that no zone covers: offered here (one tap), not left invisible -->
		<div v-if="showSetup && loaded && unassigned.length" class="wf-note mb-3" role="note">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.unassigned_note', { beds: unassigned.join(', ') }) }}</span>
			<v-btn v-if="canConfigure" small color="primary" class="ml-3" :loading="busy === 'adopt'" @click="adoptBeds()">{{ $t('plugins.WorkshopPrinting.bedZones.unassigned_add') }}</v-btn>
		</div>

		<!-- setpoint of the whole bed: heating is level 2, so the button is armed with a second tap (DESIGN.md 5) -->
		<v-card v-if="showLive" outlined class="pa-3 mb-3">
			<div class="d-flex align-end flex-wrap" style="gap:12px">
				<wf-field id="bz-global" :label="$t('plugins.WorkshopPrinting.bedZones.global_setpoint')" :message="globalError" level="error">
					<template #help><help-tip :title="$t('plugins.WorkshopPrinting.bedZones.global_setpoint')" :what="$t('plugins.WorkshopPrinting.bedZones.help.global_what')" :why="$t('plugins.WorkshopPrinting.bedZones.help.global_why')" :if-missing="$t('plugins.WorkshopPrinting.bedZones.help.global_miss')" :how="$t('plugins.WorkshopPrinting.bedZones.help.global_how')" /></template>
					<v-text-field id="bz-global" v-model="globalText" dense outlined hide-details suffix="°C" inputmode="decimal" style="max-width:140px" :aria-label="$t('plugins.WorkshopPrinting.bedZones.global_setpoint')" @keydown.enter.prevent="touch('all', null, globalText)" />
				</wf-field>
				<v-btn small :color="armed === 'all' ? 'amber darken-3' : 'primary'" :loading="busy === 'all'" :disabled="!canSend || globalValue === null" @click="touch('all', null, globalText)">
					<v-icon small left>mdi-fire</v-icon>{{ armed === 'all' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.bedZones.heat_all') }}
				</v-btn>
				<!-- turning off is safe (level 1): one tap -->
				<v-btn small outlined :loading="busy === 'off'" :disabled="!canStop" @click="turnOff()">
					<v-icon small left>mdi-snowflake</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.off_all') }}
				</v-btn>
			</div>
			<lock-reason v-if="!canSend" :min="needOperate" class="mt-2" />
			<div v-if="!isFff" class="text-caption grey--text mt-2">{{ $t('plugins.WorkshopPrinting.bedZones.needs_fff') }}</div>
			<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
		</v-card>

		<v-row dense>
			<v-col cols="12" :md="edit ? 12 : (showSetup ? 6 : 5)">
				<v-card outlined class="pa-3 fill-height">
					<!-- the geometry is edited HERE (setup part), on the map that shows the temperatures: Edit turns the map and the table into the editor (technician) -->
					<div v-if="showSetup && canConfigure && !edit" class="d-flex align-center flex-wrap mb-2" style="gap:8px">
						<v-btn small outlined class="bz-edit-btn" :disabled="!!preview" @click="startEditing()">
							<v-icon small left>mdi-pencil</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_edit') }}
						</v-btn>
						<span v-if="preview" class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_edit_blocked') }}</span>
					</div>
					<div :class="{ 'bz-edit-body': edit }">
						<bed-zone-map
							:rows="rows" :layout="shown.layout" :geometry="shown.geometry || null" :max-temp="shown.max_temp" :selected="selected" :editable="!!edit && !!shown.geometry"
							:selection="edit ? edit.selection : []" :reference="edit ? edit.reference : null" :step="edit && edit.snap ? 5 : 0" :guides="!edit || edit.guides !== false" :ghosts="ghosts"
							@select="selected = selected === $event ? null : $event" @pick="onAct({ type: 'pick', index: $event.index, multi: $event.multi })" @clear="onAct({ type: 'clear' })"
							@begin="onAct({ type: 'begin' })" @rect="onAct({ type: 'rect', index: $event.index, rect: $event.rect })"
						/>
						<bed-zone-editor v-if="showSetup && edit" :edit="edit" :problems="editIssues" :max="zonesMax" :model="model" :dirty="editDirty" :saving="editSaving" :server-errors="editErrors" :plan="arrange" @act="onAct" @save="saveEdit()" @cancel="stopEditing()" />
					</div>
				</v-card>
			</v-col>
			<v-col v-if="showLive || edit" cols="12" :md="edit ? 12 : 7">
				<v-card outlined class="pa-3 fill-height">
					<v-simple-table dense class="bz-table">
						<thead>
							<tr>
								<th v-if="edit" class="bz-pick" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_col_pick')" />
								<th>{{ $t('plugins.WorkshopPrinting.bedZones.col_zone') }}</th>
								<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.col_now') }}</th>
								<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.col_target') }}</th>
								<th>{{ $t('plugins.WorkshopPrinting.bedZones.col_state') }}</th>
								<th>{{ $t('plugins.WorkshopPrinting.bedZones.col_set') }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="r in rows" :key="r.bed" :class="{ 'bz-selected': isRowSelected(r), 'bz-inactive': !r.active }" @click="clickRow(r)">
								<td v-if="edit" class="bz-pick" @click.stop>
									<v-checkbox dense hide-details class="mt-0 pt-0" :input-value="edit.selection.indexOf(r.n - 1) >= 0" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_pick_zone', { n: r.n })" @change="onAct({ type: 'pick', index: r.n - 1, multi: true })" />
								</td>
								<td>
									{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: r.n }) }}
									<span class="grey--text text-caption">P{{ r.bed }}<template v-if="r.offset"> · {{ r.offset > 0 ? '+' : '' }}{{ r.offset }} °C</template></span>
									<span v-if="!r.active" class="grey--text text-caption"> · {{ $t('plugins.WorkshopPrinting.bedZones.inactive') }}</span>
								</td>
								<td class="text-right bz-num">{{ fmt(r.current) }} °C</td>
								<td class="text-right bz-num">{{ r.target > 0 ? fmt(r.target) + ' °C' : $t('plugins.WorkshopPrinting.common.off') }}</td>
								<td>
									<span class="bz-dot" :style="{ background: r.color }" aria-hidden="true" />{{ stateText(r) }}
									<v-icon v-if="r.alert" small color="error" class="ml-1" :title="alertText(r)" :aria-label="alertText(r)">mdi-alert-outline</v-icon>
								</td>
								<td @click.stop>
									<div class="d-flex align-center" style="gap:4px">
										<v-text-field v-model="zoneText[r.bed]" dense outlined hide-details suffix="°C" inputmode="decimal" class="bz-zone-field" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zone_setpoint', { n: r.n })" @keydown.enter.prevent="touch('z' + r.bed, r.bed, zoneText[r.bed])" />
										<v-btn x-small :color="armed === 'z' + r.bed ? 'amber darken-3' : undefined" :outlined="armed !== 'z' + r.bed" :loading="busy === 'z' + r.bed" :disabled="!canSend || zoneValue(r.bed) === null" @click="touch('z' + r.bed, r.bed, zoneText[r.bed])">
											{{ armed === 'z' + r.bed ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.bedZones.set') }}
										</v-btn>
									</div>
								</td>
							</tr>
						</tbody>
					</v-simple-table>
					<div v-for="r in alerting" :key="'a' + r.bed" class="text-caption error--text mt-1">{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: r.n }) }}: {{ alertText(r) }}</div>
				</v-card>
			</v-col>
		</v-row>

		<v-card v-if="showLive && chartSeries.length" outlined class="pa-3 mt-3">
			<div class="text-subtitle-2 mb-1">{{ $t('plugins.WorkshopPrinting.bedZones.chart_title') }}</div>
			<chart-state :series="chartSeries" :samples="samples" />
		</v-card>

		<!-- what the geometry says: the power estimate and the insulation test (both read only; every input is optional) -->
		<v-row v-if="showSetup && loaded && shown.geometry && !edit" dense class="mt-3">
			<v-col cols="12" md="6"><v-card outlined class="pa-3 fill-height"><bed-zone-power :rows="rows" :inputs="powerInputs" @change="setPower" /></v-card></v-col>
			<v-col cols="12" md="6"><v-card outlined class="pa-3 fill-height"><bed-zone-insulation :rows="rows" :inputs="powerInputs" :runs="runs" @runs="setRuns" /></v-card></v-col>
		</v-row>

		<!-- settings: only a technician (the limits are the safety of the bed) -->
		<v-card v-if="showSetup && canConfigure && !edit" outlined class="pa-3 mt-3">
			<div class="d-flex align-center" style="gap:4px">
				<div class="text-subtitle-1 font-weight-medium">{{ $t('plugins.WorkshopPrinting.bedZones.settings_title') }}</div>
				<help-tip :title="$t('plugins.WorkshopPrinting.bedZones.settings_title')" :what="$t('plugins.WorkshopPrinting.bedZones.help.settings_what')" :why="$t('plugins.WorkshopPrinting.bedZones.help.settings_why')" :if-missing="$t('plugins.WorkshopPrinting.bedZones.help.settings_miss')" :how="$t('plugins.WorkshopPrinting.bedZones.help.settings_how')" />
			</div>
			<bed-zones-config v-if="loaded" class="mt-3" :config="config" :rev="rev" @saved="saved" @reload="load()" @preview="preview = $event" />
		</v-card>
		<lock-reason v-else-if="showSetup && loaded && canSend" :min="needConfigure" class="mt-3" />
		</template>
	</div>
</template>

<script>
'use strict'

// The "Bed zones" section of the 3D printing page: a map of the bed colored by temperature, the setpoint of the whole bed and of each zone, the state
// and alerts of every zone, the temperature chart and (technician) the settings. The temperatures are read from the object model DWC keeps; the service
// (dsf/bed_zones*.py, ops bedzones.*) does the heating and the M140 / M190 split: this page only asks.
import { api } from './workshop-api.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import { NEED } from './print-sections.js'
import { reduce, startEdit, editProblems, editDirty, arrangePlan } from './bed-zones-edit.js'
import { zoneRows, alertKey, zoneSeries, setpointOf, boardCheck, unassignedBeds, withBeds, fmtTemp, emptyConfig, machineBedsRoute, zoneLimit, firstDefinition } from './bed-zones.js'
import BedZoneMap from './BedZoneMap.vue'
import BedZonesConfig from './BedZonesConfig.vue'
import BedZoneEditor from './BedZoneEditor.vue'
import BedZonePower from './BedZonePower.vue'
import BedZoneInsulation from './BedZoneInsulation.vue'
import { pluginActive } from './workshop-ids.js' // vue/_shared36: Machine is another plugin, nothing about it when it is absent
import ChartState from './ChartState.vue'
import WfField from './WfField.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36

const POWER_KEY = 'workshop.bedzones.power' // what the first version kept in the browser: uploaded to the service once, then removed
const RUNS_KEY = 'workshop.bedzones.insulation'
const POWER_FIELDS = ['ambient', 'target', 'thickness', 'material', 'density', 'cp', 'power', 'minutes', 'cover']

const emptyPower = () => ({ ambient: '', target: '', thickness: '', material: '', density: '', cp: '', power: '', minutes: '', cover: false })
// the inputs as the form holds them (text, '' = not given) from what the service keeps (numbers / null)
const textOf = v => (v === null || v === undefined ? '' : String(v))

// What the first version of the cards kept in this browser, or null when there is nothing
function oldBrowserData() {
	try {
		const power = JSON.parse(window.localStorage.getItem(POWER_KEY) || 'null')
		const runs = JSON.parse(window.localStorage.getItem(RUNS_KEY) || 'null')
		return power || runs ? { inputs: Object.assign(emptyPower(), power || {}), runs: { before: (runs && runs.before) || null, after: (runs && runs.after) || null } } : null
	} catch (e) {
		return null
	}
}

export default {
	mixins: [roleMixin],
	// what the person who left read, did or was refused stays nowhere (role-mixin.js)
	sessionData: ['armed', 'msg', 'msgKind', 'edit', 'editErrors'],
	sessionErrors: ['failure', 'msg', 'msgKind'],
	components: { BedZoneMap, BedZoneEditor, BedZonePower, BedZoneInsulation, BedZonesConfig, ChartState, WfField, HelpTip, ErrorNotice, LockReason },
	props: {
		series: { type: Array, default: () => [] }, // seriesChart of Print.vue (one per heater, the color follows the heater)
		samples: { type: Array, default: () => [] }, // the 10 minute history of Print.vue
		isFff: { type: Boolean, default: true },
		// which part of the page to show (the printing page mounts it twice): 'live' = the map, the setpoints, the zone table and the chart (what
		// is done while printing); 'setup' = the layout editor on the map, the power estimate, the insulation test and the settings (a technician);
		// anything else = the whole page
		part: { type: String, default: 'all' }
	},
	data() {
		return {
			loaded: false, config: emptyConfig(), preview: null, rev: '0', problems: [], detected: [], failure: null,
			powerInputs: emptyPower(), runs: { before: null, after: null }, estRev: '0', edit: null, editSaving: false, editErrors: [], selected: null, globalText: '60', zoneText: {}, armed: null, armedTimer: null, busy: null, msg: null, msgKind: 'info'
		}
	},
	computed: {
		showLive() {
			return this.part !== 'setup'
		},
		showSetup() {
			return this.part !== 'live'
		},
		model() {
			return this.$store.state.machine.model
		},
		// what the page shows: the form being edited (valid) before it is saved, else the saved configuration
		shown() {
			return this.edit ? this.edit.config : this.preview || this.config
		},
		editIssues() {
			return this.edit ? editProblems(this.edit) : []
		},
		// the tidy-up preview: what it would do now (the panel lists it) and where each zone would go (the map draws it); [] when there is nothing to show
		arrange() {
			return this.edit ? arrangePlan(this.edit) : null
		},
		ghosts() {
			return this.arrange && this.arrange.fits && this.arrange.changed ? this.arrange.rects : []
		},
		editDirty() {
			return !!this.edit && editDirty(this.edit, this.config)
		},
		// the zones THIS board supports (its own bed heaters), not a fixed number
		zonesMax() {
			return zoneLimit(this.model)
		},
		rows() {
			return zoneRows(this.model, this.shown)
		},
		alerting() {
			return this.rows.filter(r => r.alert)
		},
		unassigned() {
			return unassignedBeds(this.model, this.config)
		},
		// no bed on the board yet: the page offers to DEFINE the first zone instead of empty set / watch controls
		definition() {
			return this.loaded ? firstDefinition(this.model, this.detected, this.config) : { needed: false, beds: [] }
		},
		check() {
			return boardCheck(this.detected, this.config)
		},
		chartSeries() {
			return zoneSeries(this.rows, this.series, r => this.$t('plugins.WorkshopPrinting.bedZones.zone_n', { n: r.n }))
		},
		needOperate() {
			return NEED.operate
		},
		needConfigure() {
			return NEED.configure
		},
		canSend() {
			return this.isFff && this.canDo('bedzones.setpoint')
		},
		canStop() {
			return this.canDo('bedzones.off')
		},
		canConfigure() {
			return this.canDo('bedzones.set')
		},
		machineActive() {
			return pluginActive(this.$store, 'machine')
		},
		globalValue() {
			return setpointOf(this.globalText, this.config.max_temp)
		},
		globalError() {
			return this.globalText !== '' && this.globalValue === null ? this.$t('plugins.WorkshopPrinting.bedZones.err_setpoint', { max: this.config.max_temp }) : ''
		}
	},
	mounted() {
		this.load()
		this.loadEstimates()
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer)
	},
	methods: {
		fmt: fmtTemp,
		onSessionChange() {
			this.load()
			this.loadEstimates()
		},
		zoneValue(bed) {
			return setpointOf(this.zoneText[bed], this.config.max_temp)
		},
		stateText(r) {
			if (r.missing) return this.$t('plugins.WorkshopPrinting.bedZones.not_defined')
			return r.cls === 'fault' ? this.$t('plugins.WorkshopPrinting.fff.heat_fault') : this.$t('plugins.WorkshopPrinting.fff.heat_' + r.cls)
		},
		alertText(r) {
			const k = alertKey(r)
			return k ? this.$t('plugins.WorkshopPrinting.bedZones.' + k, { tol: this.shown.tolerance }) : ''
		},
		async load() {
			try {
				const g = await api('bedzones.get', {}, { quiet: true })
				this.config = g.config
				this.rev = g.rev
				this.problems = (g.problems || []).map(p => p.message)
				this.detected = g.detected || []
				this.failure = null
				this.loaded = true
			} catch (e) {
				this.failure = e
			}
		},
		saved(out) {
			this.preview = null
			this.config = out.config
			this.rev = out.rev
			this.problems = []
			this.say('success', this.$t('plugins.WorkshopPrinting.bedZones.saved'))
		},
		say(kind, text) {
			this.msgKind = kind
			this.msg = text
		},
		// heating is level 2: the first tap arms the button (amber, 4 s), the second sends
		touch(id, bed, text) {
			const t = setpointOf(text, this.config.max_temp)
			if (t === null || !this.canSend) return
			if (this.armed !== id) {
				this.armed = id
				clearTimeout(this.armedTimer)
				this.armedTimer = setTimeout(() => { this.armed = null }, 4000)
				return
			}
			this.armed = null
			this.heat(id, bed, t)
		},
		async heat(id, bed, t) {
			this.busy = id
			this.failure = null
			try {
				await api('bedzones.setpoint', bed === null ? { temperature: t } : { temperature: t, zone: bed })
				this.say('success', bed === null ? this.$t('plugins.WorkshopPrinting.bedZones.sent_all', { t }) : this.$t('plugins.WorkshopPrinting.bedZones.sent_zone', { n: this.numberOf(bed), t }))
			} catch (e) {
				if (!e || e.code !== 'cancelled') this.fail(e)
			} finally {
				this.busy = null
			}
		},
		async turnOff() {
			this.busy = 'off'
			this.failure = null
			try {
				await api('bedzones.off', {})
				this.say('success', this.$t('plugins.WorkshopPrinting.bedZones.sent_off'))
			} catch (e) {
				if (!e || e.code !== 'cancelled') this.fail(e)
			} finally {
				this.busy = null
			}
		},
		async adoptBeds() {
			this.busy = 'adopt'
			this.failure = null
			try {
				this.saved(await api('bedzones.set', { config: withBeds(this.config, this.unassigned), base_rev: this.rev }))
			} catch (e) {
				if (e && e.code === 'conflict') this.load()
				else if (!e || e.code !== 'cancelled') this.fail(e)
			} finally {
				this.busy = null
			}
		},
		defineFirst() {
			const route = machineBedsRoute(this.definition.beds, zoneLimit(this.model))
			if (route && this.$router) this.$router.push(route).catch(() => {})
		},
		openMachine() {
			const route = machineBedsRoute(this.check.missing, zoneLimit(this.model))
			if (route && this.$router) this.$router.push(route).catch(() => {})
		},
		isRowSelected(r) {
			return this.edit ? this.edit.selection.indexOf(r.n - 1) >= 0 : this.selected === r.bed
		},
		clickRow(r) {
			if (this.edit) this.onAct({ type: 'pick', index: r.n - 1, multi: false })
			else this.selected = this.selected === r.bed ? null : r.bed
		},
		// ---- editing the geometry (the state and its steps live in bed-zones-edit.js) ----
		startEditing() {
			if (this.preview || this.edit) return
			this.editErrors = []
			this.edit = startEdit(this.config, this.model)
		},
		stopEditing() {
			this.edit = null
			this.editErrors = []
		},
		onAct(action) {
			if (this.edit && !this.editSaving) this.edit = reduce(this.edit, action, { max: this.zonesMax, model: this.model })
		},
		// the same save as the settings form: the whole configuration with the revision it was read at; the service validates again
		async saveEdit() {
			if (!this.edit || this.editIssues.length || this.editSaving) return
			this.editSaving = true
			this.editErrors = []
			try {
				const out = await api('bedzones.set', { config: this.edit.config, base_rev: this.rev })
				this.edit = null
				this.saved(out)
			} catch (e) {
				if (e && e.code === 'cancelled') return
				const list = e && e.body && e.body.error && e.body.error.errors
				if (Array.isArray(list)) this.editErrors = list.map(x => x.message)
				else this.failure = e
				if (e && e.code === 'conflict') this.load()
			} finally {
				this.editSaving = false
			}
		},
		// the optional data of the power card and the insulation runs live in the service (bedestimates.*): one value for every screen. Whoever may not write
		// (below technician) still sees and uses what is saved; what that person types lasts until the page closes.
		async loadEstimates() {
			try {
				const g = await api('bedestimates.get', {}, { quiet: true })
				this.estRev = g.rev
				const old = g.rev === '0' ? oldBrowserData() : null
				if (old) {
					this.powerInputs = old.inputs
					this.runs = old.runs
					if (this.canDo('bedestimates.set') && await this.saveEstimates()) this.forgetBrowserData()
					return
				}
				this.powerInputs = Object.assign(emptyPower(), ...POWER_FIELDS.map(k => ({ [k]: k === 'cover' ? !!g.inputs[k] : textOf(g.inputs[k]) })))
				this.runs = { before: g.insulation.before || null, after: g.insulation.after || null }
			} catch (e) { /* the service does not answer (or has no such data yet): the cards work with what is typed */ }
		},
		forgetBrowserData() {
			try { window.localStorage.removeItem(POWER_KEY); window.localStorage.removeItem(RUNS_KEY) } catch (e) { /* nothing kept */ }
		},
		async saveEstimates() {
			if (!this.canDo('bedestimates.set')) return false
			try {
				const out = await api('bedestimates.set', { inputs: this.powerInputs, insulation: this.runs }, { quiet: true })
				this.estRev = out.rev
				return true
			} catch (e) {
				return false
			}
		},
		setPower(e) {
			if (POWER_FIELDS.indexOf(e.key) < 0) return
			this.powerInputs = Object.assign({}, this.powerInputs, { [e.key]: e.value })
			this.saveEstimates()
		},
		setRuns(runs) {
			this.runs = runs
			this.saveEstimates()
		},
		numberOf(bed) {
			const r = this.rows.find(x => x.bed === bed)
			return r ? r.n : bed
		},
		// a refusal of the service (limit, unknown zone) says why in its own words; a missing session / role / service goes to ErrorNotice
		fail(e) {
			if (e && e.code === 'invalid_args') this.say('error', e.message)
			else this.failure = e
		}
	}
}
</script>

<style scoped>
.bz-table tbody tr { cursor: pointer; }
.bz-table tbody tr.bz-selected { background: var(--wf-soft, rgba(128, 128, 128, 0.07)); }
.bz-table tbody tr.bz-inactive { opacity: 0.6; }
.bz-num { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
.bz-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.bz-zone-field { max-width: 96px; }
.bz-pick { width: 44px; padding-right: 0 !important; }
.bz-edit-btn.v-btn { min-height: 44px; }
.bz-edit-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 719px) {
	.bz-edit-body { grid-template-columns: minmax(0, 1fr); }
}
</style>
