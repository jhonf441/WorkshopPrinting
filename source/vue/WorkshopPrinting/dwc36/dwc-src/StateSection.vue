<template>
	<!-- the head of the section carries the one line of state ("Heating: 1 of 4 still to reach its target") and the sentence that says what the page is for -->
	<pc-section icon="mdi-thermometer" :title="$t('plugins.WorkshopPrinting.common.status')" :lead="$t('plugins.WorkshopPrinting.printing.status_lead')">
		<template v-slot:right><span class="wf-state" :class="summary.kind" role="status">{{ summaryText }}</span></template>
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
		<!-- the heaters: ONE line of state (what is still to reach its target), the rows, and the way to turn them all off right under the list -->
		<v-card outlined class="pa-3">
			<div class="pc-actions">
				<h4 class="pc-card-title">{{ $t('plugins.WorkshopPrinting.printing.heaters_title') }}</h4>
			</div>
			<div v-if="!heaters.length" class="text-body-2 grey--text mt-2">
				{{ $t('plugins.WorkshopPrinting.printing.there_are_no_heaters_configured_now') }}
			</div>
			<div v-else class="pc-heaters mt-2">
				<pc-heater-row v-for="h in heaters" :key="h.id" :h="h" :state-text="textState(h)" :kind="kindState(h)" :can-operate="canOperate" @clear-fault="deleteFault" />
			</div>
			<!-- turning every heater off is the first thing to reach for when something goes wrong: right under the list it turns off (safe, level 1: one tap) -->
			<div v-if="isFff" class="pc-actions mt-3">
				<v-btn small outlined class="st-btn" :disabled="!canOperate" @click="cool()">
					<v-icon small left>mdi-snowflake</v-icon>{{ $t('plugins.WorkshopPrinting.printing.turn_off_all_heaters') }}
				</v-btn>
				<pc-result v-if="msgCard === 'heat'" :text="msg || ''" :kind="msgKind" />
			</div>
		</v-card>
		<!-- temperature history (2026-10-11): sampled from the model every 2 s; it starts when this page opens -->
		<v-card v-if="heaters.length" outlined class="pa-3 mt-3">
			<chart-state :series="seriesChart" :samples="samples" />
			<div class="wf-field-msg is-hint mt-1">{{ $t('plugins.WorkshopPrinting.stateChart.starts_on_open') }}</div>
		</v-card>
		<div class="pc-g2 mt-3">
			<v-card v-if="fans.length" outlined class="pa-3">
				<h4 class="pc-card-title mb-2">{{ $t('plugins.WorkshopPrinting.common.fans') }}</h4>
				<dl class="pc-facts">
					<div v-for="f in fans" :key="f.id"><dt>{{ f.name }}</dt><dd>{{ Math.round(f.value * 100) }} %<span v-if="f.thermostatic" class="pc-faint"> {{ $t('plugins.WorkshopPrinting.printing.automatic') }}</span></dd></div>
				</dl>
			</v-card>
			<!-- Cold extrusion (2026-10-11, request: "allow cold extrusions, but
			     make it go through the safety protocol"). Allowing it is level 4
			     (DESIGN.md 5): notice with a checkbox + active risk while it lasts.
			     The state is read from the model: with M302 P1 RRF reports
			     heat.coldExtrudeTemperature = 0 (Heat.cpp). -->
			<v-card v-if="isFff" outlined class="pa-3" :class="{ 'edge-fault': coldAllowed }">
				<div class="pc-actions">
					<h4 class="pc-card-title">{{ $t('plugins.WorkshopPrinting.printing.cold_extrusion') }}</h4>
					<span class="wf-state" :class="coldAllowed ? 'err' : coldAllowed === false ? 'ok' : 'info'">
						{{ coldAllowed ? $t('plugins.WorkshopPrinting.printing.allowed') : coldAllowed === false ? $t('plugins.WorkshopPrinting.printing.locked') : $t('plugins.WorkshopPrinting.printing.no_data') }}
					</span>
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
				<div class="pc-actions mt-3">
					<v-btn v-if="coldAllowed" small color="primary" :loading="coldSending" :disabled="!canOperate" @click="blockCold()">
						<v-icon small left>mdi-lock</v-icon>{{ $t('plugins.WorkshopPrinting.printing.lock_cold_extrusion') }}
					</v-btn>
					<!-- level 4: red; without the workshop's notice it falls back to the double tap -->
					<v-btn v-else small :color="isArmed('cold') ? 'amber darken-3' : 'error'" :outlined="!isArmed('cold')" :disabled="coldAllowed == null || !canAllowCold" :loading="coldSending" @click="touchCold()">
						<v-icon small left>mdi-lock-open-variant</v-icon>{{ isArmed('cold') ? $t('plugins.WorkshopPrinting.printing.tap_again_allow_cold_extrusion') : $t('plugins.WorkshopPrinting.printing.allow_cold_extrusion') }}
					</v-btn>
					<div v-else-if="coldAllowed == null" class="wf-note is-info mb-0 mt-0" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ $t('plugins.WorkshopPrinting.printing.no_data_from_the_board_yet') }}</span></div>
					<pc-result v-if="msgCard === 'cold'" :text="msg || ''" :kind="msgKind" />
				</div>
			</v-card>
		</div>
		<!-- ONE reason for the whole tab (clear fault, turn off, cold extrusion), below the controls -->
		<lock-reason :min="stateNeed" class="mt-3" :subject="$t('plugins.WorkshopPrinting.subjects.printer_state')" />
		<!-- How it is configured (2026-10-11), folded: what the board's model says for each heater; "Read from the board" also asks for the output, the sensor, the model and the cap as RRF answers them -->
		<details v-if="heaters.length" class="pc-step mt-3">
			<summary class="pc-step-sum"><v-icon small class="mr-1" aria-hidden="true">mdi-cog-outline</v-icon><span class="pc-step-title">{{ $t('plugins.WorkshopPrinting.printing.how_it_is_configured') }}</span></summary>
			<div class="pc-step-body">
				<div class="d-flex align-center flex-wrap mb-2" style="gap:16px">
					<span class="text-body-2">{{ $t('plugins.WorkshopPrinting.printing.heated_bed_line', { state: bedText }) }}</span>
					<span class="text-body-2">{{ $t('plugins.WorkshopPrinting.printing.heated_chamber_line', { state: chamberText }) }}</span>
				</div>
				<div v-if="!chamberIds.length" class="text-caption grey--text mb-3">{{ $t('plugins.WorkshopPrinting.printing.heated_chamber_none_help') }}</div>
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
								<!-- it only asks (level 0-1): one tap -->
								<v-btn x-small outlined :loading="readings[c.id] && readings[c.id].loading" @click="readConfig(c)">
									<v-icon x-small left>mdi-download</v-icon>{{ $t('plugins.WorkshopPrinting.printing.read_from_the_board') }}
								</v-btn>
							</div>
							<pre v-if="readings[c.id] && readings[c.id].text" class="response-board mt-2">{{ readings[c.id].text }}</pre>
						</v-expansion-panel-content>
					</v-expansion-panel>
				</v-expansion-panels>
				<div v-if="isFff && extruder" class="text-caption grey--text mt-3">
					{{ $t('plugins.WorkshopPrinting.printing.extruder_steps', { n: extruder.stepsPerMm }) }}
				</div>
			</div>
		</details>
	</pc-section>
</template>

<script>
import i18n from '../../i18n'

'use strict'

// The State section of the 3D printing page: the heaters as compact rows under ONE line of state (current, target, cap, state, fault with what the sensor says), the temperature chart,
// the fans, how each heater is configured (read from the board) and the cold extrusion (allowing it is level 4, DESIGN.md 5). Print.vue (the shell) gives
// what it already reads from the model for every section (heaters, tools, fans, the samples of the chart, the real state of M302) and keeps the active
// risk in step with the board; this section draws and sends its own codes.
import { mapActions } from 'vuex'
import ChartState from './ChartState.vue'
import LockReason from './LockReason.vue' // vue/_shared36
import PcHeaterRow from './PcHeaterRow.vue' // one heater as a compact row
import PcResult from './PcResult.vue' // the result next to the action
import PcSection from './PcSection.vue' // the head of the section (icon, title, lead, state at the right)
import { tapArmMixin } from './tap-arm-mixin.js' // the double tap of the page (4 s)
import { heaterSummary } from './heater-summary.js' // the one line of state of the heaters
import { tzFffTempClass } from './fff-temps.js' // ok / heating / cooling / off / fault
import { roleMixin } from './role-mixin.js' // vue/_shared36
import { NEED } from './print-sections.js'
import { heaterConfigRows } from './heater-config.js' // the rows of "How it is configured"
import { isError, readText, MODE_FILE } from './util.js'
import { coolCode } from './tool-codes.js' // heat, cool and extrusion codes: one module for every page
import { pluginActive } from './workshop-ids.js'
import { startColdRisk, endColdRisk } from './cold-risk.js'

export default {
	mixins: [roleMixin, tapArmMixin],
	// what the person who left had read or done stays nowhere: the messages and the armed tap go, the mode file is read again (onSessionChange)
	sessionData: ['armed', 'msg', 'msgKind', 'modeHasM302'],
	sessionErrors: ['msg', 'msgKind'], // what a refusal or a failure said: cleared when the person signs in, out or changes role (role-mixin.js)
	components: { ChartState, LockReason, PcHeaterRow, PcResult, PcSection },
	props: {
		isFff: { type: Boolean, default: false },
		heaters: { type: Array, default: () => [] },
		tools: { type: Array, default: () => [] },
		tool: { type: Object, default: null }, // the tool the page works on
		fans: { type: Array, default: () => [] },
		extruder: { type: Object, default: null },
		samples: { type: Array, default: () => [] }, // the history of the chart (the shell samples the model)
		seriesChart: { type: Array, default: () => [] },
		coldAllowed: { type: Boolean, default: null }, // REAL state of M302 (null: model not loaded)
		minExtCold: { type: Number, default: null },
		minRetCold: { type: Number, default: null }
	},
	data() {
		return { msg: null, msgKind: 'info', msgCard: '', readings: {}, coldSending: false, modeHasM302: null };
	},
	computed: {
		model() {
			return this.$store.state.machine.model;
		},
		// what the machine declares: heaters of the bed (M140) and of the chamber (M141)
		bedIds() {
			return ((this.model.heat && this.model.heat.bedHeaters) || []).filter(n => n >= 0);
		},
		chamberIds() {
			return ((this.model.heat && this.model.heat.chamberHeaters) || []).filter(n => n >= 0);
		},
		bedText() {
			return this.bedIds.length ? i18n.t('plugins.WorkshopPrinting.printing.yes_heaters', { list: this.bedIds.map(n => 'H' + n).join(', ') }) : i18n.t('plugins.WorkshopPrinting.printing.no');
		},
		chamberText() {
			return this.chamberIds.length ? i18n.t('plugins.WorkshopPrinting.printing.yes_heaters', { list: this.chamberIds.map(n => 'H' + n).join(', ') }) : i18n.t('plugins.WorkshopPrinting.printing.no');
		},
		// operator: clear a fault, turn the heaters off, lock cold extrusion; technician: allow cold extrusion (NEED, print-sections.js)
		canOperate() {
			return this.atLeast(NEED.operate);
		},
		canAllowCold() {
			return this.atLeast(NEED.cold);
		},
		// the role the controls of the state tab need, for its one reason: operate; with cold extrusion on the page (FFF) the higher one once operate is met
		stateNeed() {
			if (!this.canOperate) return NEED.operate;
			return this.isFff && !this.canAllowCold ? NEED.cold : '';
		},
		// the line of state of the heaters: what is still to reach its target (heater-summary.js, over the classification of fff-temps.js)
		summary() {
			return heaterSummary(this.heaters);
		},
		summaryText() {
			// one still to reach its target is "falta 1", more are "faltan 2"
			const key = this.summary.key === 'heating' && this.summary.n !== 1 ? 'heating_many' : this.summary.key;
			return i18n.t('plugins.WorkshopPrinting.printing.heat_sum_' + key, { n: this.summary.n, m: this.summary.m });
		},
		// the rows of "How it is configured" (heater-config.js)
		config() {
			return heaterConfigRows({ heaters: this.heaters, model: this.model, tools: this.tools, readings: this.readings, fmt: this.fmt, t: (k, p) => i18n.t('plugins.WorkshopPrinting.' + k, p) });
		},
		textModeCold() {
			if (this.modeHasM302 === true) return i18n.t('plugins.WorkshopPrinting.printing.reloading_fff_mode_also_locks_it');
			if (this.modeHasM302 === false) return i18n.t('plugins.WorkshopPrinting.printing.changing_or_reloading_fff_mode_does');
			return '';
		}
	},
	mounted() {
		// if modefff.g sets M302 (without P1), reloading the mode blocks it again
		this.readModeFile();
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		// the person signed in / out or the role changed: what was read with the old session is read again
		onSessionChange() {
			this.readModeFile();
		},
		readModeFile() {
			readText(MODE_FILE).then(t => {
				this.modeHasM302 = t.split(/\r?\n/).some(l => {
					const c = l.split(';')[0];
					return /^\s*M302\b/i.test(c) && !/P1/i.test(c);
				});
			}).catch(() => {});
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
				this.$emit('risk-touched'); // the shell waits a minute before it syncs the risk with the board again
				await startColdRisk().catch(() => {});
				this.msgCard = 'cold';
				this.msgKind = 'warning';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.cold_extrusion_allowed_lock_it_again');
			} catch (e) {
				this.msgCard = 'cold';
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.could_not_allow', { error: e.message || String(e) });
			} finally {
				this.coldSending = false;
			}
		},
		// Locking it again gives the protection back (level 1): one tap.
		async blockCold() {
			this.coldSending = true;
			try {
				const r = await this.sendCode({ code: 'M302 P0', log: true });
				if (isError(r)) throw new Error(r);
				this.$emit('risk-touched');
				await endColdRisk().catch(() => {});
				this.msgCard = 'cold';
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.cold_extrusion_locked_again');
			} catch (e) {
				this.msgCard = 'cold';
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.could_not_lock', { error: e.message || String(e) });
			} finally {
				this.coldSending = false;
			}
		},
		fmt(v) {
			return v == null || isNaN(v) ? '--' : Number(v).toFixed(0);
		},
		textState(h) {
			if (h.sensorBad) return i18n.t('plugins.WorkshopPrinting.common.no_sensor');
			return { off: i18n.t('plugins.WorkshopPrinting.printing.st_off'), active: i18n.t('plugins.WorkshopPrinting.printing.st_heating'), standby: i18n.t('plugins.WorkshopPrinting.common.standby'), fault: i18n.t('plugins.WorkshopPrinting.printing.st_fault'), tuning: i18n.t('plugins.WorkshopPrinting.printing.st_tuning') }[h.state] || h.state;
		},
		// the dot of the row: fault red, tuning amber, a heater with a target that is still heating amber, at its target green, the rest neutral
		kindState(h) {
			if (h.state === 'fault' || h.sensorBad) return 'err';
			if (h.state === 'tuning') return 'warn';
			if (h.state !== 'active') return 'info';
			const c = tzFffTempClass(h.current, h.target, h.state);
			return c === 'ok' ? 'ok' : c === 'heating' ? 'warn' : 'info';
		},
		colorState(h) {
			// DESIGN.md 2: fault = error, tuning = warning, heating = amber (it heats), the rest gray
			return h.state === 'fault' || h.sensorBad ? 'error' : h.state === 'tuning' ? 'warning' : h.state === 'active' ? 'amber darken-3' : h.state === 'standby' ? 'amber darken-1' : 'grey darken-1';
		},
		async deleteFault(h) {
			try {
				await this.sendCode({ code: `M562 P${h.id}`, log: true });
				this.msgCard = 'heat';
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.fault_cleared', { name: h.name });
			} catch (e) {
				this.msgCard = 'heat';
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.common.couldn_t') + (e.message || e);
			}
		},
		async cool() {
			const codes = this.tools.map(t => coolCode(t.number));
			if (this.heaters.some(h => h.paper === 'bed')) codes.push('M140 S0');
			if (this.heaters.some(h => h.paper === 'camera')) codes.push('M141 S0');
			try {
				for (const c of codes) await this.sendCode({ code: c, log: true });
				this.msgCard = 'heat';
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.heaters_off_the_automatic_fans_keep');
			} catch (e) {
				this.msgCard = 'heat';
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.printing.could_not_turn_off', { error: e.message || String(e) });
			}
		}
	}
};
</script>

<style scoped>
.st-btn.v-btn {
	height: 44px;
	min-height: 44px;
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
