<template>
	<pc-section icon="mdi-grain" :title="$t('plugins.WorkshopPrinting.printing.pellet_panel')">
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>
			{{ $t('plugins.WorkshopPrinting.pellet.intro_1') }} <b>{{ $t('plugins.WorkshopPrinting.pellet.intro_pellet_extruder') }}</b>{{ $t('plugins.WorkshopPrinting.pellet.intro_2') }} <b>{{ $t('plugins.WorkshopPrinting.pellet.intro_several_zones') }}</b> {{ $t('plugins.WorkshopPrinting.pellet.intro_3') }} <b>{{ $t('plugins.WorkshopPrinting.pellet.intro_steps') }}</b>{{ $t('plugins.WorkshopPrinting.pellet.intro_4') }}
			</p>
		</details>
		<v-alert v-if="!isFff" dense text type="info" class="mt-3 mb-0">{{ $t('plugins.WorkshopPrinting.common.the_extruder_only_exists_in_fff') }}</v-alert>
		<template v-else>
			<div v-if="!currentTool" class="text-body-2 grey--text mt-3">{{ $t('plugins.WorkshopPrinting.pellet.no_tool_defined') }}</div>
			<template v-else>
				<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopPrinting.pellet.extruder_tap_a_zone', { name: currentTool.name || ('T' + currentTool.number) }) }}</div>
				<v-row dense>
					<v-col cols="12" lg="7">
						<pellet-hmi :zones="zones" :fans-throat="fansThroat" :fans-tool="fansTool" :motor="motorHmi" :selected="pick" :orientation="layout.value" :feed="feedHmi" @select="select" />
					</v-col>
					<v-col cols="12" lg="5">
						<v-card v-if="pick.type === 'zone' && zoneSel" outlined class="pa-3">
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								<span class="text-subtitle-1">{{ sel === 0 ? $t('plugins.WorkshopPrinting.common.zone_1_nozzle') : $t('plugins.WorkshopPrinting.pellet.zone_n', { n: sel + 1 }) }}</span>
								<v-chip x-small outlined :color="colorZone(zoneSel)">{{ stateZone(zoneSel) }}</v-chip>
								<v-spacer />
								<span class="grey--text text-caption">{{ $t('plugins.WorkshopPrinting.pellet.heater_h_sensor', { h: zoneSel.id, sensor: zoneSel.sensorName || ('S' + zoneSel.sensor) }) }}</span>
							</div>
							<div class="text-h4 my-1">{{ zoneSel.sensorBad ? '--' : Math.round(zoneSel.current) }} °C</div>
							<div class="text-body-2">
								{{ $t('plugins.WorkshopPrinting.common.target') }} <b>{{ zoneSel.target > 0 ? Math.round(zoneSel.target) + ' °C' : $t('plugins.WorkshopPrinting.pellet.off') }}</b>
								<span class="grey--text ml-2">{{ $t('plugins.WorkshopPrinting.pellet.limit_c', { max: zoneSel.max }) }}</span>
							</div>
							<div v-if="zoneSel.sensorBad || zoneSel.state === 'fault'" class="text-caption error--text mt-1">
								{{ zoneSel.explanation || $t('plugins.WorkshopPrinting.pellet.the_zone_is_in_fault_check') }}
							</div>
							<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
								<input v-model.number="tempNew" type="number" step="5" min="0" :max="zoneSel.max" class="field" /> °C
								<!-- calentar = nivel 2 (DESIGN.md 5): doble toque ambar -->
								<v-btn small :color="armed === 'heat' ? 'amber darken-3' : 'primary'" :disabled="!canHeat || !canOperate" @click="arm('heat', heatZone)">
									<v-icon small left>mdi-fire</v-icon>{{ armed === 'heat' ? $t('plugins.WorkshopPrinting.pellet.tap_again_heats_to', { c: tempNew }) : $t('plugins.WorkshopPrinting.pellet.heat_this_zone') }}
								</v-btn>
								<v-btn small outlined :disabled="!(zoneSel.target > 0) || !canOperate" @click="powerOffZone()"><v-icon small left>mdi-snowflake</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.turn_zone_off') }}</v-btn>
							</div>
							<div v-if="reasonNo" class="text-caption grey--text mt-1">{{ reasonNo }}</div>
							<v-divider class="my-3" />
							<div class="text-body-2">
								<template v-if="sel === 0">
									{{ $t('plugins.WorkshopPrinting.pellet.the_nozzle_goes_to_the_material') }}
								</template>
								<template v-else>
									{{ $t('plugins.WorkshopPrinting.pellet.step_readonly', { c: step[zoneSel.id] || 0 }) }}
								</template>
							</div>
							<div v-if="canConfig" class="d-flex flex-wrap mt-3" style="gap:8px">
								<v-btn x-small outlined :title="$t('plugins.WorkshopPrinting.pellet.tune_pid_tip')" @click="$emit('goto', { section: 'pid', heater: zoneSel.id })"><v-icon x-small left>mdi-tune</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.tune_pid') }}</v-btn>
							</div>
						</v-card>
						<!-- fan: speed (set by hand) or trigger temperatures (thermostatic) -->
						<v-card v-else-if="pick.type === 'fan' && fanSel" outlined class="pa-3">
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								<v-icon small>mdi-fan</v-icon>
								<span class="text-subtitle-1">{{ fanSel.name }}</span>
								<v-chip x-small outlined>{{ fanSel.thermostatic ? $t('plugins.WorkshopPrinting.pellet.fan_auto') : $t('plugins.WorkshopPrinting.pellet.fan_manual') }}</v-chip>
								<v-spacer />
								<span class="grey--text text-caption">M106 P{{ fanSel.id }}<template v-if="fanSel.rpm > 0"> · {{ fanSel.rpm }} rpm</template></span>
							</div>
							<div class="text-h4 my-1">{{ Math.round(fanSel.value * 100) }} %</div>
							<div v-if="fanSel.state === 'ordered'" class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pellet.fan_no_tach_note') }}</div>
							<div v-else-if="fanSel.state === 'stalled'" class="text-caption error--text">{{ $t('plugins.WorkshopPrinting.pellet.fan_stalled_note') }}</div>
							<template v-if="!fanSel.thermostatic">
								<v-slider v-model="fanNew" :min="0" :max="100" step="5" dense hide-details thumb-label :disabled="!canOperate" @end="setFan()" />
								<div class="d-flex flex-wrap mt-2" style="gap:6px">
									<v-btn x-small outlined :disabled="!canOperate" @click="fanNew = 0; setFan()">{{ $t('plugins.WorkshopPrinting.pellet.fan_off') }}</v-btn>
									<v-btn x-small outlined :disabled="!canOperate" @click="fanNew = 50; setFan()">50 %</v-btn>
									<v-btn x-small outlined :disabled="!canOperate" @click="fanNew = 100; setFan()">100 %</v-btn>
								</div>
								<div class="text-caption grey--text mt-2">{{ $t('plugins.WorkshopPrinting.pellet.fan_runtime_note') }}</div>
							</template>
							<template v-else>
								<div class="text-body-2">{{ $t('plugins.WorkshopPrinting.pellet.fan_thermo_what', { zones: fanSel.zonesText }) }}</div>
								<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
									{{ $t('plugins.WorkshopPrinting.pellet.fan_on_from') }} <input v-model.number="trigLow" type="number" step="1" min="0" max="300" class="field" /> °C
									{{ $t('plugins.WorkshopPrinting.pellet.fan_full_from') }} <input v-model.number="trigHigh" type="number" step="1" min="0" max="300" class="field" /> °C
									<v-btn small :color="armed === 'trig' ? 'amber darken-3' : 'primary'" :disabled="!trigOk || !canOperate" @click="arm('trig', setTrigger)">
										{{ armed === 'trig' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.fan_apply') }}
									</v-btn>
								</div>
								<div class="text-caption warning--text mt-2">{{ $t('plugins.WorkshopPrinting.pellet.fan_thermo_warn') }}</div>
							</template>
						</v-card>
						<!-- motor: live state, flow and pressure advance, and a short extrusion test -->
						<v-card v-else-if="pick.type === 'motor'" outlined class="pa-3">
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								<v-icon small>mdi-engine</v-icon>
								<span class="text-subtitle-1">{{ motorHmi.title }}</span>
								<v-chip x-small outlined :color="motorHmi.running ? '#2e7d32' : '#616161'">{{ motorHmi.stateText }}</v-chip>
								<v-spacer />
								<span class="grey--text text-caption">{{ motorHmi.driveText }}</span>
							</div>
							<div class="text-h4 my-1">{{ motorHmi.rateText }}</div>
							<div v-if="ext" class="text-caption grey--text">
								{{ $t('plugins.WorkshopPrinting.pellet.motor_specs', { steps: ext.stepsPerMm, micro: ext.microstepping ? ext.microstepping.value : '?', vmax: Math.round(ext.speed / 60), acc: ext.acceleration, jerk: ext.jerk }) }}
							</div>
							<v-divider class="my-3" />
							<div class="text-subtitle-2">{{ $t('plugins.WorkshopPrinting.pellet.motor_test') }}</div>
							<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
								<input v-model.number="testMm" type="number" step="1" min="1" max="100" class="field" /> mm
								<input v-model.number="testSpeed" type="number" step="0.5" min="0.5" max="60" class="field" /> mm/s
								<v-btn small :color="armed === 'ext' ? 'amber darken-3' : 'primary'" :disabled="!!motorReason || !canOperate" @click="arm('ext', () => runTest(false))">
									<v-icon small left>mdi-arrow-down-bold</v-icon>{{ armed === 'ext' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.extrude') }}
								</v-btn>
								<v-btn small outlined :color="armed === 'ret' ? 'amber darken-3' : undefined" :disabled="!!motorReason || !canOperate" @click="arm('ret', () => runTest(true))">
									<v-icon small left>mdi-arrow-up-bold</v-icon>{{ armed === 'ret' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.retract') }}
								</v-btn>
							</div>
							<div v-if="motorReason" class="text-caption grey--text mt-1">{{ motorReason }}</div>
							<v-divider class="my-3" />
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								{{ $t('plugins.WorkshopPrinting.pellet.flow') }} <input v-model.number="flowNew" type="number" step="1" min="10" max="300" class="field" /> %
								<v-btn x-small outlined :disabled="!flowCodeOk || !canOperate" @click="applyFlow()">{{ $t('plugins.WorkshopPrinting.pellet.fan_apply') }}</v-btn>
								<span class="ml-3">{{ $t('plugins.WorkshopPrinting.pellet.advance') }}</span> <input v-model.number="paNew" type="number" step="0.01" min="0" max="2" class="field" /> s
								<v-btn x-small outlined :disabled="!paCodeOk || !canOperate" @click="applyAdvance()">{{ $t('plugins.WorkshopPrinting.pellet.fan_apply') }}</v-btn>
							</div>
							<div class="text-caption grey--text mt-2">{{ $t('plugins.WorkshopPrinting.pellet.motor_runtime_note') }}</div>
							<v-btn v-if="canConfig" x-small outlined class="mt-2" :title="$t('plugins.WorkshopPrinting.pellet.tune_flow_tip')" @click="$emit('goto', { section: 'extruder' })"><v-icon x-small left>mdi-scale-balance</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.tune_flow') }}</v-btn>
						</v-card>
						<pellet-feed v-else-if="pick.type === 'feed'" :config="feedRaw" :tool="currentTool" :busy="busy" :gp-in="gpIn" :gp-out="gpOut" :configure="false" :can-operate="canOperate" @msg="feedMsg" @error="e => { failure = e; }" />
						<div v-else class="text-body-2 grey--text">{{ $t('plugins.WorkshopPrinting.pellet.hmi_tap_a_part') }}</div>
						<div v-if="zones.some(z => z.sensorBad)" class="text-caption error--text mt-2">
							{{ $t('plugins.WorkshopPrinting.pellet.a_zone_reads_no_temperature_check') }}
						</div>
						<div v-if="fansOthers.length" class="text-caption grey--text mt-2">
							{{ $t('plugins.WorkshopPrinting.pellet.other_fans', { list: fansOthers.map(f => f.name + ' ' + Math.round(f.value * 100) + ' %').join(', ') }) }}
						</div>
					</v-col>
				</v-row>

				<error-notice v-if="failure" :error="failure" class="mt-3" />
				<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
				<div v-if="canConfig" class="mt-4">
					<v-btn x-small outlined @click="$emit('goto', { section: 'zones' })"><v-icon x-small left>mdi-cog-outline</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.open_setup') }}</v-btn>
				</div>
			</template>
		</template>
	</pc-section>
</template>

<script>
import i18n from '../../i18n'
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)

'use strict'

import { mapActions } from 'vuex'
import { CFG_FILE, readJson, isError } from './util.js'
import { rememberForNozzle, persistAdvance } from './nozzle-store.js'
import PelletHmi from './PelletHmi.vue'
import PelletFeed from './PelletFeed.vue'
import { normalize as normFeed, hopperState } from './pellet-feed.js'
import { machineFree } from './machine-free.js' // job (file, paused or live) and machine state (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { roleMixin } from './role-mixin.js' // what the role sees and may do (vue/_shared)
import { NEED } from './print-sections.js'
import { layout, loadLayout } from './pellet-orientation.js'
import { spinSeconds, fanState, fanCode, fanTriggerCode, extrudeCode, flowCode, advanceCode, motorBlock } from './pellet-hmi.js'

export default {
	mixins: [roleMixin],
	components: { PelletHmi, PelletFeed, ErrorNotice, PcSection },
	props: {
		isFff: { type: Boolean, default: false },
		currentTool: { type: Object, default: null },
		heaters: { type: Array, default: () => [] },
		tools: { type: Array, default: () => [] },
		fans: { type: Array, default: () => [] }
	},
	data() {
		return {
			step: {},
			msg: null, msgKind: 'info', failure: null,
			sel: 0, tempNew: null, armed: null, armedTimer: null, testing: false,
			feedRaw: null,
			pick: { type: 'zone', id: 0 }, fanNew: 0, trigLow: 45, trigHigh: 50, testMm: 5, testSpeed: 2, flowNew: 100, paNew: 0
		};
	},
	computed: {
		layout() {
			return layout;
		},
		// operator: the actions that only move heat / air / the motor (NEED, print-sections.js); this panel writes no configuration
		canOperate() {
			return this.atLeast(NEED.operate);
		},
		canConfig() {
			return this.atLeast(NEED.configure);
		},
		model() {
			return this.$store.state.machine.model;
		},
		zones() {
			const t = this.currentTool;
			return t ? this.heaters.filter(h => h.tool === t.number).sort((a, b) => a.zone - b.zone) : [];
		},
		zoneSel() {
			return this.zones[this.sel] || null;
		},
		busy() {
			const st = this.model.state && this.model.state.status;
			return ['processing', 'paused', 'pausing', 'resuming', 'simulating'].includes(st);
		},
		reasonNo() {
			const z = this.zoneSel;
			if (!z) return '';
			if (z.sensorBad) return i18n.t('plugins.WorkshopPrinting.pellet.can_t_heat_the_zone_doesn');
			if (z.state === 'fault') return i18n.t('plugins.WorkshopPrinting.pellet.can_t_heat_the_zone_is');
			if (this.busy) return i18n.t('plugins.WorkshopPrinting.pellet.a_job_is_running_the_job');
			if (!(this.tempNew > 0 && this.tempNew <= z.max)) return i18n.t('plugins.WorkshopPrinting.pellet.temp_range', { max: z.max });
			return '';
		},
		canHeat() {
			return !!this.zoneSel && !this.reasonNo;
		},
		// fans: the tool's blow on the part (next to the nozzle);
		// the automatic (thermostatic) ones cool the throat
		fansTool() {
			const ids = (this.currentTool && this.currentTool.fans) || [];
			return this.fans.filter(f => ids.includes(f.id));
		},
		fansThroat() {
			return this.fans.filter(f => f.thermostatic && !this.fansTool.includes(f));
		},
		fansOthers() {
			return this.fans.filter(f => !this.fansTool.includes(f) && !this.fansThroat.includes(f));
		},
		// ---- panel (PelletHmi): the motor / extruder of the tool and the part the person picked ----
		ext() {
			const ex = (this.model.move && this.model.move.extruders) || [];
			return ex[this.extruderNumber] || null;
		},
		extruderNumber() {
			const t = this.currentTool;
			return t && t.extruders && t.extruders.length ? t.extruders[0] : 0;
		},
		rate() {
			const cm = this.model.move && this.model.move.currentMove;
			return cm && cm.extrusionRate > 0 ? cm.extrusionRate : 0;
		},
		motorHmi() {
			const running = this.rate > 0 || this.testing;
			const rate = this.testing ? Number(this.testSpeed) || 0 : this.rate;
			return {
				label: 'M' + this.extruderNumber,
				title: i18n.t('plugins.WorkshopPrinting.pellet.motor_title', { n: this.extruderNumber }),
				running,
				rateText: (running ? rate.toFixed(1) : '0.0') + ' mm/s',
				driveText: this.ext && this.ext.drives && this.ext.drives.length ? 'E' + this.extruderNumber + ' > ' + i18n.t('plugins.WorkshopPrinting.pellet.drive_n', { n: this.ext.drives[0] }) : 'E' + this.extruderNumber,
				stateText: running ? i18n.t('plugins.WorkshopPrinting.pellet.motor_running') : i18n.t('plugins.WorkshopPrinting.pellet.motor_stopped'),
				speedTurn: running ? spinSeconds(Math.min(1, rate / 10), 2.4, 0.5) : 0
			};
		},
		// ---- feeding of the hopper (pellet-feed.js) ----
		gpIn() {
			return (this.model.sensors && this.model.sensors.gpIn) || [];
		},
		gpOut() {
			return (this.model.state && this.model.state.gpOut) || [];
		},
		feedCfg() {
			return normFeed(this.feedRaw);
		},
		feedHmi() {
			const c = this.feedCfg;
			const st = hopperState(c, this.gpIn);
			const color = { full: '#2e7d32', empty: '#c62828', unknown: '#9e9e9e' }[st];
			return {
				title: i18n.t('plugins.WorkshopPrinting.pellet.hmi_feed_title'),
				modeText: c.mode === 'auto' ? i18n.t('plugins.WorkshopPrinting.pellet.hmi_feed_auto') : i18n.t('plugins.WorkshopPrinting.pellet.hmi_feed_manual'),
				levelText: i18n.t('plugins.WorkshopPrinting.pellet.feed_level_' + st), color
			};
		},
		fanSel() {
			if (this.pick.type !== 'fan') return null;
			const f = this.fans.find(x => x.id === this.pick.id);
			if (!f) return null;
			const mf = (this.model.fans || [])[f.id] || {};
			const th = mf.thermostatic || {};
			const hs = th.heaters || [];
			return Object.assign({}, f, {
				rpm: mf.rpm != null ? mf.rpm : -1,
				state: fanState({ value: f.value, rpm: mf.rpm != null ? mf.rpm : -1 }),
				heaters: hs,
				zonesText: hs.map(h => 'H' + h).join(', '),
				low: th.lowTemperature,
				high: th.highTemperature
			});
		},
		trigOk() {
			const f = this.fanSel;
			return !!f && !!fanTriggerCode(f.id, f.heaters, this.trigLow, this.trigHigh);
		},
		freeMove() {
			return machineFree(this.model, { t: ts, serviceText, serviceDefaultKey, purpose: 'move' });
		},
		motorReason() {
			const min = this.model.heat && this.model.heat.coldExtrudeTemperature != null ? this.model.heat.coldExtrudeTemperature : 160;
			const why = motorBlock({ busyJob: this.busy, notFree: !this.freeMove.free, zones: this.zones, minTemp: min });
			if (!why) return '';
			if (why === 'machine') return this.freeMove.reason;
			return i18n.t('plugins.WorkshopPrinting.pellet.motor_block_' + why, { min });
		},
		flowCodeOk() {
			return !!flowCode(this.flowNew);
		},
		paCodeOk() {
			return !!advanceCode(this.extruderNumber, this.paNew);
		},
	},
	watch: {
		sel() { this.putTempNew(); },
		pick() { this.seedEditors(); },
		ext() { if (this.pick.type === 'motor') this.seedEditors(); },
		zones() { if (this.tempNew == null) this.putTempNew(); }
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	async mounted() {
		this.putTempNew();
		const cfg = (await readJson(CFG_FILE, {})) || {};
		this.step = Object.assign({}, cfg.step || {});
		this.feedRaw = cfg.feed || null;
		loadLayout();
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		// color segun el estado (DESIGN.md 2): verde en temperatura, ambar calentando,
		// naranja pasada, rojo falla, gris apagada
		colorZone(z) {
			if (z.sensorBad || z.state === 'fault') return '#c62828';
			if (z.state === 'tuning') return '#e65100';
			if (!(z.target > 0) || z.state === 'off') return '#616161';
			if (z.current > z.target + 10) return '#e65100';
			if (Math.abs(z.current - z.target) <= 3) return '#2e7d32';
			return '#ff8f00';
		},
		stateZone(z) {
			if (z.sensorBad) return i18n.t('plugins.WorkshopPrinting.common.no_sensor');
			if (z.state === 'fault') return i18n.t('plugins.WorkshopPrinting.pellet.st_fault');
			if (z.state === 'tuning') return i18n.t('plugins.WorkshopPrinting.pellet.st_tuning');
			if (!(z.target > 0) || z.state === 'off') return z.current > 50 ? i18n.t('plugins.WorkshopPrinting.pellet.off_still_hot') : i18n.t('plugins.WorkshopPrinting.pellet.st_off');
			if (z.current > z.target + 10) return i18n.t('plugins.WorkshopPrinting.pellet.hotter_than_the_target');
			if (Math.abs(z.current - z.target) <= 3) return i18n.t('plugins.WorkshopPrinting.pellet.at_temperature');
			return i18n.t('plugins.WorkshopPrinting.pellet.st_heating');
		},
		choose(k) {
			this.sel = k;
			this.armed = null;
		},
		feedMsg(m) {
			this.failure = null;
			this.msgKind = m.kind;
			this.msg = m.text;
		},
		// a part of the panel was tapped: zone (heater), fan or motor
		select(p) {
			this.armed = null;
			this.pick = p;
			if (p.type === 'zone') this.sel = p.id;
		},
		seedEditors() {
			if (this.pick.type === 'fan' && this.fanSel) {
				this.fanNew = Math.round(this.fanSel.value * 100);
				this.trigLow = this.fanSel.low != null ? this.fanSel.low : 45;
				this.trigHigh = this.fanSel.high != null ? this.fanSel.high : this.trigLow;
			}
			if (this.pick.type === 'motor') {
				this.flowNew = Math.round(((this.ext && this.ext.factor) || 1) * 100);
				this.paNew = (this.ext && this.ext.pressureAdvance) || 0;
			}
		},
		async run(codes, okText, errKey) {
			try {
				for (const c of codes) {
					const r = await this.sendCode({ code: c, log: true });
					if (isError(r)) throw new Error(r);
				}
				this.msgKind = 'success';
				this.msg = okText;
				return true;
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t(errKey, { error: e.message || String(e) });
				return false;
			}
		},
		// part fan: safe (level 1), one action; a run-time value (config.g / the mode file keep the saved ones)
		async setFan() {
			const f = this.fanSel;
			if (!f || f.thermostatic) return;
			await this.run([fanCode(f.id, this.fanNew)], i18n.t('plugins.WorkshopPrinting.pellet.fan_set', { name: f.name, n: this.fanNew }), 'plugins.WorkshopPrinting.pellet.fan_error');
		},
		// trigger temperatures of a thermostatic fan (throat cooling): double tap, a wrong value can melt the pellet in the throat
		async setTrigger() {
			const f = this.fanSel;
			const code = f && fanTriggerCode(f.id, f.heaters, this.trigLow, this.trigHigh);
			if (!code) return;
			await this.run([code], i18n.t('plugins.WorkshopPrinting.pellet.fan_trigger_set', { name: f.name, low: this.trigLow, high: this.trigHigh }), 'plugins.WorkshopPrinting.pellet.fan_error');
		},
		// short extrusion / retraction test (the board refuses it cold anyway): double tap, never with a job
		async runTest(retract) {
			const code = extrudeCode(this.testMm, this.testSpeed, retract);
			if (!code || this.motorReason) return;
			this.testing = true;
			try {
				await this.run([`T${this.currentTool.number}`].concat(code.split('\n'), ['M400']), i18n.t(retract ? 'plugins.WorkshopPrinting.pellet.test_retracted' : 'plugins.WorkshopPrinting.pellet.test_extruded', { mm: this.testMm }), 'plugins.WorkshopPrinting.pellet.test_error');
			} finally {
				this.testing = false;
			}
		},
		async applyFlow() {
			const code = flowCode(this.flowNew);
			if (code) await this.run([code], i18n.t('plugins.WorkshopPrinting.pellet.flow_set', { n: this.flowNew }), 'plugins.WorkshopPrinting.pellet.fan_error');
		},
		async applyAdvance() {
			const code = advanceCode(this.extruderNumber, this.paNew);
			if (!code) return;
			const ok = await this.run([code], i18n.t('plugins.WorkshopPrinting.pellet.advance_set', { n: this.paNew }), 'plugins.WorkshopPrinting.pellet.fan_error');
			// the technician's setting is kept: in modefff.g (it comes back at start) and in the profile of the nozzle registered now;
			// an operator's try only changes the machine until it restarts
			if (ok && this.canConfig) {
				try {
					await persistAdvance(this.extruderNumber, this.paNew);
					rememberForNozzle({ advance: this.paNew });
					this.msg += ' ' + i18n.t('plugins.WorkshopPrinting.pellet.advance_saved');
				} catch (e) {
					this.msgKind = 'error';
					this.msg = i18n.t('plugins.WorkshopPrinting.pellet.advance_not_saved', { error: e.message || String(e) });
				}
			}
		},
		putTempNew() {
			const z = this.zoneSel;
			if (!z) return;
			const boq = this.zones[0];
			const base = boq && boq.target > 0 ? boq.target : 200;
			this.tempNew = z.target > 0 ? Math.round(z.target) : Math.round(this.sel === 0 ? base : base + (Number(this.step[z.id]) || 0));
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
		// temperatures of all the tool's zones, changing only one
		tempsWith(k, t) {
			const act = (this.currentTool && this.currentTool.active) || [];
			return this.zones.map((z, i) => (i === k ? t : Math.round(act[i] || 0))).join(':');
		},
		async heatZone() {
			const z = this.zoneSel;
			if (!z || !this.canHeat) return;
			const t = Math.round(this.tempNew);
			try {
				const r = await this.sendCode({ code: `M568 P${this.currentTool.number} S${this.tempsWith(this.sel, t)} A2`, log: true });
				if (isError(r)) throw new Error(r);
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.pellet.zone_heating_to', { n: this.sel + 1, c: t });
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.pellet.could_not_heat', { error: e.message || String(e) });
			}
		},
		// apagar es seguro (nivel 1): un toque
		async powerOffZone() {
			const z = this.zoneSel;
			if (!z) return;
			try {
				const temps = this.tempsWith(this.sel, 0);
				const all = temps.split(':').every(v => Number(v) === 0);
				const r = await this.sendCode({ code: all ? `M568 P${this.currentTool.number} A0` : `M568 P${this.currentTool.number} S${temps}`, log: true });
				if (isError(r)) throw new Error(r);
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.pellet.zone_off', { n: this.sel + 1 });
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.pellet.could_not_turn_off', { error: e.message || String(e) });
			}
		}
	}
};
</script>

<style scoped>
.explica {
	background: rgba(25, 118, 210, 0.08);
	border-radius: 6px;
	padding: 8px 12px;
}
.field {
	width: 64px;
	padding: 2px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
}
</style>
