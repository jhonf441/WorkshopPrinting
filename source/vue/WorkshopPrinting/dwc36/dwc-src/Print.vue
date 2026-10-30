<template>
	<v-container fluid class="pa-0 workshop-theme impresion-page pc-page">
		<page-header icon="mdi-printer-3d-nozzle" :title="$t('plugins.WorkshopPrinting.common.3d_printing')" lead="plugins.WorkshopPrinting.printing.page_lead" :reasons="headerReasons" :loading="!mode">
			<v-chip small :color="isFff ? 'success' : 'warning'" outlined>{{ $t('plugins.WorkshopPrinting.printing.mode_name', { mode: mode || '...' }) }}</v-chip>
			<v-chip v-if="tool" small outlined>{{ tool.name || ('T' + tool.number) }}</v-chip>
			<template v-slot:startup><startup-panel plugin="WorkshopPrinting" :defs="noStartupRows" @state="startupPending = $event.pending" /></template>
		</page-header>
				<!-- Outside FFF (2026-10-10: "that it asks to activate or change mode to be used"):
				     clear notice, what it changes and the button to change (double tap, only at rest) -->
				<v-card v-if="!isFff && mode" outlined class="mb-3 pa-3 banner-mode">
					<div class="d-flex align-center flex-wrap" style="gap:8px">
						<v-icon color="warning">mdi-swap-horizontal-bold</v-icon>
						<span class="text-subtitle-1 font-weight-medium">{{ $t('plugins.WorkshopPrinting.printing.3d_printing_needs_fff_mode') }}</span>
						<v-chip x-small outlined>{{ $t('plugins.WorkshopPrinting.printing.now_mode', { mode: mode }) }}</v-chip>
					</div>
					<div class="text-body-2 mt-2">
						{{ $t('plugins.WorkshopPrinting.printing.fff_mode_explain', { mode: mode }) }}
					</div>
					<div class="text-body-2 mt-1">
						<b>{{ $t('plugins.WorkshopPrinting.printing.is_the_extruder_already_mounted') }}</b> {{ $t('plugins.WorkshopPrinting.printing.change_mode_with_the_button') }} <b>{{ mode === 'CNC' ? $t('plugins.WorkshopPrinting.printing.is_spindle_still_mounted') : $t('plugins.WorkshopPrinting.printing.is_laser_still_mounted') }}</b>
						{{ ' ' }}<template v-if="canConfig">{{ $t('plugins.WorkshopPrinting.printing.use') }} <a href="#" @click.prevent="section = 'head'">{{ $t('plugins.WorkshopPrinting.printing.head_change') }}</a>{{ $t('plugins.WorkshopPrinting.printing.it_guides_you_to_remove_it') }}</template>
					</div>
					<!-- changing the mode is a technician's (F3-P): the others are told whom to ask instead of getting a button -->
					<v-alert v-if="!canConfig" dense text type="info" class="mt-3 mb-0 ask-technician">{{ $t('plugins.WorkshopPrinting.printing.ask_technician_fff') }}</v-alert>
					<div v-else class="d-flex align-center flex-wrap mt-3" style="gap:8px">
						<!-- changes the machine's configuration: amber double tap (DESIGN.md 5) -->
						<v-btn small :color="armed === 'mode' ? 'amber darken-3' : 'primary'" :disabled="!!reasonNoMode" @click="arm('mode', changeAfff)">
							<v-icon small left>mdi-printer-3d-nozzle</v-icon>{{ armed === 'mode' ? $t('plugins.WorkshopPrinting.printing.tap_again_switch_to_fff_mode') : $t('plugins.WorkshopPrinting.printing.switch_to_fff_mode') }}
						</v-btn>
						<v-btn small outlined @click="section = 'head'"><v-icon small left>mdi-swap-horizontal</v-icon>{{ $t('plugins.WorkshopPrinting.printing.head_change') }}</v-btn>
						<span v-if="reasonNoMode" class="text-caption grey--text">{{ reasonNoMode }}</span>
					</div>
					<v-alert v-if="msg" dense text :type="msgKind" class="mt-2 mb-0">{{ msg }}</v-alert>
				</v-card>
		<div class="st-layout">
				<side-tabs v-model="section" :items="tabItems" />
				<div class="st-body" :style="{ '--wf-sec': secColor }">
				<v-tabs-items v-model="section" class="transparent">
					<!-- ===== Operate: Estado ===== -->
					<v-tab-item value="state">
						<pc-section icon="mdi-thermometer" :title="$t('plugins.WorkshopPrinting.common.status')">
						<!-- cold extrusion allowed (level 4, 2026-10-11): fixed notice
						     at the very top while it lasts, with the button to block it again -->
						<v-alert v-if="coldAllowed" type="error" prominent class="mb-3">
							<div class="font-weight-medium">{{ $t('plugins.WorkshopPrinting.printing.cold_extrusion_allowed') }}</div>
							<div class="text-body-2">
								{{ $t('plugins.WorkshopPrinting.printing.the_extruder_pushes_even_with_the') }}
							</div>
							<v-btn small class="mt-2" outlined :loading="coldSending" :disabled="!canOperate" @click="blockCold()">
								<v-icon small left>mdi-lock</v-icon>{{ $t('plugins.WorkshopPrinting.printing.lock_cold_extrusion') }}
							</v-btn>
						</v-alert>
						<div v-if="tabItems.some(i => i.id === 'extruder')" class="d-flex align-center flex-wrap mb-3" style="gap:8px">
							<span class="text-body-2">{{ $t('plugins.WorkshopPrinting.printing.extruder_type_now', { kind: $t('plugins.WorkshopPrinting.extruder.kind_' + extruderKindValue) }) }}</span>
							<v-btn small outlined @click="goSection('extruder')">{{ $t('plugins.WorkshopPrinting.printing.change_extruder_type') }}</v-btn>
						</div>
						<div v-if="!heaters.length" class="text-body-2 grey--text">
							{{ $t('plugins.WorkshopPrinting.printing.there_are_no_heaters_configured_now') }}
						</div>
						<v-row v-else dense>
							<v-col v-for="h in heaters" :key="h.id" cols="12" sm="6" md="4">
								<v-card outlined class="pa-3" :class="{ 'edge-fault': h.state === 'fault' || h.sensorBad }">
									<div class="d-flex align-center">
										<v-icon class="mr-2">{{ h.icon }}</v-icon>
										<span class="text-h6">{{ h.name }}</span>
										<v-spacer />
										<v-chip small outlined :color="colorState(h)">{{ textState(h) }}</v-chip>
									</div>
									<div class="text-h4 my-1">{{ h.sensorBad ? '--' : fmt(h.current) }} °C</div>
									<div class="text-body-2">
										{{ $t('plugins.WorkshopPrinting.common.target') }} <b>{{ h.target > 0 ? fmt(h.target) + ' °C' : $t('plugins.WorkshopPrinting.common.off') }}</b>
										<span class="grey--text ml-2">{{ $t('plugins.WorkshopPrinting.printing.limit_c', { max: fmt(h.max) }) }}</span>
									</div>
									<v-progress-linear :value="h.max && !h.sensorBad ? (h.current / h.max) * 100 : 0" :color="h.current > 50 ? 'amber darken-3' : 'grey'" height="6" rounded class="mt-2" />
									<template v-if="h.state === 'fault' || h.sensorBad">
										<div class="text-caption error--text mt-2">{{ h.explanation || $t('plugins.WorkshopPrinting.printing.the_heater_is_in_fault') }}</div>
										<v-btn x-small outlined color="error" class="mt-1" :disabled="h.sensorBad || !canOperate" :title="h.sensorBad ? $t('plugins.WorkshopPrinting.printing.fix_the_sensor_first') : ''" @click="deleteFault(h)">
											{{ $t('plugins.WorkshopPrinting.printing.clear_fault_m562') }}
										</v-btn>
									</template>
								</v-card>
							</v-col>
						</v-row>
						<!-- temperature history (2026-10-11): sampled from the model every 2 s -->
						<v-card v-if="heaters.length" outlined class="pa-3 mt-3">
							<chart-state :series="seriesChart" :samples="samples" />
						</v-card>
						<div v-if="fans.length" class="mt-3">
							<div class="text-subtitle-2 mb-1">{{ $t('plugins.WorkshopPrinting.common.fans') }}</div>
							<div class="d-flex flex-wrap" style="gap:12px">
								<div v-for="f in fans" :key="f.id" class="text-body-2">
									<v-icon small class="mr-1">mdi-fan</v-icon>{{ f.name }}: <b>{{ Math.round(f.value * 100) }} %</b>
									<span v-if="f.thermostatic" class="grey--text"> {{ $t('plugins.WorkshopPrinting.printing.automatic') }}</span>
								</div>
							</div>
						</div>
						<div v-if="isFff" class="d-flex flex-wrap mt-3" style="gap:8px">
							<!-- apagar es seguro (nivel 1): un toque -->
							<v-btn small outlined :disabled="!canOperate" @click="cool()">
								<v-icon small left>mdi-snowflake</v-icon>{{ $t('plugins.WorkshopPrinting.printing.turn_off_all_heaters') }}
							</v-btn>
						</div>
						<!-- How it is configured (2026-10-11): what the board's model says
						     for each heater; "Read from the board" also asks for the output, the
						     sensor, the model and the cap as RRF answers them -->
						<div v-if="heaters.length" class="mt-4">
							<div class="text-subtitle-2 mb-1"><v-icon small class="mr-1">mdi-cog-outline</v-icon>{{ $t('plugins.WorkshopPrinting.printing.how_it_is_configured') }}</div>
							<v-expansion-panels multiple accordion>
								<v-expansion-panel v-for="c in config" :key="c.id">
									<v-expansion-panel-header>
										<div class="d-flex align-center flex-wrap" style="gap:6px">
											<v-icon small>{{ c.icon }}</v-icon>
											<b>{{ c.name }}</b>
											<span class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.printing.heater_sensor_limit', { id: c.id, sensor: c.sensor, max: fmt(c.max), pid: c.pidShort }) }}</span>
										</div>
									</v-expansion-panel-header>
									<v-expansion-panel-content>
										<v-simple-table dense class="table-config">
											<tbody>
												<tr><td>{{ $t('plugins.WorkshopPrinting.printing.belongs_to') }}</td><td>{{ c.belongsA }}</td></tr>
												<tr><td>{{ $t('plugins.WorkshopPrinting.printing.output_m950') }}</td><td>{{ c.output || $t('plugins.WorkshopPrinting.printing.tap_read_from_the_board') }}</td></tr>
												<tr><td>{{ $t('plugins.WorkshopPrinting.printing.sensor_m308') }}</td><td>{{ c.sensorTxt }}</td></tr>
												<tr><td>{{ $t('plugins.WorkshopPrinting.common.limit_m143') }}</td><td>{{ c.stopTxt }}</td></tr>
												<tr><td>{{ $t('plugins.WorkshopPrinting.printing.model_m307') }}</td><td>{{ c.modelTxt }}</td></tr>
												<tr><td>{{ $t('plugins.WorkshopPrinting.common.control') }}</td><td>{{ c.pidTxt }}</td></tr>
											</tbody>
										</v-simple-table>
										<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
											<!-- solo pregunta (nivel 0-1): un toque -->
											<v-btn x-small outlined :loading="readings[c.id] && readings[c.id].loading" @click="readConfig(c)">
												<v-icon x-small left>mdi-download</v-icon>{{ $t('plugins.WorkshopPrinting.printing.read_from_the_board') }}
											</v-btn>
										</div>
										<pre v-if="readings[c.id] && readings[c.id].text" class="response-board mt-2">{{ readings[c.id].text }}</pre>
									</v-expansion-panel-content>
								</v-expansion-panel>
							</v-expansion-panels>
						</div>

						<!-- Cold extrusion (2026-10-11, request: "allow cold extrusions, but
						     make it go through the safety protocol"). Allowing it is level 4
						     (DESIGN.md 5): notice with a checkbox + active risk while it lasts.
						     The state is read from the model: with M302 P1 RRF reports
						     heat.coldExtrudeTemperature = 0 (Heat.cpp). -->
						<v-card v-if="isFff" outlined class="pa-3 mt-4" :class="{ 'edge-fault': coldAllowed }">
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								<v-icon :color="coldAllowed ? 'error' : 'success'">{{ coldAllowed ? 'mdi-lock-open-variant' : 'mdi-lock' }}</v-icon>
								<span class="text-subtitle-1 font-weight-medium">{{ $t('plugins.WorkshopPrinting.printing.cold_extrusion') }}</span>
								<v-chip small outlined :color="coldAllowed ? 'error' : coldAllowed === false ? 'success' : undefined">
									{{ coldAllowed ? $t('plugins.WorkshopPrinting.printing.allowed') : coldAllowed === false ? $t('plugins.WorkshopPrinting.printing.locked') : $t('plugins.WorkshopPrinting.printing.no_data') }}
								</v-chip>
							</div>
							<div class="text-body-2 mt-2">
								<template v-if="coldAllowed">
									{{ $t('plugins.WorkshopPrinting.printing.the_extruder_pushes_and_retracts_at') }}
								</template>
								<template v-else>
									{{ $t('plugins.WorkshopPrinting.printing.locked_the_extruder_doesn_t_push') }} <b>{{ fmt(minExtCold) }} °C</b>
									{{ $t('plugins.WorkshopPrinting.printing.nor_retract_below') }} <b>{{ fmt(minRetCold) }} °C</b>{{ $t('plugins.WorkshopPrinting.printing.it_is_the_normal_protection_it') }}
								</template>
							</div>
							<div class="text-caption grey--text mt-1">
								{{ $t('plugins.WorkshopPrinting.printing.relocks_on_restart') }} {{ textModeCold }}
							</div>
							<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
								<v-btn v-if="coldAllowed" small color="primary" :loading="coldSending" :disabled="!canOperate" @click="blockCold()">
									<v-icon small left>mdi-lock</v-icon>{{ $t('plugins.WorkshopPrinting.printing.lock_cold_extrusion') }}
								</v-btn>
								<!-- level 4: red; without the workshop's notice it falls back to the double tap -->
								<v-btn v-else small :color="armed === 'cold' ? 'amber darken-3' : 'error'" :outlined="armed !== 'cold'" :disabled="coldAllowed == null || !canAllowCold" :loading="coldSending" @click="touchCold()">
									<v-icon small left>mdi-lock-open-variant</v-icon>{{ armed === 'cold' ? $t('plugins.WorkshopPrinting.printing.tap_again_allow_cold_extrusion') : $t('plugins.WorkshopPrinting.printing.allow_cold_extrusion') }}
								</v-btn>
								<span v-if="coldAllowed == null" class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.printing.no_data_from_the_board_yet') }}</span>
								<span v-else-if="!coldAllowed && !canAllowCold" class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.printing.cold_needs_technician') }}</span>
							</div>
						</v-card>
						<div v-if="isFff && extruder" class="text-caption grey--text mt-3">
							{{ $t('plugins.WorkshopPrinting.printing.extruder_steps', { n: extruder.stepsPerMm }) }}
						</div>
						<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
					</pc-section>
					</v-tab-item>

					<!-- ===== Configure: printer tests (ex Puesta en marcha); the chip of the header stays ===== -->
					<v-tab-item v-if="canConfig" value="tests">
						<printing-startup :startup-pending="startupPending" :is-fff="isFff" :heaters="heaters" :tools="tools" :fans="fans" :state="state" @go="goSection($event)" />
					</v-tab-item>

					<!-- ===== Configure: Cambio de cabezal ===== -->
					<v-tab-item v-if="canConfig" value="head">
						<head-change :mode="mode" :state="state" :homed="homed" :nozzle="nozzle" :modes="modeNames" />
					</v-tab-item>

					<!-- ===== Operate: the pellet panel (fans, motor test, feed now, heat a zone) ===== -->
					<v-tab-item value="pellet">
						<pellet :is-fff="isFff" :current-tool="tool" :heaters="heaters" :tools="tools" :fans="fans" @goto="goTo" />
					</v-tab-item>

					<!-- ===== Configure: pellet zones (reorder, steps, feeding, outputs and sensors; writes modefff.g) ===== -->
					<v-tab-item v-if="canConfig" value="zones">
						<pellet-setup :is-fff="isFff" :current-tool="tool" :heaters="heaters" :fans="fans" :state="state" @goto="goTo" />
					</v-tab-item>

					<!-- ===== Operate: Materiales (preheat) ===== -->
					<v-tab-item v-if="canOperate" value="materials">
						<materiales :is-fff="isFff" :heaters="heaters" :tools="tools" :current-tool="tool" />
					</v-tab-item>

					<!-- ===== Configure: Extrusor ===== -->
					<v-tab-item v-if="canConfig" value="extruder">
						<extrusor :is-fff="isFff" :nozzle="nozzle" :extruder="extruder" :tool="tool" :min-extrusion="minExtrusion" :state="state" />
					</v-tab-item>

					<!-- ===== Configure: PID ===== -->
					<v-tab-item v-if="canConfig" value="pid">
						<pid ref="pid" :is-fff="isFff" :heaters="heaters" :tool="tool" :state="state" />
					</v-tab-item>

					<!-- ===== 3D job: temperatures, print state and 3D view of a job (moved from the Workbench) ===== -->
					<v-tab-item value="job">
						<fff-job :is-fff="isFff" />
					</v-tab-item>
				</v-tabs-items>
				</div>
				</div>
	</v-container>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import { api } from './workshop-api.js'
import HeadChange from './HeadChange.vue'
import PcSection from './PcSection.vue' // the card with the header of a section (printing-design.css)
import materials from './Materials.vue'
import extruder from './Extruder.vue'
import Pid from './Pid.vue'
import Pellet from './Pellet.vue'
import PelletSetup from './PelletSetup.vue'
import StartupPanel from './StartupPanel.vue' // start-up strip (vue/_shared)
import PageHeader from './PageHeader.vue' // header of every page (vue/_shared)
import { printModesMixin } from './print-modes-mixin.js' // which modes the machine uses: rows, entry, head change
import StartupPrint from './PrintingStartup.vue' // the start-up assistant of the printing page (not the shared card, see HeadChange.vue)
import ChartState from './ChartState.vue'
import FffJob from './FffJob.vue' // 3D job tab: temperatures, print state and 3D view (moved from the Workbench)
import { explainSensor, isSensorFault, isError, readText, MODE_FILE } from './util.js'
import { pluginOf, pluginActive } from './workshop-ids.js' // Id nuevo o viejo del plugin (vue/_shared)
import { machineFree } from './machine-free.js' // trabajo de archivo, pausado o en vivo (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'

const TAB_KEY = 'workshopPrintingSection';
// History of the State chart (2026-10-11): one sample every 2 s, 10 min.
const SAMPLE_MS = 2000;
const SAMPLES_MAX = 300;
// Series colors per heater (fixed order: the color follows the heater,
// not its position in the visible list).
const colors = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#2a78d6'];
// Riesgo activo de la extrusion en frio (API risk.start / risk.end of WorkshopService).
const RISK_COLD = 'extrusion_cold';
const riskColdIni = () => api('risk.start', { id: 'extrusion_cold', text: i18n.t('plugins.WorkshopPrinting.printing.risk_cold_extrusion', 'es'), text_en: i18n.t('plugins.WorkshopPrinting.printing.risk_cold_extrusion', 'en'), seconds: 3600 });
const riskColdEnd = () => api('risk.end', { id: 'extrusion_cold' });
// RRF: M143 A<n> (action of the heater's monitor)
const ACTION_MONITOR = () => ({ 0: i18n.t('plugins.WorkshopPrinting.printing.mon_heater_fault'), 1: i18n.t('plugins.WorkshopPrinting.printing.mon_turns_it_off'), 2: i18n.t('plugins.WorkshopPrinting.printing.mon_turns_it_off_briefly'), 3: i18n.t('plugins.WorkshopPrinting.printing.mon_shuts_machine_down') });

import SideTabs from './SideTabs.vue'
import { sectionColor } from './section-colors.js' // the color of the open section (top line of the card)
import { roleMixin } from './role-mixin.js' // what the role sees and may do (vue/_shared)
import { sideItems, sectionToShow, restoreSection, hiddenIds, NEED } from './print-sections.js'
import { extruderKind, loadExtruderKind } from './extruder-kind.js' // pellets or filament: the pellet sections only show for pellets

export default {
	mixins: [roleMixin, printModesMixin],
	components: { PageHeader, SideTabs, HeadChange: HeadChange, Materiales: materials, Extrusor: extruder, Pid, Pellet, PelletSetup, PrintingStartup: StartupPrint, StartupPanel: StartupPanel, ChartState, FffJob, PcSection },
	data() {
		let section = restoreSection(null);
		try {
			const saved = localStorage.getItem(TAB_KEY);
			section = restoreSection(saved);
		} catch (e) {
			/* no critico */
		}
		return {
			section, armed: null, armedTimer: null, msg: null, msgKind: 'info',
			samples: [], readings: {},
			// cold extrusion: with M302 P1 the model reports 0 in both
			// temperatures; the last real ones are remembered to show them
			coldSending: false, lastMinExt: null, lastMinRet: null, riskAttempt: 0, modeHasM302: null,
			// what the start-up chip says (pending = rows still to do): the printer tests ask for it to be green
			startupPending: 0,
			noStartupRows: Object.freeze([])
		};
	},
	watch: {
		// outside FFF only the head change works (when the role sees it); the role changing (log in / out) can also hide the open section
		isFff: { immediate: true, handler() { this.fitSection(); } },
		mode() { this.fitSection(); },
		tabItems() { this.fitSection(); },
		coldAllowed() {
			this.syncRisk();
		},
		section(v) {
			try {
				localStorage.setItem(TAB_KEY, String(v));
			} catch (e) {
				/* no critico */
			}
		}
	},
	computed: {
		extruderKindValue() {
			return extruderKind.value;
		},
		secColor() {
			return sectionColor(this.section);
		},
		// the mode files and, once sys/config.g was read, whether it calls automodeselect.g (never edited from here)
		tabItems() {
			return sideItems(k => this.$t('plugins.WorkshopPrinting.' + k), this.isFff, op => this.canDo(op), hiddenIds(this.hideHead, extruderKind.value));
		},
		// operator: heat, fans, preheat, lock cold extrusion; technician: what writes the configuration, changes the mode or the head,
		// allows cold extrusion (NEED, print-sections.js). Without identity / users / an old service everything is shown (role-view.js)
		canOperate() {
			return this.atLeast(NEED.operate);
		},
		canConfig() {
			return this.atLeast(NEED.configure);
		},
		canAllowCold() {
			return this.atLeast(NEED.cold);
		},
		model() {
			return this.$store.state.machine.model;
		},
		mode() {
			return (this.model.state && this.model.state.machineMode) || '';
		},
		isFff() {
			return this.mode === 'FFF';
		},
		state() {
			return (this.model.state && this.model.state.status) || '';
		},
		reasonNoMode() {
			return this.calcReasonNoMode();
		},
		homed() {
			const ax = (this.model.move && this.model.move.axes) || [];
			return ax.length > 0 && ax.filter(a => a && ['X', 'Y', 'Z'].includes(a.letter)).every(a => a.homed);
		},
		tools() {
			return (this.model.tools || []).filter(t => t);
		},
		tool() {
			const cur = this.model.state && this.model.state.currentTool;
			return this.tools.find(t => t.number === cur) || this.tools[0] || null;
		},
		// Each heater with its role: nozzle zone of a tool
		// (pellet extruders usually have several), bed or chamber.
		heaters() {
			const heat = this.model.heat || {};
			const hs = heat.heaters || [];
			const beds = (heat.bedHeaters || []).filter(n => n >= 0);
			const cameras = (heat.chamberHeaters || []).filter(n => n >= 0);
			const sensores = (this.model.sensors && this.model.sensors.analog) || [];
			const out = [];
			hs.forEach((h, i) => {
				if (!h) return;
				const tool = this.tools.find(t => (t.heaters || []).includes(i));
				const zone = tool ? tool.heaters.indexOf(i) : -1;
				let papel = 'other', nombre = i18n.t('plugins.WorkshopPrinting.printing.heater_n', { n: i }), icon = 'mdi-fire';
				if (beds.includes(i)) { papel = 'bed'; nombre = i18n.t('plugins.WorkshopPrinting.printing.bed'); icon = 'mdi-radiator'; }
				else if (cameras.includes(i)) { papel = 'camera'; nombre = i18n.t('plugins.WorkshopPrinting.printing.heated_chamber'); icon = 'mdi-home-thermometer-outline'; }
				else if (tool) {
					papel = 'nozzle';
					icon = 'mdi-printer-3d-nozzle-heat';
					nombre = (this.tools.length > 1 ? (tool.name || 'T' + tool.number) + ': ' : i18n.t('plugins.WorkshopPrinting.printing.nozzle')) + (tool.heaters.length > 1 ? ' ' + i18n.t('plugins.WorkshopPrinting.printing.zone_n_lower', { n: zone + 1 }) : '');
				}
				let target = h.active;
				if (tool) target = tool.state === 'active' ? (tool.active || [])[zone] : tool.state === 'standby' ? (tool.standby || [])[zone] : 0;
				const sn = sensores[h.sensor] || {};
				const sensorBad = isSensorFault(sn.state, h.current);
				out.push({
					id: i, name: nombre, icon: icon, paper: papel, tool: tool ? tool.number : null, zone: zone,
					current: h.current, target: h.state === 'off' ? 0 : target, state: h.state, max: h.max, pwm: h.avgPwm,
					model: h.model, sensor: h.sensor, sensorName: sn.name || '', sensorBad: sensorBad, explanation: explainSensor(sn.state, h.current)
				});
			});
			return out;
		},
		// the first zone of the current tool (Extruder, Head change)
		nozzle() {
			const t = this.tool;
			return this.heaters.find(h => h.paper === 'nozzle' && (!t || h.tool === t.number)) || null;
		},
		// what the page header counts: heater faults, cold extrusion allowed, a mode that is not FFF
		headerReasons() {
			const r = [];
			if (this.faults.length) r.push({ level: 'error', text: i18n.t('plugins.WorkshopPrinting.printing.n_faults', { n: this.faults.length }) });
			if (this.coldAllowed) r.push({ level: 'error', text: i18n.t('plugins.WorkshopPrinting.printing.cold_extrusion_allowed') });
			if (!this.isFff && this.mode) r.push({ level: 'warn', text: i18n.t('plugins.WorkshopPrinting.printing.3d_printing_needs_fff_mode') });
			return r;
		},
		faults() {
			return this.heaters.filter(h => h.state === 'fault' || h.sensorBad);
		},
		fans() {
			return (this.model.fans || []).map((f, i) => f && {
				id: i,
				name: f.name || i18n.t('plugins.WorkshopPrinting.printing.fan_n', { n: i }),
				value: f.actualValue != null ? f.actualValue : f.requestedValue || 0,
				rpm: f.rpm != null ? f.rpm : -1,
				thermostatic: !!(f.thermostatic && f.thermostatic.heaters && f.thermostatic.heaters.length)
			}).filter(f => f);
		},
		extruder() {
			const t = this.tool;
			const ex = (this.model.move && this.model.move.extruders) || [];
			const n = t && t.extruders && t.extruders.length ? t.extruders[0] : 0;
			return ex[n] || ex.find(e => e) || null;
		},
		minExtrusion() {
			const h = this.model.heat || {};
			return h.coldExtrudeTemperature != null ? h.coldExtrudeTemperature : 160;
		},
		// ---- Estado: grafica, configuracion y extrusion en frio (2026-10-11) ----
		seriesChart() {
			return this.heaters.map(h => ({
				id: h.id, name: h.name, color: colors[h.id % colors.length],
				current: h.sensorBad ? null : h.current, target: h.target, max: h.max
			}));
		},
		config() {
			const hs = (this.model.heat && this.model.heat.heaters) || [];
			const sensores = (this.model.sensors && this.model.sensors.analog) || [];
			const n = (v, d) => (v == null || isNaN(v) ? '--' : Number(v).toFixed(d));
			return this.heaters.map(c => {
				const h = hs[c.id] || {};
				const sn = sensores[c.sensor] || {};
				const md = h.model || {};
				const pid = md.pid || {};
				const tool = c.tool != null ? this.tools.find(t => t.number === c.tool) : null;
				let perteneceA = i18n.t('plugins.WorkshopPrinting.printing.no_tool');
				if (c.paper === 'bed') perteneceA = i18n.t('plugins.WorkshopPrinting.printing.bed_m140');
				else if (c.paper === 'camera') perteneceA = i18n.t('plugins.WorkshopPrinting.printing.chamber_m141');
				else if (tool) perteneceA = (tool.name ? tool.name + ' (T' + tool.number + ')' : 'T' + tool.number) + (tool.heaters.length > 1 ? ', ' + i18n.t('plugins.WorkshopPrinting.printing.zone_n_of_total', { n: c.zone + 1, total: tool.heaters.length }) : '');
				const mons = (h.monitors || []).filter(m => m && m.condition && m.condition !== 'disabled');
				const capTxt = this.fmt(h.max) + ' °C' + (mons.length
					? ' · ' + mons.map(m => (m.condition === 'tooLow' ? i18n.t('plugins.WorkshopPrinting.printing.if_below_c', { c: this.fmt(m.limit) }) : i18n.t('plugins.WorkshopPrinting.printing.if_above_c', { c: this.fmt(m.limit) })) + ': ' + (ACTION_MONITOR()[m.action] || i18n.t('plugins.WorkshopPrinting.printing.action_n', { n: m.action }))).join('; ')
					: '');
				const modelTxt = md.enabled === false ? i18n.t('plugins.WorkshopPrinting.printing.no_model_heater_disabled')
					: i18n.t('plugins.WorkshopPrinting.printing.model_heats_cools', { heat: n(md.heatingRate, 2), cool: n(md.coolingRate, 3) }) + (md.fanCoolingRate ? ' ' + i18n.t('plugins.WorkshopPrinting.printing.model_with_fan', { rate: n(md.fanCoolingRate, 3) }) : '')
						+ ' · ' + i18n.t('plugins.WorkshopPrinting.printing.model_dead_time_max_power', { dead: n(md.deadTime, 1), pwm: n((md.maxPwm || 0) * 100, 0) })
						+ (md.standardVoltage ? ' · ' + i18n.t('plugins.WorkshopPrinting.printing.model_at_v', { v: n(md.standardVoltage, 1) }) : '') + (md.inverted ? ' · ' + i18n.t('plugins.WorkshopPrinting.printing.model_inverted') : '');
				const pidTxt = pid.used === false ? i18n.t('plugins.WorkshopPrinting.printing.on_off_no_pid')
					: 'PID ' + (pid.overridden ? i18n.t('plugins.WorkshopPrinting.printing.pid_by_hand') : i18n.t('plugins.WorkshopPrinting.printing.pid_from_model')) + (pid.p != null ? ': P ' + n(pid.p, 3) + ' · I ' + n(pid.i, 4) + ' · D ' + n(pid.d, 3) : '');
				const lec = this.readings[c.id] || {};
				return {
					id: c.id, name: c.name, icon: c.icon, sensor: c.sensor, max: h.max, belongsA: perteneceA, stopTxt: capTxt, modelTxt: modelTxt, pidTxt,
					pidShort: md.enabled === false ? i18n.t('plugins.WorkshopPrinting.common.no_model') : pid.used === false ? i18n.t('plugins.WorkshopPrinting.printing.no_pid') : 'PID',
					output: lec.output || '',
					sensorTxt: 'S' + c.sensor + (sn.name ? ' "' + sn.name + '"' : '') + ' · ' + this.kindSensor(sn.type) + ' · ' + i18n.t('plugins.WorkshopPrinting.printing.reads') + ' ' + (c.sensorBad ? '--' : this.fmt(sn.lastReading != null ? sn.lastReading : c.current) + ' °C')
				};
			});
		},
		// REAL state of M302: with P1 RRF reports coldExtrudeTemperature = 0
		// (Heat.cpp: coldExtrude ? 0 : extrusionMinTemp). null: model not loaded.
		coldAllowed() {
			const h = this.model.heat || {};
			if (h.coldExtrudeTemperature == null) return null;
			return h.coldExtrudeTemperature === 0;
		},
		minExtCold() {
			const h = this.model.heat || {};
			return h.coldExtrudeTemperature > 0 ? h.coldExtrudeTemperature : this.lastMinExt;
		},
		minRetCold() {
			const h = this.model.heat || {};
			return h.coldRetractTemperature > 0 ? h.coldRetractTemperature : this.lastMinRet;
		},
		textModeCold() {
			if (this.modeHasM302 === true) return i18n.t('plugins.WorkshopPrinting.printing.reloading_fff_mode_also_locks_it');
			if (this.modeHasM302 === false) return i18n.t('plugins.WorkshopPrinting.printing.changing_or_reloading_fff_mode_does');
			return '';
		},
		// risks open in the Pi service (null: service without data)
		risksPi() {
			const p = pluginOf(this.model.plugins, 'service');
			const r = p && p.data && p.data.riskActive;
			return Array.isArray(r) ? r : null;
		}
	},
	created() {
		this.buf = []; // history without reactivity; the chart receives a frozen copy
	},
	mounted() {
		loadExtruderKind();
		this.sample();
		this.timerSample = setInterval(this.sample, SAMPLE_MS);
		// if modefff.g sets M302 (without P1), reloading the mode blocks it again
		this.recheckModes();
		readText(MODE_FILE).then(t => {
			this.modeHasM302 = t.split(/\r?\n/).some(l => {
				const c = l.split(';')[0];
				return /^\s*M302\b/i.test(c) && !/P1/i.test(c);
			});
		}).catch(() => {});
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
		clearInterval(this.timerSample);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		// the open section when the mode or the role changes
		fitSection() {
			if (!this.mode) return;
			const s = sectionToShow(this.section, this.isFff, op => this.canDo(op), hiddenIds(this.hideHead, extruderKind.value));
			if (s !== this.section) this.section = s;
		},
		goSection(id) {
			this.section = sectionToShow(id, this.isFff, op => this.canDo(op), hiddenIds(this.hideHead, extruderKind.value));
		},
		// a shortcut of the pellet panel: another section and, in PID, the heater to tune
		goTo(g) {
			this.goSection(g.section);
			if (g.heater == null) return;
			// the section mounts after the change: wait for it (up to 2 s) before picking the heater
			let n = 0;
			const pick = () => {
				const p = this.$refs.pid;
				if (p) p.which = g.heater;
				else if (++n < 20) setTimeout(pick, 100);
			};
			this.$nextTick(pick);
		},
		// A sample of all the zones: [current, target] per heater.
		// Frozen array: Vue does not make it reactive (300 samples x zones).
		sample() {
			const h = this.model.heat || {};
			if (h.coldExtrudeTemperature > 0) this.lastMinExt = h.coldExtrudeTemperature;
			if (h.coldRetractTemperature > 0) this.lastMinRet = h.coldRetractTemperature;
			this.syncRisk();
			if (!this.heaters.length) return;
			const v = {};
			this.heaters.forEach(c => { v[c.id] = [c.sensorBad ? null : c.current, c.target]; });
			this.buf.push(Object.freeze({ t: Date.now(), v: Object.freeze(v) }));
			if (this.buf.length > SAMPLES_MAX) this.buf.splice(0, this.buf.length - SAMPLES_MAX);
			this.samples = Object.freeze(this.buf.slice());
		},
		kindSensor(t) {
			const kinds = { thermistor: i18n.t('plugins.WorkshopPrinting.printing.st_thermistor'), pt1000: 'PT1000', rtdmax31865: 'PT100 (MAX31865)', thermocouplemax31856: i18n.t('plugins.WorkshopPrinting.printing.st_tc_31856'), thermocouplemax31855: i18n.t('plugins.WorkshopPrinting.printing.st_tc_31855'), linearanalog: i18n.t('plugins.WorkshopPrinting.printing.st_linear'), mcutemp: i18n.t('plugins.WorkshopPrinting.printing.st_mcu'), drivers: 'drivers' };
			return t ? (kinds[String(t).toLowerCase()] || t) : i18n.t('plugins.WorkshopPrinting.printing.unknown_type');
		},
		// Asks the board for the output, the sensor, the model and the cap (read only).
		async readConfig(c) {
			this.$set(this.readings, c.id, { loading: true, text: '', output: '' });
			const parts = [];
			let output = '';
			for (const code of [`M950 H${c.id}`, `M308 S${c.sensor}`, `M307 H${c.id}`, `M143 H${c.id}`]) {
				try {
					const r = String(await this.sendCode({ code, log: false }) || '').trim();
					parts.push(code + '\n  ' + (r || i18n.t('plugins.WorkshopPrinting.printing.no_response')));
					if (code.startsWith('M950')) {
						const m = r.match(/pin\s+([^\s,]+)/i);
						if (m) output = m[1];
					}
				} catch (e) {
					parts.push(code + '\n  ' + i18n.t('plugins.WorkshopPrinting.printing.could_not_read', { error: e.message || String(e) }));
				}
			}
			this.$set(this.readings, c.id, { loading: false, text: parts.join('\n'), output: output || i18n.t('plugins.WorkshopPrinting.printing.see_the_m950_reply_below') });
		},
		// Level 4 (DESIGN.md 5): notice with warnings and an "Understood" checkbox. Without the
		// workshop's notice (window.__workshop did not load) it falls back to the double tap.
		touchCold() {
			const t = window.__workshop && window.__workshop.confirmLevel4;
			if (!t) return this.arm('cold', this.allowCold);
			t({
				title: i18n.t('plugins.WorkshopPrinting.printing.allow_cold_extrusion'),
				notices: [
					i18n.t('plugins.WorkshopPrinting.printing.the_extruder_will_push_even_with'),
					i18n.t('plugins.WorkshopPrinting.printing.with_cold_or_half_melted_material'),
					i18n.t('plugins.WorkshopPrinting.printing.use_it_to_test_the_motor'),
					i18n.t(pluginActive(this.$store, 'lights') ? 'plugins.WorkshopPrinting.printing.while_it_lasts_the_red_bar' : 'plugins.WorkshopPrinting.printing.while_it_lasts_the_red_bar_no_lights')
				],
				understood: i18n.t('plugins.WorkshopPrinting.printing.understood_the_extruder_can_move_while'),
				button: i18n.t('plugins.WorkshopPrinting.printing.allow')
			}).then(ok => { if (ok) this.allowCold(); });
		},
		async allowCold() {
			this.coldSending = true;
			try {
				const r = await this.sendCode({ code: 'M302 P1', log: true });
				if (isError(r)) throw new Error(r);
				this.riskAttempt = Date.now();
				await riskColdIni().catch(() => {});
				this.msgKind = 'warning';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.cold_extrusion_allowed_lock_it_again');
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.could_not_allow', { error: e.message || String(e) });
			} finally {
				this.coldSending = false;
			}
		},
		// Volver a bloquear devuelve la proteccion (nivel 1): un toque.
		async blockCold() {
			this.coldSending = true;
			try {
				const r = await this.sendCode({ code: 'M302 P0', log: true });
				if (isError(r)) throw new Error(r);
				this.riskAttempt = Date.now();
				await riskColdEnd().catch(() => {});
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.cold_extrusion_locked_again');
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.could_not_lock', { error: e.message || String(e) });
			} finally {
				this.coldSending = false;
			}
		},
		// The active risk follows the board's REAL state while this page
		// is open: if it was allowed by console or the risk expired (D3600) it
		// is opened again; if the board restarted, it is closed. One attempt per minute.
		syncRisk() {
			const r = this.risksPi;
			if (!r || this.coldAllowed == null || Date.now() - this.riskAttempt < 60000) return;
			const abierto = r.some(e => e && e.id === RISK_COLD);
			if (this.coldAllowed && !abierto) {
				this.riskAttempt = Date.now();
				riskColdIni().catch(() => {});
			} else if (!this.coldAllowed && abierto) {
				this.riskAttempt = Date.now();
				riskColdEnd().catch(() => {});
			}
		},
		fmt(v) {
			return v == null || isNaN(v) ? '--' : Number(v).toFixed(0);
		},
		textState(h) {
			if (h.sensorBad) return i18n.t('plugins.WorkshopPrinting.common.no_sensor');
			return { off: i18n.t('plugins.WorkshopPrinting.printing.st_off'), active: i18n.t('plugins.WorkshopPrinting.printing.st_heating'), standby: i18n.t('plugins.WorkshopPrinting.common.standby'), fault: i18n.t('plugins.WorkshopPrinting.printing.st_fault'), tuning: i18n.t('plugins.WorkshopPrinting.printing.st_tuning') }[h.state] || h.state;
		},
		colorState(h) {
			// DESIGN.md 2: falla = error, calibrando = aviso, calentando = ambar (calienta), resto gris
			return h.state === 'fault' || h.sensorBad ? 'error' : h.state === 'tuning' ? 'warning' : h.state === 'active' ? 'amber darken-3' : h.state === 'standby' ? 'amber darken-1' : 'grey darken-1';
		},
		arm(id, fn) {
			if (this.armed !== id) {
				this.armed = id;
				clearTimeout(this.armedTimer);
				this.armedTimer = setTimeout(() => { this.armed = null; }, 4000);
				return;
			}
			this.armed = null;
			fn();
		},
		async deleteFault(h) {
			try {
				await this.sendCode({ code: `M562 P${h.id}`, log: true });
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.fault_cleared', { name: h.name });
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.common.couldn_t') + (e.message || e);
			}
		},
		// Change mode: never with a file job nor with the live job
		// (motion audit, finding 7), nor with the machine busy.
		calcReasonNoMode() {
			if (['processing', 'paused', 'pausing', 'resuming', 'simulating', 'cancelling'].includes(this.state)) return i18n.t('plugins.WorkshopPrinting.common.a_job_is_running_wait_for');
			const ml = machineFree(this.model, { t: ts, serviceText, serviceDefaultKey, purpose: 'settings' });
			if (ml.code === 'live') return ml.reason + '.';
			if (this.state === 'busy') return i18n.t('plugins.WorkshopPrinting.common.the_machine_is_busy_moving_or');
			// 'off' (the supply is off) is allowed: changing the mode moves nothing and the board loads its configuration all the same
			if (this.state && !['idle', 'off'].includes(this.state)) return i18n.t('plugins.WorkshopPrinting.printing.machine_not_idle', { state: this.state });
			return '';
		},
		async changeAfff() {
			if (!this.canConfig) return; // changing the mode is a technician's
			if (this.calcReasonNoMode()) return; // se vuelve a mirar al tocar
			try {
				// the owner's macro when this machine has it; otherwise RRF's own FFF mode (a new install has no macros/mode/selectfff.g:
				// M98 on a missing file only logs an error in DWC, it answers nothing, so the page used to say "loaded" and nothing changed)
				// only a macro with at least one line that runs counts: the service writes it as an example, all commented, and that does nothing
				const hasMacro = await readText('0:/macros/mode/selectfff.g').then(t => t.split('\n').some(l => { const x = l.trim(); return x !== '' && x.charAt(0) !== ';'; }), () => false);
				const r = await this.sendCode({ code: hasMacro ? 'M98 P"0:/macros/mode/selectfff.g"' : 'M451', log: true });
				if (/error/i.test(r || '')) throw new Error(r);
				if (!hasMacro && this.model.global && typeof this.model.global.has === 'function' && this.model.global.has('selectedMode')) await this.sendCode({ code: 'set global.selectedMode = "FFF"', log: true });
				await new Promise(done => setTimeout(done, 1500));
				if (!this.isFff) throw new Error(i18n.t('plugins.WorkshopPrinting.printing.mode_not_changed', { mode: this.mode || '?' }));
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.fff_mode_loaded_check_in_status');
				setTimeout(() => { if (this.isFff) this.section = 'state'; }, 1500);
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.could_not_change_mode', { error: e.message || String(e) });
			}
		},
		async cool() {
			const codes = this.tools.map(t => `M568 P${t.number} A0`);
			if (this.heaters.some(h => h.paper === 'bed')) codes.push('M140 S0');
			if (this.heaters.some(h => h.paper === 'camera')) codes.push('M141 S0');
			try {
				for (const c of codes) await this.sendCode({ code: c, log: true });
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.heaters_off_the_automatic_fans_keep');
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.could_not_turn_off', { error: e.message || String(e) });
			}
		}
	}
};
</script>

<style scoped>
.banner-mode {
	border-color: #ff8f00 !important;
}
.edge-fault {
	border-color: #e53935 !important;
}
.table-config td:first-child {
	white-space: nowrap;
	color: var(--tp-faint, #9e9e9e);
	width: 1%;
}
.response-board {
	font-size: 12px;
	white-space: pre-wrap;
	word-break: break-word;
	padding: 6px 8px;
	border: 1px solid rgba(128, 128, 128, 0.3);
	border-radius: 4px;
}
</style>
