<template>
	<pc-section icon="mdi-scale-balance" :title="$t('plugins.WorkshopPrinting.printing.extruder')">
		<v-alert v-if="!isFff" dense text type="info" class="mb-3">{{ $t('plugins.WorkshopPrinting.common.the_extruder_only_exists_in_fff') }}</v-alert>
		<v-alert v-else-if="!hot" dense text type="warning" class="mb-3">
			{{ $t('plugins.WorkshopPrinting.extruder.needs_hot_nozzle', { now: nozzle ? Math.round(nozzle.current) : '--', min: Math.round(minExtrusion) }) }}
		</v-alert>

		<!-- Tipo de extrusor -->
		<div class="text-subtitle-2 mb-1">{{ $t('plugins.WorkshopPrinting.extruder.kind_title', { tool: toolName }) }}</div>
		<div class="text-body-2">{{ $t('plugins.WorkshopPrinting.extruder.kind_hint') }}</div>
		<v-btn-toggle :value="kind" mandatory dense color="primary" class="mt-1 mb-4" @change="setKind">
			<v-btn value="pellet" small :disabled="!canConfig">{{ $t('plugins.WorkshopPrinting.extruder.kind_pellet') }}</v-btn>
			<v-btn value="filament" small :disabled="!canConfig">{{ $t('plugins.WorkshopPrinting.extruder.kind_filament') }}</v-btn>
		</v-btn-toggle>

		<!-- Purga -->
		<div class="text-subtitle-2 mb-1">{{ $t('plugins.WorkshopPrinting.extruder.purge') }}</div>
		<div class="text-body-2">{{ $t('plugins.WorkshopPrinting.extruder.pushes_plastic_out_of_the_nozzle') }}</div>
		<v-row dense class="mt-1" align="center">
			<v-col cols="4" sm="2"><v-text-field v-model.number="purgeMm" :label="$t('plugins.WorkshopPrinting.extruder.length_mm')" type="number" dense outlined hide-details /></v-col>
			<v-col cols="4" sm="2"><v-text-field v-model.number="purgeF" :label="$t('plugins.WorkshopPrinting.extruder.speed_mm_min')" type="number" dense outlined hide-details /></v-col>
			<v-col cols="4" sm="3">
				<v-btn small :color="armed === 'purge' ? 'amber darken-3' : 'primary'" :disabled="!can || busy" @click="arm('purge', () => extrude(purgeMm, purgeF))">
					{{ armed === 'purge' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.extruder.purge_2') }}
				</v-btn>
			</v-col>
		</v-row>

		<!-- Caudal -->
		<div class="text-subtitle-2 mt-5 mb-1">{{ $t('plugins.WorkshopPrinting.extruder.calibrate_the_flow_by_weight') }}</div>
		<div class="text-body-2">
			{{ $t('plugins.WorkshopPrinting.extruder.' + (kind === 'filament' ? 'filament_flow_intro' : 'pellet_flow_intro'), { diam }) }} <b>M92 E</b> {{ $t('plugins.WorkshopPrinting.extruder.now_steps_mm', { n: currentSteps }) }}
		</div>
		<ol class="text-body-2 mt-2 steps">
			<li>{{ $t('plugins.WorkshopPrinting.extruder.preheat_the_material_and_purge_until') }}</li>
			<li>{{ $t('plugins.WorkshopPrinting.extruder.tap') }} <b>{{ $t('plugins.WorkshopPrinting.extruder.extrude_to_weigh') }}</b> {{ $t('plugins.WorkshopPrinting.extruder.and_collect_everything') }}</li>
			<li>{{ $t('plugins.WorkshopPrinting.extruder.weigh_it_ideally_a_0_01') }}</li>
		</ol>
		<v-row dense class="mt-1" align="center">
			<v-col cols="6" sm="3">
				<v-select v-model="material" :items="materials" item-text="name" return-object :label="$t('plugins.WorkshopPrinting.common.material')" dense outlined hide-details />
			</v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="diam" :label="$t('plugins.WorkshopPrinting.extruder.diameter_in_the_slicer_mm')" type="number" step="0.01" dense outlined hide-details /></v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="testMm" :label="$t('plugins.WorkshopPrinting.extruder.length_mm')" type="number" dense outlined hide-details /></v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="testF" :label="$t('plugins.WorkshopPrinting.extruder.speed_mm_min')" type="number" dense outlined hide-details /></v-col>
			<v-col cols="12" sm="3">
				<v-btn small :color="armed === 'test' ? 'amber darken-3' : 'primary'" :disabled="!can || busy" @click="arm('test', () => extrude(testMm, testF, true))">
					{{ armed === 'test' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.extruder.extrude_to_weigh') }}
				</v-btn>
			</v-col>
		</v-row>
		<v-row dense class="mt-1" align="center">
			<v-col cols="6" sm="3"><v-text-field v-model.number="weightG" :label="$t('plugins.WorkshopPrinting.extruder.measured_weight_g')" type="number" step="0.01" dense outlined hide-details /></v-col>
			<v-col cols="12" sm="9" class="text-body-2">
				<template v-if="calculation">
					{{ $t('plugins.WorkshopPrinting.extruder.expected') }} <b>{{ calculation.expected.toFixed(2) }} g</b>, {{ $t('plugins.WorkshopPrinting.extruder.measured') }} <b>{{ weightG }} g</b>: {{ $t('plugins.WorkshopPrinting.extruder.the_extruder_gives') }}
					<b :class="Math.abs(calculation.pct - 100) > 5 ? 'warning--text' : 'success--text'">{{ calculation.pct.toFixed(0) }} %</b> {{ $t('plugins.WorkshopPrinting.extruder.of_what_was_requested') }}
					{{ $t('plugins.WorkshopPrinting.extruder.new') }} <b>M92 E{{ calculation.newItem }}</b>.
				</template>
				<span v-else class="grey--text">{{ $t('plugins.WorkshopPrinting.extruder.pick_the_material_and_type_the') }}</span>
			</v-col>
		</v-row>
		<v-alert v-if="calculation && (calculation.pct < 50 || calculation.pct > 200)" dense text type="warning" class="mt-2 mb-0">
			{{ $t('plugins.WorkshopPrinting.extruder.very_different_from_expected_check_the') }}
		</v-alert>
		<div v-if="calculation" class="d-flex flex-wrap mt-2" style="gap:8px">
			<v-btn small outlined :disabled="busy" @click="applyChanges(false)">{{ $t('plugins.WorkshopPrinting.extruder.apply_now_until_the_mode_changes') }}</v-btn>
			<v-btn small :color="armed === 'save' ? 'amber darken-3' : 'primary'" :disabled="busy" @click="arm('save', () => applyChanges(true))">
				{{ armed === 'save' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.common.save_to_modefff_g') }}
			</v-btn>
		</div>
		<div class="text-caption grey--text mt-1">{{ $t('plugins.WorkshopPrinting.extruder.save_changes_the_m92_e_line') }}</div>
		<error-notice v-if="failure" :error="failure" class="mt-3" />
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</pc-section>
</template>

<script>
import i18n from '../../i18n'
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)

'use strict'

import { mapActions } from 'vuex'
import { CFG_FILE, MATERIALS_DEF, readJson, updateCfg, changeLineMode, isError, markStartup, note } from './util.js'
import { rememberForNozzle } from './nozzle-store.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)
import { isFriendly } from './print-errors.js'
import { NEED } from './print-sections.js'
import { kindOfTool, loadExtruderKinds, saveExtruderKind } from './extruder-kind.js' // pellets or filament of each tool (printing.json)

export default {
	mixins: [roleMixin],
	components: { ErrorNotice, PcSection },
	props: {
		isFff: { type: Boolean, default: false },
		nozzle: { type: Object, default: null },
		extruder: { type: Object, default: null },
		tool: { type: Object, default: null },
		minExtrusion: { type: Number, default: 160 },
		state: { type: String, default: '' }
	},
	data() {
		return {
			cfg: {}, materials: [], material: null, diam: 1.75,
			purgeMm: 50, purgeF: 120, testMm: 100, testF: 60, weightG: null,
			armed: null, armedTimer: null, busy: false, msg: null, msgKind: 'info', failure: null
		};
	},
	computed: {
		kind() {
			return kindOfTool(this.tool ? this.tool.number : 0);
		},
		toolName() {
			return this.tool ? this.tool.name || 'T' + this.tool.number : '';
		},
		canConfig() {
			return this.atLeast(NEED.configure);
		},
		currentSteps() {
			return this.extruder ? this.extruder.stepsPerMm : null;
		},
		hot() {
			const b = this.nozzle;
			return !!b && b.current >= this.minExtrusion && b.target > 0 && Math.abs(b.current - b.target) <= 5;
		},
		can() {
			return this.isFff && this.hot && !!this.tool && ['idle', 'busy'].includes(this.state);
		},
		calculation() {
			const m = this.material;
			if (!m || !(m.density > 0) || !(this.weightG > 0) || !(this.diam > 0) || !(this.testMm > 0) || !this.currentSteps) return null;
			const area = Math.PI * Math.pow(this.diam / 2, 2); // mm2
			const expected = (this.testMm * area * m.density) / 1000; // g
			const pct = (this.weightG / expected) * 100;
			return { expected: expected, pct, newItem: Math.round((this.currentSteps * expected) / this.weightG * 10) / 10 };
		}
	},
	async mounted() {
		loadExtruderKinds();
		this.cfg = (await readJson(CFG_FILE, {})) || {};
		this.materials = Array.isArray(this.cfg.materials) && this.cfg.materials.length ? this.cfg.materials : MATERIALS_DEF;
		this.material = this.materials.find(m => m.name === this.cfg.last) || this.materials[0];
		if (this.cfg.diameter > 0) this.diam = this.cfg.diameter;
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		async setKind(v) {
			if (!v || !this.atLeast(NEED.configure)) return; // writes printing.json
			this.msg = null;
			try {
				await saveExtruderKind(this.tool ? this.tool.number : 0, v);
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.extruder.could_not_save_kind') + (e.message || e);
			}
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
		async send(codes) {
			for (const c of codes) {
				const r = await this.sendCode({ code: c, log: true });
				if (isError(r)) throw new Error(r);
			}
		},
		async extrude(mm, f, test) {
			const L = Math.max(1, Math.min(500, Number(mm) || 0));
			const F = Math.max(10, Math.min(1200, Number(f) || 60));
			this.busy = true;
			this.msg = null;
			try {
				await this.send([`T${this.tool.number}`, 'M83', `G1 E${L} F${F}`, 'M400']);
				this.msgKind = 'success';
				this.msg = test ? i18n.t('plugins.WorkshopPrinting.extruder.extruded_weigh_it', { mm: L }) : i18n.t('plugins.WorkshopPrinting.extruder.purge_done', { mm: L });
				if (test) this.weightG = null;
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.extruder.could_not_extrude', { error: e.message || String(e) });
			} finally {
				this.busy = false;
			}
		},
		async applyChanges(save) {
			const n = this.calculation && this.calculation.newItem;
			if (!(n > 0)) return;
			if (save && !this.atLeast(NEED.configure)) return; // saving writes modefff.g
			this.failure = null;
			this.busy = true;
			try {
				await this.send([`M92 E${n}`]);
				let txt = i18n.t('plugins.WorkshopPrinting.extruder.applied_m92', { n });
				if (save) {
					const r = await changeLineMode('M92 E', `M92 E${n}`);
					txt += ' ' + i18n.t('plugins.WorkshopPrinting.extruder.saved_in_modefff_before', { before: r.before.trim() });
					markStartup('flow', true, `M92 E${n}`).catch(() => {});
					rememberForNozzle({ flow: { steps: n } });
					note(this.sendCode, 'calibration', i18n.t('plugins.WorkshopPrinting.extruder.log_flow_saved', { n, material: this.material ? this.material.name : '' }));
				}
				// recordar el diametro elegido
				updateCfg({ diameter: this.diam }).catch(() => {});
				this.msgKind = 'success';
				this.msg = txt;
			} catch (e) {
				if (isFriendly(e)) this.failure = e;
				else {
					this.msgKind = 'error';
					this.msg = i18n.t('plugins.WorkshopPrinting.extruder.could_not_apply') + (e.message || e);
				}
			} finally {
				this.busy = false;
			}
		}
	}
};
</script>

<style scoped>
.steps {
	padding-left: 20px;
}
</style>
