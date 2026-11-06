<template>
	<!-- Filament extruder panel (N-1, 2026-11-06): the Operate card of a FILAMENT tool, the twin of the pellet panel. Four parts in a grid, the same
	     cards and states as the rest of the page: hotend heater, extruder (flow), layer fan, hotend fan. A pellet tool never sees it
	     (print-sections.js hiddenIds). Heating is a double tap (DESIGN.md 5 level 2), cooling and fans one tap (level 1). Operator's (NEED.operate). -->
	<pc-section icon="mdi-printer-3d-nozzle" :title="$t('plugins.WorkshopPrinting.printing.filament_panel')">
		<template v-slot:help>
			<help-tip :title="$t('plugins.WorkshopPrinting.printing.filament_panel')">
				<p class="mb-1">{{ t('fpanel.help_what') }}</p>
				<p class="mb-1">{{ t('fpanel.help_fans') }}</p>
				<p class="mb-0">{{ t('fpanel.help_where') }}</p>
			</help-tip>
		</template>
		<lock-reason :min="needOperate" class="mt-2" />
		<v-alert v-if="!isFff" dense text type="info" class="mt-3 mb-0">{{ t('fpanel.only_fff') }}</v-alert>
		<div v-else-if="!tool" class="text-body-2 grey--text mt-3">{{ t('fpanel.no_tool') }}</div>
		<template v-if="isFff && tool">
			<div class="text-subtitle-2 mt-3">{{ t('fpanel.of_tool', { name: toolName }) }}</div>
			<v-row dense class="mt-1">
				<!-- 1. hotend heater -->
				<v-col cols="12" md="6">
					<v-card outlined class="pa-3 fp-card">
						<div class="d-flex align-center flex-wrap" style="gap:8px">
							<v-icon small>mdi-printer-3d-nozzle-heat</v-icon>
							<span class="text-subtitle-1">{{ t('fpanel.heater') }}</span>
							<v-chip x-small outlined :color="heaterColor">{{ t('fpanel.heat_' + heaterTone) }}</v-chip>
						</div>
						<template v-if="heater">
							<div class="text-h4 my-1">{{ heater.sensorBad ? '--' : Math.round(heater.current) }} °C</div>
							<div class="text-body-2">{{ $t('plugins.WorkshopPrinting.common.target') }} <b>{{ heater.target > 0 ? Math.round(heater.target) + ' °C' : t('fpanel.off') }}</b>
								<span class="grey--text ml-2">{{ t('fpanel.limit', { max: heater.max }) }}</span></div>
							<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
								<input v-model.number="temp" type="number" step="5" min="0" :max="heater.max" class="field" :disabled="!canOperate" /> °C
								<v-btn small :color="armed === 'heat' ? 'amber darken-3' : 'primary'" :disabled="!canOperate || !!heatWhy || sending" @click="arm('heat', heatUp)">
									<v-icon small left>mdi-fire</v-icon>{{ armed === 'heat' ? t('fpanel.heat_again', { temp }) : t('fpanel.heat') }}
								</v-btn>
								<v-btn small outlined :disabled="!canOperate || !!coolWhy || !(heater.target > 0) || sending" @click="coolDown()"><v-icon small left>mdi-snowflake</v-icon>{{ t('fpanel.cool') }}</v-btn>
							</div>
							<div v-if="heatWhy" class="wf-note is-info mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ whyText(heatWhy) }}</span></div>
						</template>
						<div v-else class="text-caption grey--text mt-2">{{ t('fpanel.no_heater') }}</div>
					</v-card>
				</v-col>
				<!-- 2. extruder: flow here; loading and unloading is the Load material section -->
				<v-col cols="12" md="6">
					<v-card outlined class="pa-3 fp-card">
						<div class="d-flex align-center flex-wrap" style="gap:8px">
							<v-icon small>mdi-screw-lag</v-icon>
							<span class="text-subtitle-1">{{ t('fpanel.extruder') }}</span>
							<v-chip x-small outlined>E{{ extruderNumber }}</v-chip>
						</div>
						<div class="text-h4 my-1">{{ flowNow }} %</div>
						<div class="text-body-2 grey--text">{{ t('fpanel.flow_now') }}</div>
						<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
							<input v-model.number="flow" type="number" step="5" min="10" max="300" class="field" :disabled="!canOperate" /> %
							<v-btn small outlined :disabled="!canOperate || !flowOk || sending" @click="applyFlow()"><v-icon small left>mdi-check</v-icon>{{ t('fpanel.flow_apply') }}</v-btn>
							<v-btn small outlined @click="$emit('goto', { section: 'filament' })"><v-icon small left>mdi-tray-arrow-down</v-icon>{{ t('fpanel.go_load') }}</v-btn>
						</div>
						<div class="text-caption grey--text mt-2">{{ t('fpanel.flow_note') }}</div>
					</v-card>
				</v-col>
				<!-- 3. layer fan: set by hand, one tap -->
				<v-col cols="12" md="6">
					<v-card outlined class="pa-3 fp-card">
						<div class="d-flex align-center flex-wrap" style="gap:8px">
							<v-icon small>mdi-fan</v-icon>
							<span class="text-subtitle-1">{{ t('fpanel.layer_fan') }}</span>
						</div>
						<div v-if="!groups.layer.length" class="text-caption grey--text mt-2">{{ t('fpanel.no_layer_fan') }}</div>
						<div v-for="f in groups.layer" :key="f.id" class="mt-2">
							<div class="text-body-2">{{ f.name }} <span class="grey--text">M106 P{{ f.id }} · {{ fanLine(f) }}</span></div>
							<v-slider :value="levels[f.id] != null ? levels[f.id] : Math.round(f.value * 100)" :min="0" :max="100" step="5" dense hide-details thumb-label :disabled="!canOperate || sending"
								@input="v => $set(levels, f.id, v)" @end="setFan(f)" />
							<div class="d-flex flex-wrap mt-1" style="gap:6px">
								<v-btn x-small outlined :disabled="!canOperate || sending" @click="quick(f, 0)">{{ t('fpanel.fan_off') }}</v-btn>
								<v-btn x-small outlined :disabled="!canOperate || sending" @click="quick(f, 50)">50 %</v-btn>
								<v-btn x-small outlined :disabled="!canOperate || sending" @click="quick(f, 100)">100 %</v-btn>
							</div>
						</div>
					</v-card>
				</v-col>
				<!-- 4. hotend fan: the board runs it (thermostatic); only shown, with a warning when it is off and the hotend is hot -->
				<v-col cols="12" md="6">
					<v-card outlined class="pa-3 fp-card">
						<div class="d-flex align-center flex-wrap" style="gap:8px">
							<v-icon small>mdi-fan-chevron-down</v-icon>
							<span class="text-subtitle-1">{{ t('fpanel.hotend_fan') }}</span>
						</div>
						<div v-if="!groups.hotend.length" class="text-caption grey--text mt-2">{{ t('fpanel.no_hotend_fan') }}</div>
						<div v-for="f in groups.hotend" :key="f.id" class="mt-2">
							<div class="text-body-2">{{ f.name }} <span class="grey--text">M106 P{{ f.id }} · {{ fanLine(f) }}</span> <v-chip x-small outlined>{{ t('fpanel.fan_auto') }}</v-chip></div>
							<div v-if="warn(f)" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ t('fpanel.hotend_fan_warn') }}</span></div>
						</div>
						<div v-if="groups.hotend.length" class="text-caption grey--text mt-2">{{ t('fpanel.hotend_fan_note') }}</div>
					</v-card>
				</v-col>
			</v-row>
			<div v-if="groups.others.length" class="text-caption grey--text mt-2">{{ t('fpanel.other_fans', { list: groups.others.map(f => f.name + ' ' + Math.round(f.value * 100) + ' %').join(', ') }) }}</div>
			<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
		</template>
	</pc-section>
</template>

<script>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
'use strict'

import HelpTip from './HelpTip.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36
import { mapActions } from 'vuex'
import { isError } from './util.js'
import { heatCode, coolCode } from './tool-codes.js' // heat and cool codes: one module for every page
import { fanCode, flowCode, zoneState, COLORS } from './pellet-hmi.js'
import { toolHeater, fanGroups, heatReason, coolReason, hotendFanWarning, fanText } from './filament-panel.js'
import { jobRunning } from './job-control.js'
import { machineFree } from './machine-free.js' // job (file, paused or live) and machine state (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { NEED } from './print-sections.js'
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)

export default {
	mixins: [roleMixin],
	sessionData: ['armed', 'msg', 'msgKind'], // what the person who left did or was refused stays nowhere (ESTANDAR 3)
	sessionErrors: ['msg', 'msgKind'], // what a refusal or a failure said: cleared when the person signs in, out or changes role (role-mixin.js)
	components: { PcSection, HelpTip, LockReason },
	props: {
		isFff: { type: Boolean, default: false },
		tool: { type: Object, default: null },
		heaters: { type: Array, default: () => [] },
		fans: { type: Array, default: () => [] },
		state: { type: String, default: '' }
	},
	data() {
		return { temp: 200, flow: 100, levels: {}, armed: null, armedTimer: null, sending: false, msg: null, msgKind: 'info' };
	},
	computed: {
		canOperate() {
			return this.atLeast(NEED.operate);
		},
		needOperate() {
			return NEED.operate;
		},
		model() {
			return this.$store.state.machine.model;
		},
		toolName() {
			return this.tool ? this.tool.name || 'T' + this.tool.number : '';
		},
		heater() {
			return toolHeater(this.heaters, this.tool);
		},
		heaterTone() {
			return zoneState(this.heater);
		},
		heaterColor() {
			return COLORS[this.heaterTone];
		},
		groups() {
			return fanGroups(this.fans, this.tool);
		},
		free() {
			return machineFree(this.model, { t: ts, serviceText, serviceDefaultKey, purpose: 'move' });
		},
		heatWhy() {
			return heatReason({ tool: this.tool, heater: this.heater, busyJob: jobRunning(this.state), notFree: !this.free.free, temp: this.temp });
		},
		coolWhy() {
			return coolReason({ tool: this.tool, heater: this.heater, busyJob: jobRunning(this.state), notFree: !this.free.free });
		},
		extruderNumber() {
			const t = this.tool;
			return t && t.extruders && t.extruders.length ? t.extruders[0] : 0;
		},
		flowNow() {
			const ex = ((this.model.move && this.model.move.extruders) || [])[this.extruderNumber];
			return Math.round(((ex && ex.factor) || 1) * 100);
		},
		flowOk() {
			return !!flowCode(this.flow);
		}
	},
	watch: {
		// the target the machine has is the starting point of the field; what the person typed is not overwritten while they type
		'tool.number': { immediate: true, handler() { this.seed(); } }
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.' + key, params);
		},
		seed() {
			const h = this.heater;
			this.temp = h && h.target > 0 ? Math.round(h.target) : 200;
			this.flow = this.flowNow;
			this.levels = {};
		},
		whyText(why) {
			if (why === 'machine') return this.free.reason;
			return this.t('fpanel.block_' + why, { max: this.heater ? this.heater.max : 0 });
		},
		fanLine(f) {
			return fanText(f);
		},
		warn(f) {
			return hotendFanWarning(f, this.heater, 60);
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
		async run(codes, okText) {
			if (!this.canOperate || this.sending || !codes.length) return false;
			this.sending = true;
			this.msg = null;
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
				this.msg = this.t('fpanel.could_not', { error: e.message || String(e) });
				return false;
			} finally {
				this.sending = false;
			}
		},
		// heating changes the active temperature of the tool without selecting it (selecting runs the tool change macros: tool-codes.js)
		heatUp() {
			const code = this.heatWhy ? '' : heatCode(this.tool.number, this.temp);
			if (code) this.run([code], this.t('fpanel.heating_sent', { temp: Math.round(this.temp) }));
		},
		coolDown() {
			if (!this.coolWhy) this.run([coolCode(this.tool.number)], this.t('fpanel.cooled'));
		},
		applyFlow() {
			const code = flowCode(this.flow);
			if (code) this.run([code], this.t('fpanel.flow_set', { n: Math.round(this.flow) }));
		},
		// a layer fan: a run-time value (config.g keeps the saved one)
		async setFan(f) {
			const v = this.levels[f.id];
			if (v == null) return;
			await this.run([fanCode(f.id, v)], this.t('fpanel.fan_set', { name: f.name, n: v }));
		},
		quick(f, v) {
			this.$set(this.levels, f.id, v);
			this.setFan(f);
		}
	}
};
</script>

<style scoped>
.field {
	width: 64px;
	padding: 2px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
}
</style>
