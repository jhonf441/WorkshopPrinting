<template>
	<!-- Load material (2026-10-30): the short assistant to feed filament into a filament tool or take it out. A pellet tool never sees this
	     section (print-sections.js hiddenIds). Heat to the material's temperature -> load / unload -> cool down. With the filament macros of
	     the board (0:/filaments/<name>/load.g, unload.g) it runs M701 / M702; without them it moves the extruder directly within the limits
	     of filament-load.js. The extruder never moves below the cold extrusion temperature of the board. Operator's (NEED.operate). -->
	<pc-section icon="mdi-tray-arrow-down" :title="$t('plugins.WorkshopPrinting.printing.filament_load')">
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>{{ t('filament.help_what') }} {{ t('filament.help_why') }} {{ t('filament.help_missing') }} {{ t('filament.help_how') }}</p>
		</details>
		<v-alert v-if="!isFff" dense text type="info" class="mt-3 mb-0">{{ t('filament.only_fff') }}</v-alert>

		<!-- 1. the material and the temperature: double tap (it heats, DESIGN.md 5 level 2) -->
		<div class="text-subtitle-2 mt-3">{{ t('filament.step_material') }}</div>
		<div class="text-caption grey--text">{{ t('filament.material_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<v-select v-model="material" :items="materials" item-text="name" return-object :label="$t('plugins.WorkshopPrinting.common.material')" dense outlined hide-details class="fl-select" />
			<span v-if="temp !== null" class="text-body-2">{{ t('filament.heat_to', { tool: toolName, temp, now: nowText }) }}</span>
			<span v-else class="text-caption grey--text">{{ t('filament.no_temp') }}</span>
			<v-chip small outlined :color="heatColor">{{ t('filament.heat_' + heat) }}</v-chip>
		</div>
		<div v-if="loaded" class="text-caption grey--text mt-1">{{ t('filament.loaded_now', { name: loaded }) }}</div>
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<v-btn small :color="armed === 'heat' ? 'amber darken-3' : 'primary'" :disabled="!isFff || temp === null || !canOperate || sending" @click="arm('heat', heatUp)">
				<v-icon small left>mdi-fire</v-icon>{{ armed === 'heat' ? t('filament.heat_again', { temp }) : t('filament.heat') }}
			</v-btn>
			<!-- turning the heater off is safe (level 1): one tap -->
			<v-btn small outlined :disabled="!canOperate || !isFff || !nozzle || !(nozzle.target > 0) || sending" @click="coolDown()">
				<v-icon small left>mdi-snowflake</v-icon>{{ t('filament.cool') }}
			</v-btn>
		</div>

		<!-- 2. load / unload: double tap (it moves the extruder); the reason is written when it cannot -->
		<div class="text-subtitle-2 mt-4">{{ t('filament.step_move') }}</div>
		<div class="text-caption grey--text">{{ macros.load || macros.unload ? t('filament.macro_help', { name: materialName || loaded || '...' }) : t('filament.direct_help') }}</div>
		<div v-if="!macros.load || !macros.unload" class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<span class="text-body-2">{{ t('filament.length') }}</span>
			<input v-model.number="form.length" type="number" step="10" :min="limits.length.min" :max="limits.length.max" class="field" :disabled="!canOperate" /> mm
			<span class="text-body-2 ml-2">{{ t('filament.speed') }}</span>
			<input v-model.number="form.speed" type="number" step="0.5" :min="limits.speed.min" :max="limits.speed.max" class="field" :disabled="!canOperate" /> mm/s
			<span class="text-caption grey--text">{{ t('filament.limits', { lmin: limits.length.min, lmax: limits.length.max, smin: limits.speed.min, smax: limits.speed.max }) }}</span>
		</div>
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<v-btn small :color="armed === 'load' ? 'amber darken-3' : 'primary'" :disabled="!!blockReason || !(macros.load || formOk) || !canOperate || sending" @click="arm('load', () => move('load'))">
				<v-icon small left>mdi-arrow-down-bold</v-icon>{{ armed === 'load' ? $t('plugins.WorkshopPrinting.common.tap_again') : t(macros.load ? 'filament.load_macro' : 'filament.load') }}
			</v-btn>
			<v-btn small outlined :color="armed === 'unload' ? 'amber darken-3' : undefined" :disabled="!!blockReason || !(macros.unload || formOk) || !canOperate || sending" @click="arm('unload', () => move('unload'))">
				<v-icon small left>mdi-arrow-up-bold</v-icon>{{ armed === 'unload' ? $t('plugins.WorkshopPrinting.common.tap_again') : t(macros.unload ? 'filament.unload_macro' : 'filament.unload') }}
			</v-btn>
			<span v-if="blockReason" class="text-caption grey--text">{{ blockReason }}</span>
			<span v-else-if="!formOk && !(macros.load && macros.unload)" class="text-caption warning--text">{{ t('filament.bad_form') }}</span>
		</div>

		<!-- 3. the wrap-up -->
		<div class="text-subtitle-2 mt-4">{{ t('filament.step_after') }}</div>
		<div class="text-caption grey--text">{{ t('filament.after_help') }}</div>
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</pc-section>
</template>

<script>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
'use strict'

import { mapActions } from 'vuex'
import { CFG_FILE, MATERIALS_DEF, readJson, listItemsFolder, isError } from './util.js'
import { FILAMENTS_DIR, LOAD_DEFAULTS, LOAD_LIMITS, coolCodes, directCodes, heatCodes, heatState, loadTemp, loadedFilament, macroCodes, macroState, moveBlock, normalize } from './filament-load.js'
import { jobRunning } from './job-control.js'
import { machineFree } from './machine-free.js' // job (file, paused or live) and machine state (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { NEED } from './print-sections.js'
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)

export default {
	mixins: [roleMixin],
	components: { PcSection },
	props: {
		isFff: { type: Boolean, default: false },
		tool: { type: Object, default: null },
		nozzle: { type: Object, default: null }, // the first zone of the tool (Print.vue heaters)
		minExtrusion: { type: Number, default: 160 }, // heat.coldExtrudeTemperature
		state: { type: String, default: '' }
	},
	data() {
		return {
			limits: LOAD_LIMITS, materials: [], material: null,
			form: { length: LOAD_DEFAULTS.length, speed: LOAD_DEFAULTS.speed }, macros: { load: false, unload: false },
			armed: null, armedTimer: null, sending: false, msg: null, msgKind: 'info'
		};
	},
	computed: {
		// heating and moving the extruder: an operator's, like the pellet motor test (NEED, print-sections.js)
		canOperate() {
			return this.atLeast(NEED.operate);
		},
		model() {
			return this.$store.state.machine.model;
		},
		toolName() {
			return this.tool ? this.tool.name || 'T' + this.tool.number : '';
		},
		extruder() {
			return this.tool && this.tool.extruders && this.tool.extruders.length ? this.tool.extruders[0] : 0;
		},
		materialName() {
			return this.material && this.material.nozzle > 0 ? this.material.name : '';
		},
		temp() {
			return loadTemp(this.material, this.nozzle);
		},
		nowText() {
			return this.nozzle && !this.nozzle.sensorBad && this.nozzle.current != null ? Math.round(this.nozzle.current) : '--';
		},
		heat() {
			return heatState(this.nozzle);
		},
		heatColor() {
			return { ready: 'success', heating: 'amber darken-3', off: 'grey darken-1' }[this.heat];
		},
		loaded() {
			return loadedFilament(this.model, this.extruder);
		},
		formOk() {
			return normalize(this.form).ok;
		},
		free() {
			return machineFree(this.model, { t: ts, serviceText, serviceDefaultKey, purpose: 'move' });
		},
		// why the extruder may not move now ('' = it may): job, machine not free, no reading, below the cold extrusion temperature
		blockReason() {
			const why = moveBlock({ tool: this.tool, nozzle: this.nozzle, minTemp: this.minExtrusion, busyJob: jobRunning(this.state), notFree: !this.free.free });
			if (!why) return '';
			if (why === 'machine') return this.free.reason;
			return this.t('filament.block_' + why, { min: Math.round(this.minExtrusion) });
		}
	},
	watch: {
		// the macros of the material picked (load.g) and of the filament the board remembers (unload.g)
		materialName: { immediate: true, handler() { this.checkMacros(); } },
		loaded() { this.checkMacros(); }
	},
	async mounted() {
		const cfg = (await readJson(CFG_FILE, {})) || {};
		const list = Array.isArray(cfg.materials) && cfg.materials.length ? cfg.materials : MATERIALS_DEF;
		this.materials = [{ name: this.t('filament.material_none'), nozzle: 0 }].concat(list);
		this.material = this.materials.find(m => m.name === cfg.last && m.nozzle > 0) || this.materials[0];
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.' + key, params);
		},
		async checkMacros() {
			const name = this.materialName, cur = this.loaded;
			const load = name ? macroState(await listItemsFolder(FILAMENTS_DIR + '/' + name)).load : false;
			const unload = cur ? macroState(await listItemsFolder(FILAMENTS_DIR + '/' + cur)).unload : false;
			if (name === this.materialName && cur === this.loaded) this.macros = { load, unload };
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
				this.msg = this.t('filament.could_not', { error: e.message || String(e) });
				return false;
			} finally {
				this.sending = false;
			}
		},
		heatUp() {
			if (!this.tool || this.temp === null) return;
			this.run(heatCodes(this.tool.number, this.temp), this.t('filament.heating_sent', { temp: this.temp }));
		},
		coolDown() {
			if (!this.tool) return;
			this.run(coolCodes(this.tool.number), this.t('filament.cooled'));
		},
		// load / unload: the macro of the board when it is there, else the direct extrusion; checked again at the tap
		move(action) {
			if (this.blockReason || !this.tool) return;
			const useMacro = action === 'load' ? this.macros.load : this.macros.unload;
			if (useMacro) {
				const codes = macroCodes(action, this.tool.number, this.materialName);
				this.run(codes, this.t('filament.macro_done', { code: codes[codes.length - 1] }));
				return;
			}
			const v = normalize(this.form);
			if (!v.ok) return;
			this.run(directCodes(action, this.tool.number, v.value), this.t(action === 'load' ? 'filament.loaded' : 'filament.unloaded', { mm: v.value.length }));
		}
	}
};
</script>

<style scoped>
.fl-select {
	flex: 0 1 220px;
	min-width: 160px;
}
.field {
	width: 72px;
	padding: 2px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
	font-variant-numeric: tabular-nums;
}
</style>
