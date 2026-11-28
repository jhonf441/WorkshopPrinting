<template>
	<v-container fluid class="pa-0 workshop-theme impresion-page pc-page">
		<page-header icon="mdi-printer-3d-nozzle" :title="$t('plugins.WorkshopPrinting.common.3d_printing')" lead="plugins.WorkshopPrinting.printing.page_lead" :reasons="headerReasons" :loading="!mode">
			<v-chip small :color="isFff ? 'success' : 'warning'" outlined>{{ $t('plugins.WorkshopPrinting.printing.mode_name', { mode: mode || '...' }) }}</v-chip>
			<v-chip v-if="tool" small outlined>{{ tool.name || ('T' + tool.number) }}</v-chip>
			<template v-slot:startup><startup-panel plugin="WorkshopPrinting" :defs="noStartupRows" @state="startupPending = $event.pending" /></template>
		</page-header>
					<!-- Outside FFF: ONE thin note (mode-gate: state elsewhere), the page stays for reading; what acts is off with its reason. The mode switch is in the bar -->
					<!-- a machine set up WITHOUT 3D printing (profile answered, FFF off) is told so (mode-gate.js, state unused) -->
					<session-notice v-if="fffUnused" class="mb-3" variant="section" kind="empty" :text="unusedText" />
					<mode-notice v-else-if="!isFff && mode" class="mb-3" :needs="['FFF']" />
		<!-- the tool the sections show (a machine with several tools): one thin strip for every section, under the header -->
			<div v-if="tools.length > 1" class="pc-toolbar" role="group" :aria-label="$t('plugins.WorkshopPrinting.printing.tool_view')">
				<span>{{ $t('plugins.WorkshopPrinting.printing.tool_view') }}</span>
				<v-btn-toggle :value="tool ? tool.number : null" mandatory dense outlined color="primary" @change="v => { viewTool = v }">
					<v-btn v-for="t in tools" :key="t.number" :value="t.number" small>{{ t.name || 'T' + t.number }}</v-btn>
				</v-btn-toggle>
			</div>
			<div class="st-layout">
				<side-tabs :value="section" :items="tabItems" @input="changeSection" />
				<div class="st-body" :style="{ '--wf-sec': secColor }">
				<locked-cover v-if="lockedNow" :needed="lockedNow" :items="tabItems" :value="section" />
				<v-tabs-items v-else v-model="section" class="transparent">
					<!-- ===== Operate: Estado ===== -->
					<v-tab-item value="state">
						<state-section :is-fff="isFff" :heaters="heaters" :tools="tools" :tool="tool" :fans="fans" :extruder="extruder" :samples="samples" :series-chart="seriesChart" :cold-allowed="coldAllowed" :min-ext-cold="minExtCold" :min-ret-cold="minRetCold" @risk-touched="riskAttempt = Date.now()" />
					</v-tab-item>
					<!-- ===== Operate: bed zones, live part (the map, the setpoints, the zone table and the chart) ===== -->
					<v-tab-item value="bed">
						<pc-section icon="mdi-radiator" :title="$t('plugins.WorkshopPrinting.printing.bed_zones_live')" :lead="$t('plugins.WorkshopPrinting.bedZones.lead')">
							<template v-if="bedBadge" v-slot:right><span class="wf-state" :class="bedBadge.kind" role="status">{{ $tc('plugins.WorkshopPrinting.bedZones.badge_' + bedBadge.key, bedBadge.m, bedBadge) }}</span></template>
							<bed-zones part="live" :series="seriesChart" :samples="samples" :is-fff="isFff" @goto="goTo" @badge="bedBadge = $event" />
						</pc-section>
					</v-tab-item>

					<!-- ===== Configure: bed zones, setup part (layout editor on the map, power estimate, insulation test, settings; the calibration assistant under it: the service preheats and tunes the zones and saves the results, always with the person present) ===== -->
					<v-tab-item v-if="canConfig" value="bedsetup">
						<pc-section icon="mdi-tune-variant" :title="$t('plugins.WorkshopPrinting.printing.bed_zones_setup')" :lead="$t('plugins.WorkshopPrinting.bedZones.setup_lead')" role="technician">
							<bed-zones part="setup" :series="seriesChart" :samples="samples" :is-fff="isFff" />
							<bed-calibration />
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

					<!-- ===== Operate: the tool. One entry, the part by the kind of the tool seen: the pellet panel (fans, motor test, feed now, heat a zone), or the filament
					     panel (heater, extruder flow, layer fan, hotend fan) with the load / unload under it. A viewer sees it read only (each part says why it is off) ===== -->
					<v-tab-item value="tool">
						<pc-section icon="mdi-printer-3d-nozzle" :title="$t('plugins.WorkshopPrinting.printing.tool')" :lead="$t('plugins.WorkshopPrinting.printing.tool_lead_' + toolKind)">
							<template v-slot:right><v-chip small outlined>{{ toolName }}</v-chip><v-chip small outlined>{{ $t('plugins.WorkshopPrinting.extruder.kind_' + toolKind) }}</v-chip><v-btn v-if="tabItems.some(i => i.id === 'extruder')" small text class="pc-change wf-hit" @click="goSection('extruder')">{{ $t('plugins.WorkshopPrinting.printing.change_extruder_type') }}</v-btn></template>
							<pellet v-if="toolKind === 'pellet'" :is-fff="isFff" :current-tool="tool" :heaters="heaters" :tools="tools" :fans="fans" @goto="goTo" />
							<template v-else>
								<filament-panel :is-fff="isFff" :tool="tool" :heaters="heaters" :fans="fans" :state="state" @goto="goTo" />
								<filament-load :is-fff="isFff" :tool="tool" :nozzle="nozzle" :min-extrusion="minExtrusion" :state="state" />
							</template>
						</pc-section>
					</v-tab-item>

					<!-- ===== Configure: pellet zones (reorder, steps, feeding, outputs and sensors; writes modefff.g) ===== -->
					<v-tab-item v-if="canConfig" value="zones">
						<pellet-setup :is-fff="isFff" :current-tool="tool" :heaters="heaters" :fans="fans" :state="state" @goto="goTo" />
					</v-tab-item>

					<!-- ===== Prepare: Profiles (the material profiles: list and editor, preheat) ===== -->
					<v-tab-item v-if="canOperate" value="profiles">
						<profiles :is-fff="isFff" :heaters="heaters" :tools="tools" :current-tool="tool" :state="state" @goto="goTo" />
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
						<fff-job :is-fff="isFff" @goto="goTo" />
					</v-tab-item>

					<!-- ===== Prepare: Prepare job: file, profile, what changes (read only), Preheat and Apply ===== -->
					<v-tab-item value="prepare">
						<pc-section icon="mdi-clipboard-list-outline" :title="$t('plugins.WorkshopPrinting.printing.prepare_job')">
							<prepare-job ref="prepare" :is-fff="isFff" :heaters="heaters" :tools="tools" :current-tool="tool" :state="state" :tool-kind="toolKind" @goto="goTo" />
						</pc-section>
					</v-tab-item>

					<!-- ===== Prepare: the G-code library: the slicing of every file (list, layer preview, info) from the parsed cache of the service ===== -->
					<v-tab-item value="library">
						<pc-section icon="mdi-bookshelf" :title="$t('plugins.WorkshopPrinting.printing.gcode_library')">
							<gcode-library-page :is-fff="isFff" @goto="goTo" />
						</pc-section>
					</v-tab-item>
				</v-tabs-items>
				</div>
				</div>
		<!-- "You have unsaved changes": the one dialog of the page (vue/_shared36, the guard of the service page); the editors register themselves -->
		<wf-unsaved-dialog />
	</v-container>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import HeadChange from './HeadChange.vue'
import PcSection from './PcSection.vue' // the card with the header of a section (printing-design.css)
import Profiles from './Profiles.vue'
import extruder from './Extruder.vue'
import Pid from './Pid.vue'
import Pellet from './Pellet.vue'
import PelletSetup from './PelletSetup.vue'
import PrepareJob from './PrepareJob.vue'
import GcodeLibraryPage from './GcodeLibraryPage.vue' // the G-code library (list + layer preview + info of every indexed file)
import StartupPanel from './StartupPanel.vue' // start-up strip (vue/_shared)
import PageHeader from './PageHeader.vue' // header of every page (vue/_shared)
import { printModesMixin } from './print-modes-mixin.js' // which modes the machine uses: rows, entry, head change
import StartupPrint from './PrintingStartup.vue' // the start-up assistant of the printing page (not the shared card, see HeadChange.vue)
import StateSection from './StateSection.vue' // the State section: heaters, chart, fans, configuration, cold extrusion
import BedZones from './BedZones.vue' // the bed split in zones: map, setpoints, chart and settings (service op bedzones.*)
import BedCalibration from './BedCalibration.vue' // calibration assistant of the zones: the service preheats, tunes and saves (with confirmation, Stop and a backup)
import FffJob from './FffJob.vue' // 3D job tab: temperatures, print state, job control and 3D view (moved from the Workbench)
import FilamentLoad from './FilamentLoad.vue' // load / unload filament (filament tools only)
import { explainSensor, isSensorFault } from './util.js'
import { pluginOf } from './workshop-ids.js' // the new or the old id of the plugin (vue/_shared)
import { jobDraft, draftJobEnded } from './job-draft.js' // the job being prepared (file + profile), shared by the sections
import { jobRunning } from './job-control.js'
import { RISK_COLD, startColdRisk, endColdRisk } from './cold-risk.js' // the active risk of the cold extrusion (service risk.start / risk.end)

const TAB_KEY = 'workshopPrintingSection';
// History of the State chart (2026-10-11): one sample every 2 s, 10 min.
const SAMPLE_MS = 2000;
const SAMPLES_MAX = 300;
// Series colors per heater (fixed order: the color follows the heater,
// not its position in the visible list).
const colors = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#2a78d6'];

import SideTabs from './SideTabs.vue'
import { sectionColor } from './section-colors.js' // the color of the open section (top line of the card)
import { roleMixin } from './role-mixin.js' // what the role sees and may do (vue/_shared)
import { sideItems, sectionToShow, lockedSection, restoreSection, hiddenIds, NEED, SECTIONS } from './print-sections.js'
import SessionNotice from './SessionNotice.vue' // vue/_shared36
import { modeGate } from './mode-gate.js' // vue/_shared36
import { ts as tShared } from './shared-t.js' // vue/_shared36
import { currentMode } from './current-mode.js' // the one rule of the real mode: state.machineMode, then global.selectedMode (vue/_shared36)
import ModeNotice from './ModeNotice.vue' // vue/_shared36: the thin note outside FFF
import LockedCover from './LockedCover.vue' // the cover of a section the role cannot open (vue/_shared36)
import WfUnsavedDialog from './WfUnsavedDialog.vue' // vue/_shared36: keep editing / save and leave / discard
import { confirmLeave, routeGuard } from './unsaved-guard.js' // vue/_shared36: one door out of every editor
import FilamentPanel from './FilamentPanel.vue'
import { kindOfTool, loadExtruderKinds } from './extruder-kind.js' // pellets or filament of each tool: the pellet sections only show for a pellet tool

export default {
	mixins: [roleMixin, printModesMixin],
	// what the person who left had chosen stays nowhere: the tool picked for the view goes back to the one of the machine (each section clears its own, role-mixin.js)
	sessionData: ['viewTool'],
	// leaving the page (DWC's menu, Back) with something unsaved asks first; a change inside the page is changeSection / goSection
	beforeRouteLeave(to, from, next) {
		routeGuard(to, from, next);
	},
	components: { WfUnsavedDialog, SessionNotice, ModeNotice, PageHeader, SideTabs, LockedCover, HeadChange: HeadChange, Profiles, Extrusor: extruder, Pid, Pellet, PelletSetup, PrintingStartup: StartupPrint, StartupPanel: StartupPanel, StateSection, BedZones, BedCalibration, PrepareJob, GcodeLibraryPage, FffJob, FilamentLoad, FilamentPanel, PcSection },
	data() {
		let section = restoreSection(null);
		try {
			const saved = localStorage.getItem(TAB_KEY);
			section = restoreSection(saved);
		} catch (e) {
			/* no critico */
		}
		return {
			section, samples: [],
			// the tool the person picked for the view in the strip of the shell (null: the one the machine has now)
			viewTool: null,
			bedBadge: null, // the badge the live bed section tells (zones, all fine) for the head of its card
			// the file of the job the machine is running, remembered while it runs (the model forgets it when the job ends)
			jobFileSeen: '',
			// cold extrusion: with M302 P1 the model reports 0 in both
			// temperatures; the last real ones are remembered to show them
			lastMinExt: null, lastMinRet: null, riskAttempt: 0,
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
		jobFileNow: { immediate: true, handler(v) { if (v) this.jobFileSeen = v; } },
		// the job of the draft finished or was cancelled: the draft is cleared (an old draft that comes back is worse than choosing again)
		state(now, before) {
			if (draftJobEnded(jobRunning(before), jobRunning(now), this.jobFileSeen, jobDraft.get().file)) jobDraft.clear();
		},
		section(v) {
			// Prepare job reads the profiles again each time it is shown: a profile created or saved in Profiles is there when the person comes back
			if (v === 'prepare') this.whenMounted('prepare', p => p.onActivate());
			try {
				localStorage.setItem(TAB_KEY, String(v));
			} catch (e) {
				/* no critico */
			}
		}
	},
	computed: {
		toolKind() {
			return this.tool ? kindOfTool(this.tool.number) : 'pellet';
		},
		toolName() {
			return this.tool ? this.tool.name || 'T' + this.tool.number : '';
		},
		secColor() {
			return sectionColor(this.section);
		},
		// the mode files and, once sys/config.g was read, whether it calls automodeselect.g (never edited from here)
		tabItems() {
			return sideItems(k => this.$t('plugins.WorkshopPrinting.' + k), this.isFff, op => this.canDo(op), hiddenIds(this.hideHead, this.toolKind));
		},
		// operator: heat, fans, preheat; technician: what writes the configuration, changes the mode or the head (NEED, print-sections.js).
		// Without identity / users / an old service everything is shown (role-view.js)
		canOperate() {
			return this.atLeast(NEED.operate);
		},
		// every section with its role
		allSections() {
			return SECTIONS;
		},
		// the role that opens the open section, or '' when this role may
		lockedNow() {
			return lockedSection(this.section, op => this.canDo(op));
		},
		canConfig() {
			return this.atLeast(NEED.configure);
		},
		model() {
			return this.$store.state.machine.model;
		},
		mode() {
			return currentMode(this.model);
		},
		isFff() {
			return this.mode === 'FFF';
		},
		// the machine does not use FFF at all (the profile is answered and FFF is off)
		fffUnused() {
			return modeGate(['FFF'], this.mode, this.modeState).state === 'unused';
		},
		unusedText() {
			return tShared('mode_unused');
		},
		state() {
			return (this.model.state && this.model.state.status) || '';
		},
		jobFileNow() {
			return (this.model.job && this.model.job.file && this.model.job.file.fileName) || '';
		},
		homed() {
			const ax = (this.model.move && this.model.move.axes) || [];
			return ax.length > 0 && ax.filter(a => a && ['X', 'Y', 'Z'].includes(a.letter)).every(a => a.homed);
		},
		tools() {
			return (this.model.tools || []).filter(t => t);
		},
		// the tool the page works on: the one the person picked here, else the one the machine has now
		tool() {
			const cur = this.viewTool !== null ? this.viewTool : this.model.state && this.model.state.currentTool;
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
				if (beds.includes(i)) { papel = 'bed'; nombre = i18n.t('plugins.WorkshopPrinting.printing.bed') + (beds.length > 1 ? ' ' + i18n.t('plugins.WorkshopPrinting.printing.zone_n_lower', { n: beds.indexOf(i) + 1 }) : ''); icon = 'mdi-radiator'; }
				else if (cameras.includes(i)) { papel = 'camera'; nombre = i18n.t('plugins.WorkshopPrinting.printing.heated_chamber') + (cameras.length > 1 ? ' ' + i18n.t('plugins.WorkshopPrinting.printing.zone_n_lower', { n: cameras.indexOf(i) + 1 }) : ''); icon = 'mdi-home-thermometer-outline'; }
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
		loadExtruderKinds();
		this.sample();
		this.timerSample = setInterval(this.sample, SAMPLE_MS);
		this.recheckModes();
	},
	beforeDestroy() {
		clearInterval(this.timerSample);
	},
	methods: {
		// the person signed in / out or the role changed: what was read with the old session is read again
		onSessionChange(kind) {
			loadExtruderKinds();
			this.recheckModes();
			// what the person who left was preparing does not stay for the next one
			if (kind === 'signed-out' || kind === 'role-changed') jobDraft.clear();
		},
		// the open section when the mode or the role changes
		fitSection() {
			if (!this.mode) return;
			const s = sectionToShow(this.section, this.isFff, op => this.canDo(op), hiddenIds(this.hideHead, this.toolKind));
			if (s !== this.section) this.section = s;
		},
		// a touch on the bar of sections: an editor with changes asks first (keep editing / save and leave / discard); the bar keeps showing the open one until the answer
		changeSection(id) {
			if (id === this.section) return;
			confirmLeave(() => { this.section = id; });
		},
		goSection(id) {
			// the head change has no entry in the bar of a one-mode machine (hideHead) but its page still opens: the banner and the "first switch to FFF"
			// button of the tests send people there, so a hidden entry must not turn them back
			if (id === 'head' && this.hideHead && this.canConfig) {
				confirmLeave(() => { this.section = 'head'; });
				return;
			}
			const to = sectionToShow(id, this.isFff, op => this.canDo(op), hiddenIds(this.hideHead, this.toolKind));
			if (to !== this.section) confirmLeave(() => { this.section = to; });
		},
		// a shortcut of the pellet panel: another section and, in PID, the heater to tune
		goTo(g) {
			this.goSection(g.section);
			// arriving at Prepare job from another section (the files, the profiles): the focus goes to the first step that is not done
			if (g.focus && g.section === 'prepare') this.whenMounted('prepare', p => p.focusCurrent());
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
		// a section mounts after the change of tab: wait for its ref (up to 2 s) and then do something with it
		whenMounted(ref, fn) {
			let n = 0;
			const tryIt = () => {
				const c = this.$refs[ref];
				if (c) fn(c);
				else if (++n < 20) setTimeout(tryIt, 100);
			};
			this.$nextTick(tryIt);
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
		// The active risk follows the board's REAL state while this page
		// is open: if it was allowed by console or the risk expired (D3600) it
		// is opened again; if the board restarted, it is closed. One attempt per minute.
		syncRisk() {
			const r = this.risksPi;
			if (!r || this.coldAllowed == null || Date.now() - this.riskAttempt < 60000) return;
			const open = r.some(e => e && e.id === RISK_COLD);
			if (this.coldAllowed && !open) {
				this.riskAttempt = Date.now();
				startColdRisk().catch(() => {});
			} else if (!this.coldAllowed && open) {
				this.riskAttempt = Date.now();
				endColdRisk().catch(() => {});
			}
		}
	}
};
</script>
