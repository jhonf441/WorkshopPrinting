<template>
	<pc-section icon="mdi-chart-bell-curve" :title="$t('plugins.WorkshopPrinting.common.pid')" :bare="zonesOnly">
		<details v-if="!zonesOnly" class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>
			{{ $t('plugins.WorkshopPrinting.pid.intro') }} <b>{{ $t('plugins.WorkshopPrinting.pid.do_not_leave') }}</b>
			</p>
		</details>
		<v-alert v-if="!isFff" dense text type="info" class="mt-3 mb-0">{{ $t('plugins.WorkshopPrinting.pid.the_nozzle_and_the_bed_only') }}</v-alert>
		<template v-else>
			<template v-if="!zonesOnly">
			<v-row dense class="mt-3" align="center">
				<v-col cols="12" sm="4">
					<v-btn-toggle v-model="which" mandatory dense color="primary">
						<v-btn v-for="h in options" :key="h.id" small :value="h.id">{{ h.name }}</v-btn>
					</v-btn-toggle>
				</v-col>
				<v-col cols="6" sm="2"><v-text-field v-model.number="temp" :label="$t('plugins.WorkshopPrinting.pid.temperature_c')" type="number" dense outlined hide-details /></v-col>
				<v-col cols="6" sm="3">
					<v-btn small outlined color="error" :disabled="!can || !!inProgress" @click="touch()">
						{{ armed ? $t('plugins.WorkshopPrinting.pid.tap_again_it_will_heat') : $t('plugins.WorkshopPrinting.pid.calibrate') }}
					</v-btn>
				</v-col>
			</v-row>
			<div v-if="reasonNo" class="text-caption warning--text mt-1"><v-icon x-small color="warning" class="mr-1">mdi-lock-outline</v-icon>{{ reasonNo }}</div>
			<div v-if="chosen && temp > chosen.max" class="text-caption error--text">{{ $t('plugins.WorkshopPrinting.pid.above_machine_limit', { max: chosen.max }) }}</div>
			<div v-if="inProgress && !zActive" class="text-body-2 mt-2">
				<v-progress-circular indeterminate size="16" width="2" class="mr-1" />
				{{ $t('plugins.WorkshopPrinting.pid.tuning_in_progress', { name: inProgress.name, c: Math.round(inProgress.current) }) }}
			</div>
			<pid-tune-chart v-if="trace && trace.points.length > 1" :trace="trace" />
			<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopPrinting.pid.current_model_of', { name: chosen ? chosen.name.toLowerCase() : '...' }) }}</div>
			<div class="text-body-2" style="font-family:var(--tp-font-mono, monospace)">{{ modelTxt || $t('plugins.WorkshopPrinting.common.reading') }}</div>
			<template v-if="line">
				<div class="text-body-2 mt-2">{{ $t('plugins.WorkshopPrinting.pid.line_for_modefff') }} <code>{{ line }}</code></div>
				<div class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pid.now_in_the_file') }} <code>{{ lineFile || $t('plugins.WorkshopPrinting.pid.not_read') }}</code></div>
				<div class="d-flex flex-wrap mt-2" style="gap:8px">
					<v-btn small :color="armedG ? 'amber darken-3' : 'primary'" :disabled="!lineFile || lineFile.trim().startsWith(line)" :loading="saving" @click="touchSave()">
						{{ armedG ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.common.save_to_modefff_g') }}
					</v-btn>
					<v-btn small text @click="readModel()">{{ $t('plugins.WorkshopPrinting.pid.read_again') }}</v-btn>
				</div>
				<div class="text-caption grey--text mt-1">
					{{ $t('plugins.WorkshopPrinting.pid.after_tuning_the_new_model_is') }}
				</div>
			</template>

			<!-- 2026-10-11: how the selected heater's PID is and how it works,
			     with the current values (read only; see PidDetail.vue) -->
			<v-divider v-if="chosen" class="my-4" />
			<pid-detail v-if="chosen" :om-heaters="heaters" :chosen="chosen" :reference="refTemp" :model-txt="modelTxt" @choose="which = $event" />

			</template>
			<!-- 2026-10-11: all the zones of a tool (pellet / several zones), one at a time,
			     with the neighbours hot. Done by the service (API pid.start): it continues even if the page is closed. -->
			<template v-if="toolsZones.length">
				<v-divider v-if="!zonesOnly" class="my-4" />
				<div v-if="!zonesOnly" class="text-subtitle-1 font-weight-medium">{{ $t('plugins.WorkshopPrinting.pid.all_zones_automatic') }}</div>
				<details class="wf-more mt-1">
					<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
					<p>
					{{ $t('plugins.WorkshopPrinting.pid.in_a_barrel_with_several_zones') }} <b>{{ $t('plugins.WorkshopPrinting.pid.coupled') }}</b>{{ $t('plugins.WorkshopPrinting.pid.if_you_tune_a_zone_with') }}
					</p>
				</details>
				<v-row v-if="toolsZones.length > 1" dense class="mt-2">
					<v-col cols="12">
						<v-btn-toggle v-model="toolZ" mandatory dense color="primary">
							<v-btn v-for="t in toolsZones" :key="t" small :value="t" :disabled="zActive">T{{ t }}</v-btn>
						</v-btn-toggle>
					</v-col>
				</v-row>
				<v-simple-table dense class="mt-2">
					<thead>
						<tr><th>{{ $t('plugins.WorkshopPrinting.common.zone') }}</th><th>{{ $t('plugins.WorkshopPrinting.common.now') }}</th><th>{{ $t('plugins.WorkshopPrinting.pid.target_c') }}</th><th>{{ $t('plugins.WorkshopPrinting.pid.result') }}</th></tr>
					</thead>
					<tbody>
						<tr v-for="z in zonesSel" :key="z.id" :class="zCurrent === z.id ? 'zone-current' : ''">
							<td>{{ z.name }}<span class="grey--text text-caption"> (H{{ z.id }})</span></td>
							<td>{{ z.current != null ? Math.round(z.current) + ' °C' : '-' }}</td>
							<td style="max-width:120px">
								<v-text-field v-model.number="objZ[z.id]" type="number" dense hide-details :disabled="zActive"
									:error="!tempZOk(z)" :suffix="$t('plugins.WorkshopPrinting.pid.limit_n', { n: z.max })" />
							</td>
							<td>
								<v-chip x-small outlined :color="chipZ(z.id).color">{{ chipZ(z.id).text }}</v-chip>
							</td>
						</tr>
					</tbody>
				</v-simple-table>
				<div v-if="zonesSel.some(z => !tempZOk(z))" class="text-caption error--text">{{ $t('plugins.WorkshopPrinting.pid.each_target_must_be_from_50') }}</div>
				<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
					<v-btn small outlined color="error" :disabled="!canZ" @click="touchZones()">
						{{ armedZ ? $t('plugins.WorkshopPrinting.pid.tap_again_it_will_heat') : $t('plugins.WorkshopPrinting.pid.tune_all') }}
					</v-btn>
					<v-btn v-if="zActive" small outlined :loading="cancellingZ" @click="cancelZones()">
						<v-icon small left>mdi-stop</v-icon>{{ $t('plugins.WorkshopPrinting.pid.cancel') }}
					</v-btn>
					<span v-if="!zActive && reasonNoZ" class="text-caption grey--text">{{ reasonNoZ }}</span>
				</div>
				<div v-if="zActive" class="text-body-2 mt-2">
					<v-progress-circular indeterminate size="16" width="2" class="mr-1" />
					{{ textPhaseZ }}
					<span class="grey--text">({{ minutesZ }} min)</span>
					<div class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pid.to_stop_cancel_turns_the_zones') }}</div>
				</div>
				<v-alert v-if="zState && !zActive && zState.error" dense text :type="zState.phase === 'finished' ? 'warning' : 'error'" class="mt-2 mb-0">{{ zState.error }}</v-alert>
				<div v-for="z in zErrors" :key="'e' + z.h" class="text-caption error--text">H{{ z.h }}: {{ z.error }}</div>
				<template v-if="linesZ.length && !zActive">
					<div class="text-subtitle-2 mt-3 mb-1">{{ $t('plugins.WorkshopPrinting.pid.new_lines_for_sys_modefff_g') }}</div>
					<div v-for="l in linesZ" :key="l.h" class="text-body-2"><code>{{ l.line }}</code></div>
					<div class="d-flex flex-wrap mt-2" style="gap:8px">
						<v-btn small :color="armedZG ? 'amber darken-3' : 'primary'" :loading="savingZ" @click="touchSaveZones()">
							{{ armedZG ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pid.save_all_to_modefff_g') }}
						</v-btn>
					</div>
					<div class="text-caption grey--text mt-1">
						{{ $t('plugins.WorkshopPrinting.pid.the_new_models_are_already_in') }}
					</div>
				</template>
			</template>
		</template>
		<error-notice v-if="failure" :error="failure" class="mt-3" />
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</pc-section>
</template>

<script>
import i18n from '../../i18n'
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)

'use strict'

import { mapActions } from 'vuex'
import { api, apiText } from './workshop-api.js'
import { MODE_FILE, CFG_FILE, MATERIALS_DEF, readText, writeText, readJson, changeLineMode, isError, markStartup, note } from './util.js'
import PidDetail from './PidDetail.vue'
import PidTuneChart from './PidTuneChart.vue'
import { fromService } from './pid-trace.js'
import { lineSince, replaceM307Lines } from './mode-lines.js'
import { rememberForNozzle } from './nozzle-store.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)
import { isFriendly } from './print-errors.js'
import { NEED } from './print-sections.js'


export default {
	mixins: [roleMixin],
	components: { PidDetail: PidDetail, PidTuneChart, ErrorNotice, PcSection },
	props: {
		isFff: { type: Boolean, default: false },
		zonesOnly: { type: Boolean, default: false }, // only the all-zones tuning (mounted inside the pellet setup)
		heaters: { type: Array, default: () => [] },
		tool: { type: Object, default: null },
		state: { type: String, default: '' }
	},
	data() {
		return {
			// the real record of the tuning in progress (or the last one): the SERVICE takes it (dsf/pid_trace.py); here it is only read
			trace: null, traceTick: 0, startedHere: null, destroyed: false, // startedHere: the target typed here, for when the board does not publish it
			which: null, temp: 200, armed: false, armedG: false, timer: null, modelTxt: '', lineFile: '', saving: false, msg: null, msgKind: 'info', failure: null, wasCalibrating: false,
			// all the zones (2026-10-11): state published by the Pi (S"estado") and editable targets
			toolZ: null, objZ: {}, zState: null, probing: null, armedZ: false, armedZG: false, cancellingZ: false,
			savingZ: false, textMode: '', cfgImp: null
		};
	},
	computed: {
		options() {
			return this.heaters.filter(h => h.paper === 'nozzle' || h.paper === 'bed' || h.paper === 'camera');
		},
		chosen() {
			return this.options.find(h => h.id === this.which) || null;
		},
		// temperature for the detail's calculations (2026-10-11): the target if it is
		// on; otherwise, the calibrate temperature from above
		refTemp() {
			const h = this.chosen;
			if (h && h.target > 0) return Number(h.target);
			const t = Number(this.temp);
			return Number.isFinite(t) && t > 0 ? t : 200;
		},
		// why "Calibrate" is locked: the button is only grey, so the page says the reason (a heater in fault, a bad temperature, a busy machine)
		reasonNo() {
			const h = this.chosen;
			if (!this.isFff || this.inProgress || this.can || !h) return '';
			const t = k => this.$t('plugins.WorkshopPrinting.pid.' + k, { name: h.name, c: Math.round(h.current), max: h.max });
			if (h.state === 'fault') return t('locked_heater_fault');
			if (this.zActive) return t('locked_zones_running');
			if (!(this.temp > 30) || this.temp > h.max) return t('locked_temperature');
			if (this.state === 'off') return t('locked_machine_off');
			if (this.state !== 'idle') return t('locked_machine_busy');
			return '';
		},
		inProgress() {
			return this.heaters.find(h => h.state === 'tuning') || null;
		},
		can() {
			const h = this.chosen;
			return this.isFff && !!h && h.state !== 'fault' && this.temp > 30 && this.temp <= h.max && this.state === 'idle' && !this.zActive;
		},
		// ---- all the zones (2026-10-11) ----
		toolsZones() {
			return [...new Set(this.heaters.filter(h => h.paper === 'nozzle' && h.tool != null).map(h => h.tool))].sort((a, b) => a - b);
		},
		zonesSel() {
			return this.heaters.filter(h => h.paper === 'nozzle' && h.tool === this.toolZ).sort((a, b) => a.zone - b.zone);
		},
		zActive() {
			return !!(this.zState && this.zState.active);
		},
		zCurrent() {
			const e = this.zState;
			if (!e || !e.active || e.zone_current == null) return null;
			const z = (e.zones || [])[e.zone_current];
			return z ? z.h : null;
		},
		canZ() {
			return this.isFff && !this.zActive && !this.reasonNoZ && this.zonesSel.length > 0 && this.zonesSel.every(z => this.tempZOk(z));
		},
		reasonNoZ() {
			if (this.zActive) return '';
			if (this.state !== 'idle') return i18n.t('plugins.WorkshopPrinting.pid.the_machine_has_to_be_idle');
			if (this.inProgress) return i18n.t('plugins.WorkshopPrinting.pid.a_heater_is_already_being_tuned');
			if (this.zonesSel.some(z => z.state === 'fault')) return i18n.t('plugins.WorkshopPrinting.pid.a_zone_is_in_fault_check');
			return '';
		},
		textPhaseZ() {
			const e = this.zState || {};
			const zs = e.zones || [];
			const z = e.zone_current != null ? zs[e.zone_current] : null;
			if (!z) return i18n.t('plugins.WorkshopPrinting.pid.preparing');
			const nom = this.nameZ(z.h) + ' ' + i18n.t('plugins.WorkshopPrinting.pid.n_of_total_paren', { n: e.zone_current + 1, total: zs.length });
			const cold = Math.round(z.t - (e.margin_cold || 25));
			if (e.phase === 'calibrando') return i18n.t('plugins.WorkshopPrinting.pid.phase_tuning', { zone: nom });
			if (e.phase === 'waiting') {
				if (zs.length === 1) return i18n.t('plugins.WorkshopPrinting.pid.phase_waiting_cool', { zone: nom, c: cold });
				const missing = [];
				if (!e.neighbors_lists) missing.push(i18n.t('plugins.WorkshopPrinting.pid.wait_neighbours'));
				if (!e.zone_cold) missing.push(i18n.t('plugins.WorkshopPrinting.pid.wait_zone_cool', { c: cold }));
				return i18n.t('plugins.WorkshopPrinting.pid.phase_waiting_for', { zone: nom, what: missing.length ? missing.join(' ' + i18n.t('plugins.WorkshopPrinting.pid.and') + ' ') : i18n.t('plugins.WorkshopPrinting.pid.the_temperature_to_settle') });
			}
			return i18n.t('plugins.WorkshopPrinting.pid.phase_preparing', { zone: nom });
		},
		minutesZ() {
			const e = this.zState;
			return e && e.since ? Math.max(0, Math.round(((e.now || Date.now() / 1000) - e.since) / 60)) : 0;
		},
		zErrors() {
			return ((this.zState && this.zState.zones) || []).filter(z => z.error);
		},
		linesZ() {
			const zs = (this.zState && this.zState.zones) || [];
			const out = [];
			zs.forEach(z => {
				if (z.result !== 'ok' || !z.model) return;
				const l = lineSince(z.h, z.model, this.eOf(z.h));
				if (l) out.push({ h: z.h, line: l });
			});
			return out;
		},
		eLine() {
			const m = this.lineFile.match(/\bE([\d.]+)/);
			return m ? m[1] : '1.35';
		},
		line() {
			return this.chosen && this.modelTxt ? lineSince(this.chosen.id, this.modelTxt, this.eLine) : null;
		}
	},
	watch: {
		msg(v) {
			if (v) this.failure = null;
		},
		options: {
			immediate: true,
			handler(o) {
				if (!o.find(h => h.id === this.which) && o.length) {
					this.which = o[0].id;
					// the watcher of which one does not exist yet in the first round (immediate): the
					// temperature according to the type is set here (2026-10-11: the bed ended up at 200 °C)
					const h = o[0];
					this.temp = h.paper === 'bed' ? 60 : h.paper === 'camera' ? 45 : 200;
				}
			}
		},
		which() {
			const h = this.chosen;
			if (h) this.temp = h.paper === 'bed' ? 60 : h.paper === 'camera' ? 45 : 200;
			this.readModel();
		},
		toolsZones: {
			immediate: true,
			handler(t) {
				if (!t.includes(this.toolZ) && t.length) this.toolZ = this.tool && t.includes(this.tool.number) ? this.tool.number : t[0];
			}
		},
		zonesSel: {
			immediate: true,
			handler() {
				this.targetsPerDefault(false);
			}
		},
		inProgress(v) {
			// when the calibration ends, read the new model (the all-zones one notifies by itself)
			if (this.zActive) {
				this.wasCalibrating = false;
				return;
			}
			if (v) this.wasCalibrating = true;
			else if (this.wasCalibrating) {
				this.wasCalibrating = false;
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.pid.tuning_finished_check_the_new_model');
				setTimeout(() => this.readModel(), 1500);
			}
		}
	},
	async mounted() {
		this.readTrace();
		this._traceTimer = setInterval(this.followTrace, 3000);
		this.cfgImp = (await readJson(CFG_FILE, {})) || {};
		this.targetsPerDefault(false);
		// in case one was left running (the Pi continues it even if the page is closed)
		this.readStateZ();
	},
	beforeDestroy() {
		this.destroyed = true;
		clearInterval(this._traceTimer);
		clearTimeout(this.timer);
		clearTimeout(this.probing);
	},
	methods: {
		async readTrace() {
			if (this.destroyed) return;
			try {
				const r = await api('pid.trace', {}, { quiet: true, noLogin: true });
				const raw = r && r.trace;
				const h = raw ? this.heaters.find(x => x.id === raw.heater) : null;
				const mine = this.startedHere && raw && this.startedHere.id === raw.heater && raw.started_at * 1000 >= this.startedHere.at - 15000;
				this.trace = fromService(raw, h ? h.name : '', mine ? this.startedHere.temp : 0);
			} catch (e) {
				/* the chart keeps what it had */
			}
		},
		// every 3 s while a tuning goes on (or the last answer says it does), every 15 s otherwise, and never with the page hidden
		followTrace() {
			if (document.hidden) return;
			this.traceTick++;
			if (this.inProgress || (this.trace && !this.trace.endedAt) || this.traceTick % 5 === 1) this.readTrace();
		},
		...mapActions('machine', ['sendCode']),
		// a failed step: a missing role / PIN / service is shown with ErrorNotice (what role is needed, the PIN dialog); the rest keeps its text
		fail(e, text) {
			if (isFriendly(e)) {
				this.failure = e;
				this.msg = null;
				return;
			}
			this.failure = null;
			this.msgKind = 'error';
			this.msg = text;
		},
		arm(flag) {
			this[flag] = true;
			clearTimeout(this.timer);
			this.timer = setTimeout(() => { this.armed = false; this.armedG = false; this.armedZ = false; this.armedZG = false; }, 4000);
		},
		async readModel() {
			const h = this.chosen;
			if (!h || !this.isFff) return;
			try {
				const r = await this.sendCode({ code: `M307 H${h.id}`, log: false });
				this.modelTxt = String(r || '').trim();
				const text = await readText(MODE_FILE);
				const l = text.split(/\r?\n/).find(x => x.trim().startsWith(`M307 H${h.id} `));
				this.lineFile = l ? l.split(';')[0].trim() : '';
			} catch (e) {
				this.modelTxt = i18n.t('plugins.WorkshopPrinting.pid.could_not_read', { error: e.message || String(e) });
			}
		},
		// Level 4 (DESIGN.md): it heats and cools by itself for several minutes. Notice with
		// warnings and a checkbox; while it lasts, the Pi marks it as an active risk
		// (red bar and LEDs) because it sees the heater in "tuning".
		touch() {
			const t = window.__workshop && window.__workshop.confirmLevel4;
			if (!t) {
				if (!this.armed) return this.arm('armed');
				this.armed = false;
				return this.calibrate();
			}
			const h = this.chosen;
			t({
				title: i18n.t('plugins.WorkshopPrinting.pid.tune_pid_title', { name: h.name, c: Math.round(this.temp) }),
				notices: [
					i18n.t('plugins.WorkshopPrinting.pid.the_heater_goes_up_and_down'),
					i18n.t('plugins.WorkshopPrinting.pid.while_it_lasts_no_job_controls'),
					i18n.t('plugins.WorkshopPrinting.pid.the_nozzle_and_the_bed_get'),
					i18n.t('plugins.WorkshopPrinting.pid.to_stop_status_turn_off_all')
				],
				understood: i18n.t('plugins.WorkshopPrinting.pid.understood_i_stay_next_to_the'),
				button: i18n.t('plugins.WorkshopPrinting.pid.tune')
			}).then(ok => { if (ok) this.calibrate(); });
		},
		async calibrate() {
			const h = this.chosen;
			const t = Math.round(this.temp);
			// a single zone: by the tool (RRF uses its fan); several zones (pellet): one at a time
			const zones = this.heaters.filter(x => x.paper === 'nozzle' && x.tool === h.tool).length;
			const code = h.paper === 'nozzle' && zones === 1 && h.tool != null ? `M303 T${h.tool} S${t}` : `M303 H${h.id} S${t}`;
			this.startedHere = { id: h.id, temp: t, at: Date.now() };
			try {
				const r = await this.sendCode({ code, log: true });
				if (isError(r)) throw new Error(r);
				this.msgKind = 'info';
				this.msg = i18n.t('plugins.WorkshopPrinting.pid.tuning_started', { name: h.name.toLowerCase(), c: t });
			} catch (e) {
				this.fail(e, i18n.t('plugins.WorkshopPrinting.pid.could_not_start', { error: e.message || String(e) }));
			}
		},
		touchSave() {
			if (!this.armedG) return this.arm('armedG');
			this.armedG = false;
			this.save();
		},
		// ---- all the zones (2026-10-11) ----
		nameZ(h) {
			const c = this.heaters.find(x => x.id === h);
			return c ? c.name : i18n.t('plugins.WorkshopPrinting.pid.heater_n', { n: h });
		},
		tempZOk(z) {
			const t = Number(this.objZ[z.id]);
			return Number.isFinite(t) && t >= 50 && t < z.max;
		},
		// Target of each zone: the one it has now if it is on; otherwise, that of the
		// last material (zone 1) plus its staging (Pellet); otherwise, the tool's active one.
		targetsPerDefault(pisar) {
			const cfg = this.cfgImp || {};
			const mats = Array.isArray(cfg.materials) && cfg.materials.length ? cfg.materials : MATERIALS_DEF;
			const mat = mats.find(m => m.name === cfg.last);
			const esc = cfg.step || {};
			const t = this.tool && this.tool.number === this.toolZ ? this.tool : null;
			const obj = Object.assign({}, this.objZ);
			this.zonesSel.forEach(z => {
				if (!pisar && obj[z.id] != null) return;
				let v = z.target > 0 ? z.target : null;
				if (v == null && mat) v = Math.round(mat.nozzle) + (z.zone > 0 ? Number(esc[z.id]) || 0 : 0);
				if (v == null && t && (t.active || [])[z.zone] > 0) v = t.active[z.zone];
				if (v == null) v = 200;
				if (z.max) v = Math.min(v, z.max - 5);
				obj[z.id] = Math.round(v);
			});
			this.objZ = obj;
		},
		chipZ(h) {
			const zs = (this.zState && this.zState.zones) || [];
			const z = zs.find(x => x.h === h);
			if (!z) return { text: '-', color: 'grey' };
			if (this.zCurrent === h) return { text: i18n.t('plugins.WorkshopPrinting.pid.running'), color: 'error' };
			return {
				ok: { text: i18n.t('plugins.WorkshopPrinting.pid.done'), color: 'success' },
				failure: { text: i18n.t('plugins.WorkshopPrinting.pid.failed'), color: 'error' },
				cut: { text: i18n.t('plugins.WorkshopPrinting.pid.stopped'), color: 'grey darken-1' },
				pending: { text: i18n.t('plugins.WorkshopPrinting.pid.pending'), color: 'grey' },
				in_progress: { text: i18n.t('plugins.WorkshopPrinting.pid.running'), color: 'error' }
			}[z.result] || { text: z.result, color: 'grey' };
		},
		eOf(h) {
			const l = this.textMode.split(/\r?\n/).find(x => x.trim().startsWith(`M307 H${h} `));
			const m = l && l.split(';')[0].match(/\bE([\d.]+)/);
			return m ? m[1] : '1.35';
		},
		// API of WorkshopService pid.<op>: the JSON text of the service, or throws
		async m9003(op, args) {
			const r = String((await apiText('pid.' + op, args || {})) || '').trim();
			if (!r.startsWith('{') && isError(r)) throw new Error(r.replace(/^Error:\s*/i, ''));
			return r;
		},
		async readStateZ() {
			clearTimeout(this.probing);
			const before = this.zActive;
			try {
				this.zState = JSON.parse(await this.m9003('status'));
				if (this.zState && this.zState.tool != null && (this.zActive || before)) this.toolZ = this.zState.tool;
				if (before && !this.zActive) await this.onFinishZ();
				else if (!this.zActive && this.linesZ.length && !this.textMode) this.textMode = await readText(MODE_FILE).catch(() => '');
			} catch (e) {
				// the service may not be there: it is retried by itself if it was running
			}
			if (this.zActive && !this._isDestroyed) this.probing = setTimeout(() => this.readStateZ(), 2000);
		},
		async onFinishZ() {
			const e = this.zState || {};
			this.textMode = await readText(MODE_FILE).catch(() => '');
			if (e.phase === 'finished' && !e.error) {
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.pid.tuning_of_all_zones_finished_check');
			} else if (e.phase === 'cancelled') {
				this.msgKind = 'info';
				this.msg = i18n.t('plugins.WorkshopPrinting.pid.zone_tuning_cancelled_the_zones_were');
			}
			this.readModel();
		},
		// Level 4 (DESIGN.md): it heats and cools by itself for a long time. The Pi
		// opens the active risk "pid_zones" (red bar and LEDs) while it lasts.
		touchZones() {
			const t = window.__workshop && window.__workshop.confirmLevel4;
			if (!t) {
				if (!this.armedZ) return this.arm('armedZ');
				this.armedZ = false;
				return this.calibrateZones();
			}
			t({
				title: i18n.t('plugins.WorkshopPrinting.pid.tune_all_zones_title', { n: this.toolZ }),
				notices: [
					i18n.t('plugins.WorkshopPrinting.pid.all_zones_heat_to_their_target'),
					i18n.t('plugins.WorkshopPrinting.pid.while_it_lasts_no_job_controls'),
					i18n.t('plugins.WorkshopPrinting.pid.the_barrel_and_the_nozzle_get'),
					i18n.t('plugins.WorkshopPrinting.pid.to_stop_the_cancel_button_on')
				],
				understood: i18n.t('plugins.WorkshopPrinting.pid.understood_i_stay_next_to_the'),
				button: i18n.t('plugins.WorkshopPrinting.pid.tune_all')
			}).then(ok => { if (ok) this.calibrateZones(); });
		},
		async calibrateZones() {
			const zonas = this.zonesSel.map(z => ({ h: z.id, t: Math.round(Number(this.objZ[z.id])) }));
			try {
				const r = await this.m9003('start', { tool: Number(this.toolZ), zones: zonas });
				if (!r.startsWith('{')) throw new Error(r);
				this.msgKind = 'info';
				this.msg = i18n.t('plugins.WorkshopPrinting.pid.tuning_of_all_zones_started_you');
			} catch (e) {
				this.fail(e, i18n.t('plugins.WorkshopPrinting.pid.could_not_start', { error: e.message || String(e) }));
			}
			this.readStateZ();
		},
		// Cancelar es seguro (apaga): un toque, siempre disponible mientras corre.
		async cancelZones() {
			this.cancellingZ = true;
			try {
				await this.m9003('cancel');
			} catch (e) {
				this.fail(e, i18n.t('plugins.WorkshopPrinting.pid.could_not_cancel_use', { error: e.message || String(e) }));
			} finally {
				this.cancellingZ = false;
				this.readStateZ();
			}
		},
		touchSaveZones() {
			if (!this.armedZG) return this.arm('armedZG');
			this.armedZG = false;
			this.saveZones();
		},
		// All the M307 lines at once: a single .bak copy and a single write.
		// If a zone has no M307 line, it is added after the last M307.
		async saveZones() {
			if (!this.atLeast(NEED.configure)) return; // writes modefff.g
			this.savingZ = true;
			try {
				const lista = this.linesZ.slice();
				const text = await readText(MODE_FILE);
				const r = replaceM307Lines(text, lista);
				const lineas = r.lines;
				const added = r.added;
				const sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
				await writeText(MODE_FILE + '.bak-' + sello, text);
				await writeText(MODE_FILE, r.text);
				this.textMode = lineas.join('\n');
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.pid.saved_n_lines', { n: lista.length, stamp: sello }) +
					(added.length ? ' ' + i18n.t('plugins.WorkshopPrinting.pid.lines_added', { list: added.map(h => 'H' + h).join(', ') }) : '');
				markStartup('pid_nozzle', true, lista.map(l => l.line).join(' | ')).catch(() => {});
				rememberForNozzle({ pid: lista.reduce((o, l) => { o[l.h] = l.line; return o; }, {}) });
				note(this.sendCode, 'calibration', i18n.t('plugins.WorkshopPrinting.pid.log_all_zones_saved', { lines: lista.map(l => l.line).join(' | ') }));
				await this.readModel();
			} catch (e) {
				this.fail(e, i18n.t('plugins.WorkshopPrinting.common.could_not_save') + (e.message || e));
			} finally {
				this.savingZ = false;
			}
		},
		async save() {
			if (!this.atLeast(NEED.configure)) return; // writes modefff.g
			this.saving = true;
			try {
				const r = await changeLineMode(`M307 H${this.chosen.id} `, this.line);
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.pid.saved_before', { before: r.before.split(';')[0].trim() });
				markStartup('pid_' + this.chosen.paper, true, this.line).catch(() => {});
				if (this.chosen.paper === 'nozzle') rememberForNozzle({ pid: { [this.chosen.id]: this.line } });
				note(this.sendCode, 'calibration', i18n.t('plugins.WorkshopPrinting.pid.log_saved', { name: this.chosen.name, line: this.line }));
				await this.readModel();
			} catch (e) {
				this.fail(e, i18n.t('plugins.WorkshopPrinting.common.could_not_save') + (e.message || e));
			} finally {
				this.saving = false;
			}
		}
	}
};
</script>

<style scoped>
.zone-current {
	background: rgba(198, 40, 40, 0.08);
}
.explica {
	background: rgba(25, 118, 210, 0.08);
	border-radius: 6px;
	padding: 8px 12px;
}
</style>
