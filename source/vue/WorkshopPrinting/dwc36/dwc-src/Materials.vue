<template>
	<pc-section icon="mdi-flask-outline" :title="$t('plugins.WorkshopPrinting.printing.materials')">
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>
			{{ $t('plugins.WorkshopPrinting.materials.temperatures_for_each_plastic_as_pellets') }} <b>{{ $t('plugins.WorkshopPrinting.materials.preheat') }}</b> {{ $t('plugins.WorkshopPrinting.materials.preheat_explain') }}
			</p>
		</details>
		<div v-if="!loaded" class="text-caption grey--text mt-3">{{ $t('plugins.WorkshopPrinting.common.reading') }}</div>
		<template v-else>
			<div style="overflow-x:auto" class="mt-3">
				<table class="table">
					<thead>
						<tr><th>{{ $t('plugins.WorkshopPrinting.common.material') }}</th><th>{{ $t('plugins.WorkshopPrinting.materials.nozzle_c') }}</th><th>{{ $t('plugins.WorkshopPrinting.materials.bed_c') }}</th><th v-if="camera">{{ $t('plugins.WorkshopPrinting.materials.chamber_c') }}</th><th>{{ $t('plugins.WorkshopPrinting.materials.fan') }}</th><th>{{ $t('plugins.WorkshopPrinting.materials.density_g_cm') }}</th><th></th></tr>
					</thead>
					<tbody>
						<tr v-for="(m, k) in list" :key="k">
							<td><input v-model.trim="m.name" class="field" style="width:90px" :disabled="!canEdit" @change="changed = true" /></td>
							<td><input v-model.number="m.nozzle" type="number" class="field" :class="{ bad: outside(m.nozzle, nozzle) }" :disabled="!canEdit" @change="changed = true" /></td>
							<td><input v-model.number="m.bed" type="number" class="field" :class="{ bad: outside(m.bed, bed) }" :disabled="!canEdit" @change="changed = true" /></td>
							<td v-if="camera"><input v-model.number="m.camera" type="number" class="field" :class="{ bad: outside(m.camera, camera) }" :disabled="!canEdit" @change="changed = true" /></td>
							<td><input v-model.number="m.fan" type="number" min="0" max="100" class="field" :disabled="!canEdit" @change="changed = true" /></td>
							<td><input v-model.number="m.density" type="number" step="0.01" class="field" :disabled="!canEdit" @change="changed = true" /></td>
							<td style="white-space:nowrap">
								<v-btn x-small :color="armed === k ? 'amber darken-3' : 'primary'" :disabled="!isFff || !!problem(m) || !canPreheat" :title="problem(m)" @click="arm(k, m)">
									<v-icon x-small left>mdi-fire</v-icon>{{ armed === k ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.materials.preheat') }}
								</v-btn>
								<v-btn v-if="canEdit" x-small icon :title="$t('plugins.WorkshopPrinting.materials.remove')" @click="list.splice(k, 1); changed = true"><v-icon x-small>mdi-delete</v-icon></v-btn>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div v-if="tools.length > 1" class="d-flex flex-wrap align-center mt-2" style="gap:8px">
				<span class="text-body-2">{{ $t('plugins.WorkshopPrinting.materials.preheat_on') }}</span>
				<v-btn-toggle v-model="toolSel" mandatory dense color="primary">
					<v-btn v-for="t in tools" :key="t.number" x-small :value="t.number">{{ t.name || ('T' + t.number) }}</v-btn>
				</v-btn-toggle>
			</div>
			<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
				<v-btn v-if="canEdit" x-small outlined @click="add()"><v-icon x-small left>mdi-plus</v-icon>{{ $t('plugins.WorkshopPrinting.materials.add_material') }}</v-btn>
				<v-btn v-if="canEdit" x-small :color="changed ? 'primary' : ''" :disabled="!changed" :loading="saving" @click="save()">{{ $t('plugins.WorkshopPrinting.common.save') }}</v-btn>
				<v-btn v-if="canEdit" x-small text @click="restore()">{{ $t('plugins.WorkshopPrinting.materials.factory_values') }}</v-btn>
				<span v-if="!isFff" class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.materials.preheat_only_in_fff_mode') }}</span>
			</div>
			<div class="text-caption grey--text mt-1">
				{{ $t('plugins.WorkshopPrinting.materials.machine_limits', { nozzle: nozzle ? nozzle.max : '--', bed: bed ? bed.max : '--' }) }}<template v-if="camera">, {{ $t('plugins.WorkshopPrinting.materials.chamber_c_value', { c: camera.max }) }}</template>. {{ $t('plugins.WorkshopPrinting.materials.red_out_of_limit') }}
				<template v-if="nozzleZones.length > 1"> {{ $t('plugins.WorkshopPrinting.materials.nozzle_has_n_zones', { n: nozzleZones.length }) }}</template>
			</div>
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
import { CFG_FILE, MATERIALS_DEF, readJson, updateCfg, isError } from './util.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)
import { isFriendly } from './print-errors.js'
import { NEED } from './print-sections.js'

export default {
	mixins: [roleMixin],
	components: { ErrorNotice, PcSection },
	props: {
		isFff: { type: Boolean, default: false },
		heaters: { type: Array, default: () => [] },
		tools: { type: Array, default: () => [] },
		currentTool: { type: Object, default: null }
	},
	computed: {
		// preheating is an operator's (like the work lights); editing the table writes printing.json: a technician's (NEED, print-sections.js)
		canPreheat() {
			return this.atLeast(NEED.operate);
		},
		canEdit() {
			return this.atLeast(NEED.configure);
		},
		selectedTool() {
			return this.tools.find(t => t.number === this.toolSel) || this.currentTool;
		},
		nozzleZones() {
			const t = this.selectedTool;
			return this.heaters.filter(h => h.paper === 'nozzle' && t && h.tool === t.number);
		},
		nozzle() {
			// zone 1 (the nozzle) gets the material temperature: its cap rules (the other zones work colder, with their own caps)
			return this.nozzleZones.find(h => h.zone === 0) || this.nozzleZones[0] || null;
		},
		bed() {
			return this.heaters.find(h => h.paper === 'bed') || null;
		},
		camera() {
			return this.heaters.find(h => h.paper === 'camera') || null;
		}
	},
	watch: {
		currentTool: {
			immediate: true,
			handler(t) {
				if (t && this.toolSel == null) this.toolSel = t.number;
			}
		}
	},
	data() {
		return { toolSel: null, cfg: {}, list: [], loaded: false, changed: false, saving: false, armed: null, armedTimer: null, msg: null, msgKind: 'info', failure: null };
	},
	async mounted() {
		this.cfg = (await readJson(CFG_FILE, {})) || {};
		const m = Array.isArray(this.cfg.materials) && this.cfg.materials.length ? this.cfg.materials : MATERIALS_DEF;
		this.list = JSON.parse(JSON.stringify(m));
		this.loaded = true;
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		outside(t, h) {
			return !!h && h.max != null && t > h.max;
		},
		problem(m) {
			if (!(m.nozzle > 0)) return i18n.t('plugins.WorkshopPrinting.materials.nozzle_temperature_missing');
			if (this.outside(m.nozzle, this.nozzle)) return i18n.t('plugins.WorkshopPrinting.materials.nozzle_above_the_machine_limit');
			if (this.outside(m.bed, this.bed)) return i18n.t('plugins.WorkshopPrinting.materials.bed_above_the_machine_limit');
			if (this.outside(m.camera, this.camera)) return i18n.t('plugins.WorkshopPrinting.materials.chamber_above_the_machine_limit');
			if (!this.selectedTool) return i18n.t('plugins.WorkshopPrinting.materials.no_tool_fff_mode');
			return '';
		},
		add() {
			this.list.push({ name: i18n.t('plugins.WorkshopPrinting.materials.new'), nozzle: 210, bed: 60, camera: 0, fan: 50, density: 1.2 });
			this.changed = true;
		},
		restore() {
			this.list = JSON.parse(JSON.stringify(MATERIALS_DEF));
			this.changed = true;
		},
		async save() {
			if (!this.canEdit) return;
			this.failure = null;
			this.saving = true;
			try {
				const cfg = await updateCfg({ materials: this.list });
				this.cfg = cfg;
				this.changed = false;
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.materials.materials_saved');
			} catch (e) {
				if (isFriendly(e)) this.failure = e;
				else {
					this.msgKind = 'error';
					this.msg = i18n.t('plugins.WorkshopPrinting.common.could_not_save') + (e.message || e);
				}
			} finally {
				this.saving = false;
			}
		},
		arm(k, m) {
			if (this.armed !== k) {
				this.armed = k;
				clearTimeout(this.armedTimer);
				this.armedTimer = setTimeout(() => { this.armed = null; }, 4000);
				return;
			}
			this.armed = null;
			this.preheat(m);
		},
		async preheat(m) {
			this.cfg = (await readJson(CFG_FILE, {})) || this.cfg; // the staging may have changed in another tab
			const t = this.selectedTool;
			// several zones (pellet): all at the material's temperature
			// pellet zones: the 1st at the material's temperature, the others with their
			// staging (Pellet and zones), never above their cap
			const esc = (this.cfg && this.cfg.step) || {};
			const temps = (t.heaters && t.heaters.length ? t.heaters : [null]).map((h, k) => {
				const z = this.heaters.find(c => c.id === h);
				let v = Math.round(m.nozzle) + (k > 0 && h != null ? Number(esc[h]) || 0 : 0);
				if (z && z.max) v = Math.min(v, z.max);
				return Math.max(0, v);
			}).join(':');
			const codes = [`T${t.number}`, `M568 P${t.number} S${temps} R${temps} A2`];
			if (this.bed && m.bed > 0) codes.push(`M140 S${Math.round(m.bed)}`);
			if (this.camera && m.camera > 0) codes.push(`M141 S${Math.round(m.camera)}`);
			const fan = (t.fans || [])[0];
			if (fan != null && m.fan >= 0) codes.push(`M106 P${fan} S${Math.max(0, Math.min(1, m.fan / 100)).toFixed(2)}`);
			try {
				for (const c of codes) {
					const r = await this.sendCode({ code: c, log: true });
					if (isError(r)) throw new Error(r);
				}
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.materials.preheating', { name: m.name, c: m.nozzle }) + (this.bed && m.bed > 0 ? ', ' + i18n.t('plugins.WorkshopPrinting.materials.bed_c_value', { c: m.bed }) : '') + (this.camera && m.camera > 0 ? ', ' + i18n.t('plugins.WorkshopPrinting.materials.chamber_c_value', { c: m.camera }) : '') + '. ' + i18n.t('plugins.WorkshopPrinting.materials.see_status_tab');
				// remember the last material (used by the Extruder tab)
				this.cfg = Object.assign({}, this.cfg, { last: m.name });
				updateCfg({ last: m.name }).catch(() => {});
			} catch (e) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.materials.could_not_preheat', { error: e.message || String(e) });
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
.table {
	border-collapse: collapse;
	font-size: 13px;
}
.table th {
	text-align: left;
	font-weight: 500;
	color: var(--tp-faint, #9e9e9e);
	padding: 4px 6px;
	white-space: nowrap;
}
.table td {
	padding: 3px 6px;
	border-top: 1px solid rgba(128, 128, 128, 0.15);
}
.field {
	width: 64px;
	padding: 3px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
	font-variant-numeric: tabular-nums;
}
.field.bad {
	border-color: #e53935;
	color: #e53935;
}
</style>
