<template>
	<pc-section icon="mdi-flask-outline" :title="$t('plugins.WorkshopPrinting.printing.materials')">
		<help-guide :title="$t('plugins.WorkshopPrinting.common.how_it_works')">
			<p>
			{{ $t('plugins.WorkshopPrinting.materials.temperatures_for_each_plastic_as_pellets') }} {{ tx('profile_lead') }} <b>{{ $t('plugins.WorkshopPrinting.materials.preheat') }}</b> {{ $t('plugins.WorkshopPrinting.materials.preheat_explain') }}
			</p>
		</help-guide>
		<div v-if="!loaded" class="text-caption grey--text mt-3">{{ $t('plugins.WorkshopPrinting.common.reading') }}</div>
		<template v-else>
			<div style="overflow-x:auto" class="mt-3">
				<table class="table">
					<thead>
						<tr><th>{{ $t('plugins.WorkshopPrinting.common.material') }}</th><th>{{ tx('kind') }}</th><th>{{ $t('plugins.WorkshopPrinting.materials.nozzle_c') }}</th><th>{{ $t('plugins.WorkshopPrinting.materials.bed_c') }}</th><th v-if="camera">{{ $t('plugins.WorkshopPrinting.materials.chamber_c') }}</th><th>{{ $t('plugins.WorkshopPrinting.materials.fan') }}</th><th>{{ $t('plugins.WorkshopPrinting.materials.density_g_cm') }}</th><th></th></tr>
					</thead>
					<tbody v-for="(m, k) in list" :key="k">
						<tr>
							<td><input v-model.trim="m.name" class="field" style="width:90px" :disabled="!canEdit" :aria-label="$t('plugins.WorkshopPrinting.common.material')" @change="changed = true" /></td>
							<td><v-chip x-small outlined :color="kindOf(m) === 'pellet' ? 'primary' : 'info'">{{ tx('kind_' + kindOf(m)) }}</v-chip></td>
							<td><input v-model.number="m.nozzle" type="number" class="field" :class="{ bad: outside(m.nozzle, nozzle) }" :disabled="!canEdit" @change="changed = true" /></td>
							<td><input v-model.number="m.bed" type="number" class="field" :class="{ bad: outside(m.bed, bed) }" :disabled="!canEdit" @change="changed = true" /></td>
							<td v-if="camera"><input v-model.number="m.camera" type="number" class="field" :class="{ bad: outside(m.camera, camera) }" :disabled="!canEdit" @change="changed = true" /></td>
							<td><input v-model.number="m.fan" type="number" min="0" max="100" class="field" :disabled="!canEdit" @change="changed = true" /></td>
							<td><input v-model.number="m.density" type="number" step="0.01" class="field" :disabled="!canEdit" @change="changed = true" /></td>
							<td style="white-space:nowrap">
								<v-btn x-small :color="armed === k ? 'amber darken-3' : 'primary'" :disabled="!isFff || !!problem(m) || !canPreheat || !!heatReason" :title="problem(m) || heatReason" @click="arm(k, m)">
									<v-icon x-small left>mdi-fire</v-icon>{{ armed === k ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.materials.preheat') }}
								</v-btn>
								<v-btn x-small outlined :aria-expanded="open === k ? 'true' : 'false'" :title="tx('details_title')" @click="open = open === k ? null : k"><v-icon x-small left>{{ open === k ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>{{ tx('details') }}</v-btn>
								<v-btn v-if="canEdit" x-small icon :color="delArmed === k ? 'amber darken-3' : undefined" :title="delTitle(k, m)" :aria-label="delTitle(k, m)" @click="removeRow(k)"><v-icon x-small>mdi-delete</v-icon></v-btn>
							</td>
						</tr>
						<tr v-if="open === k">
							<td :colspan="colCount" class="details">
								<div class="d-flex align-center flex-wrap" style="gap:8px">
									<span class="text-body-2">{{ tx('kind') }}</span>
									<v-btn-toggle :value="kindOf(m)" mandatory dense color="primary" @change="setKind(m, $event)">
										<v-btn x-small value="pellet" :disabled="!canEdit">{{ tx('kind_pellet') }}</v-btn>
										<v-btn x-small value="filament" :disabled="!canEdit">{{ tx('kind_filament') }}</v-btn>
									</v-btn-toggle>
									<help-tip v-bind="help('kind')" />
								</div>

								<div class="mt-3">
									<div class="d-flex align-center" style="gap:6px"><v-icon small aria-hidden="true">mdi-printer-3d-nozzle-outline</v-icon><span class="text-subtitle-2">{{ tx('zones_extruder') }}</span><help-tip v-bind="help('zones_extruder')" /></div>
									<div v-if="!nozzleZones.length" class="text-caption grey--text">{{ tx('zones_extruder_none') }}</div>
									<div v-else class="d-flex flex-wrap mt-1" style="gap:8px 16px">
										<label v-for="(h, i) in nozzleZones" :key="'e' + h.id" class="zone">
											<span class="text-caption">{{ tx('zone_label', { n: i + 1, h: h.id }) }}</span>
											<input :value="hasOwnExtruder(m, i) ? m.zones.extruder[i] : ''" :placeholder="String(extruderShown(m)[i])" type="number" class="field" :class="{ bad: outside(extruderShown(m)[i], h) }" :disabled="!canEdit" @change="setExtruder(m, i, $event.target.value)" />
											<span class="text-caption grey--text">{{ hasOwnExtruder(m, i) ? tx('zone_own') : tx('zone_staged') }}</span>
										</label>
									</div>
								</div>

								<div class="mt-3">
									<div class="d-flex align-center" style="gap:6px"><v-icon small aria-hidden="true">mdi-radiator</v-icon><span class="text-subtitle-2">{{ tx('zones_bed') }}</span><help-tip v-bind="help('zones_bed')" /></div>
									<div v-if="!bedHeaters.length" class="text-caption grey--text">{{ tx('zones_bed_none') }}</div>
									<div v-else class="d-flex flex-wrap mt-1" style="gap:8px 16px">
										<label v-for="(z, i) in bedShown(m)" :key="'b' + z.id" class="zone">
											<span class="text-caption">{{ tx('zone_label', { n: i + 1, h: z.id }) }}</span>
											<input :value="z.own ? m.zones.bed[z.id] : ''" :placeholder="String(z.t)" type="number" class="field" :class="{ bad: outside(z.t, bedHeaters[i]) }" :disabled="!canEdit" @change="setBed(m, z.id, $event.target.value)" />
											<span class="text-caption grey--text">{{ z.own ? tx('zone_own') : tx('zone_follows_bed') }}</span>
										</label>
									</div>
								</div>

								<material-layers class="mt-4" :link-name="m._from || ''" :current-name="m.name || ''" :kind="kindOf(m)" :tool="selectedTool" :bed-config="bedConfig" :exists="!!recipeFor(m._from)" @changed="recipesChanged" />
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
				<v-btn v-if="canEdit" x-small :color="changed ? 'primary' : ''" :disabled="!changed || !!nameIssues.length" :loading="saving" @click="save()">{{ $t('plugins.WorkshopPrinting.common.save') }}</v-btn>
				<v-btn v-if="canEdit" x-small text @click="restore()">{{ $t('plugins.WorkshopPrinting.materials.factory_values') }}</v-btn>
				<span v-if="!isFff" class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.materials.preheat_only_in_fff_mode') }}</span>
				</div>
			<!-- ONE reason for the preheat buttons and the table: preheating is an operator's, editing a technician's -->
			<lock-reason :min="lockNeed" class="mt-1" />
			<div class="text-caption grey--text mt-1">
				{{ $t('plugins.WorkshopPrinting.materials.machine_limits', { nozzle: nozzle ? nozzle.max : '--', bed: bed ? bed.max : '--' }) }}<template v-if="camera">, {{ $t('plugins.WorkshopPrinting.materials.chamber_c_value', { c: camera.max }) }}</template>. {{ $t('plugins.WorkshopPrinting.materials.red_out_of_limit') }}
				<template v-if="nozzleZones.length > 1"> {{ $t('plugins.WorkshopPrinting.materials.nozzle_has_n_zones', { n: nozzleZones.length }) }}</template>
			</div>
		</template>
		<error-notice v-if="failure" :error="failure" class="mt-3" />
		<ul v-if="nameIssues.length" class="mt-2"><li v-for="(e, i) in nameIssues" :key="i" class="text-caption error--text">{{ tx(e.key, e.params) }}</li></ul>
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</pc-section>
</template>

<script>
import i18n from '../../i18n'
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import HelpGuide from './HelpGuide.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36

'use strict'

import { mapActions } from 'vuex'
import { CFG_FILE, MATERIALS_DEF, readJson, updateCfg, isError } from './util.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)
import { isFriendly } from './print-errors.js'
import { NEED } from './print-sections.js'
import { heatBlock } from './filament-load.js' // why a heater may not be turned on now (the same guard as Load material)
import { heatZonesCode } from './tool-codes.js' // heat code without selecting the tool: one module for every page
import { jobRunning } from './job-control.js'
import { machineFree } from './machine-free.js' // job (file, paused or live) and machine state (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { api } from './workshop-api.js'
import HelpTip from './HelpTip.vue' // vue/_shared36
import MaterialLayers from './MaterialLayers.vue'
import { kindOf, extruderTemps, hasOwnExtruder, bedTemps, setZone, cleanList, nameProblems, linkPlan, recipeNameFor } from './material-profile.js'

export default {
	mixins: [roleMixin],
	sessionData: ['armed', 'msg', 'msgKind', 'failure'], // what the person who left did or was refused stays nowhere (ESTANDAR 3)
	sessionErrors: ['msg', 'msgKind', 'failure'], // what a refusal or a failure said: cleared when the person signs in, out or changes role (role-mixin.js)
	components: { HelpGuide, ErrorNotice, PcSection, LockReason, HelpTip, MaterialLayers },
	props: {
		isFff: { type: Boolean, default: false },
		heaters: { type: Array, default: () => [] },
		tools: { type: Array, default: () => [] },
		currentTool: { type: Object, default: null },
		state: { type: String, default: '' } // the status of the machine (a file job shows in it): no heating in the middle of a job
	},
	computed: {
		// preheating is an operator's (like the work lights); editing the table writes printing.json: a technician's (NEED, print-sections.js)
		canPreheat() {
			return this.atLeast(NEED.operate);
		},
		canEdit() {
			return this.atLeast(NEED.configure);
		},
		needEdit() {
			return NEED.configure;
		},
		// the role the buttons still wait for: the one of the preheat first, then the one of the table
		lockNeed() {
			return this.canPreheat ? NEED.configure : NEED.operate;
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
		// the heaters of the bed zones (bed-zones config), each with its cap
		bedHeaters() {
			const zs = ((this.bedConfig && this.bedConfig.zones) || []).filter(z => z && z.active !== false && Number.isInteger(z.bed));
			return zs.map(z => ({ id: z.bed, max: ((this.heaters.find(h => h.id === z.bed) || this.bed || {}).max) || null }));
		},
		colCount() {
			return 8 + (this.camera ? 1 : 0);
		},
		nameIssues() {
			return nameProblems(this.list);
		},
		camera() {
			return this.heaters.find(h => h.paper === 'camera') || null;
		},
		free() {
			return machineFree(this.$store.state.machine.model, { t: ts, serviceText, serviceDefaultKey, purpose: 'move' });
		},
		// why the heaters may not be turned on now ('' = they may): no tool, a job running (its temperatures come from the file), machine not free
		heatReason() {
			const why = heatBlock({ tool: this.selectedTool, nozzle: this.nozzle, busyJob: jobRunning(this.state), notFree: !this.free.free });
			if (!why) return '';
			if (why === 'machine') return this.free.reason;
			return i18n.t('plugins.WorkshopPrinting.' + (why === 'job' ? 'filament.heat_block_job' : 'filament.block_' + why));
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
		return { open: null, delArmed: null, delTimer: null, bedConfig: null, recipes: [], originals: [], toolSel: null, cfg: {}, list: [], loaded: false, changed: false, saving: false, armed: null, armedTimer: null, msg: null, msgKind: 'info', failure: null };
	},
	async mounted() {
		this.cfg = (await readJson(CFG_FILE, {})) || {};
		const m = Array.isArray(this.cfg.materials) && this.cfg.materials.length ? this.cfg.materials : MATERIALS_DEF;
		this.list = JSON.parse(JSON.stringify(m));
		this.markOriginals();
		this.loaded = true;
		this.loadLinks();
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
		clearTimeout(this.delTimer);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		tx(key, params) {
			return i18n.t('plugins.WorkshopPrinting.materials.' + key, params || {});
		},
		help(k) {
			return { title: this.tx('help_' + k + '_title'), what: this.tx('help_' + k + '_what'), why: this.tx('help_' + k + '_why'), ifMissing: this.tx('help_' + k + '_miss'), how: this.tx('help_' + k + '_how') };
		},
		// the name each material was loaded with: the link with its layer recipe (a new material has none)
		markOriginals() {
			this.list.forEach(m => { m._from = m.name; });
			this.originals = this.list.map(m => m.name);
		},
		// the recipes of the service (by name) and the bed zones: both are optional, a service without them only hides the layer block
		async loadLinks() {
			try {
				this.recipes = ((await api('layerrecipes.list', {}, { quiet: true })).recipes || []).map(r => r.name);
			} catch (e) { /* the block says it cannot read them */ }
			try {
				this.bedConfig = (await api('bedzones.get', {}, { quiet: true })).config;
			} catch (e) { /* no bed zones */ }
		},
		recipeFor(name) {
			return recipeNameFor(name, this.recipes);
		},
		recipesChanged(e) {
			const rest = this.recipes.filter(n => n.toLowerCase() !== String(e.name).toLowerCase());
			this.recipes = e.has ? rest.concat([e.name]) : rest;
		},
		kindOf(m) {
			return kindOf(m, this.nozzleZones.length);
		},
		setKind(m, kind) {
			if (!this.canEdit || m.kind === kind) return;
			this.$set(m, 'kind', kind);
			this.changed = true;
		},
		hasOwnExtruder,
		extruderHeaters() {
			return this.nozzleZones.map(h => ({ id: h.id, max: h.max || null }));
		},
		extruderShown(m) {
			return extruderTemps(m, this.extruderHeaters(), (this.cfg && this.cfg.step) || {});
		},
		bedShown(m) {
			return bedTemps(m, this.bedHeaters);
		},
		setExtruder(m, i, v) {
			if (!this.canEdit) return;
			setZone(m, 'extruder', i, v, this.nozzleZones.length);
			this.list = this.list.slice();
			this.changed = true;
		},
		setBed(m, id, v) {
			if (!this.canEdit) return;
			setZone(m, 'bed', id, v);
			this.list = this.list.slice();
			this.changed = true;
		},
		delTitle(k, m) {
			return this.delArmed === k ? this.tx('remove_again', { name: m.name }) : this.$t('plugins.WorkshopPrinting.materials.remove');
		},
		// taking a material out also takes out its layer changes: when it has them the first tap only warns (second tap within 4 s)
		removeRow(k) {
			const m = this.list[k];
			if (this.recipeFor(m._from) && this.delArmed !== k) {
				this.delArmed = k;
				clearTimeout(this.delTimer);
				this.delTimer = setTimeout(() => { this.delArmed = null; }, 4000);
				this.msgKind = 'warning';
				this.msg = this.tx('remove_again', { name: m.name });
				return;
			}
			this.delArmed = null;
			this.open = null;
			this.list.splice(k, 1);
			this.changed = true;
		},
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
			const base = i18n.t('plugins.WorkshopPrinting.materials.new');
			let name = base;
			for (let n = 2; this.list.some(x => String(x.name).toLowerCase() === name.toLowerCase()); n++) name = base + ' ' + n;
			this.list.push({ name, kind: this.nozzleZones.length > 1 ? 'pellet' : 'filament', nozzle: 210, bed: 60, camera: 0, fan: 50, density: 1.2 });
			this.changed = true;
		},
		restore() {
			this.open = null;
			this.list = JSON.parse(JSON.stringify(MATERIALS_DEF));
			this.changed = true;
		},
		async save() {
			if (!this.canEdit) return;
			this.failure = null;
			this.saving = true;
			try {
				const plan = linkPlan(this.list, this.recipes, this.originals);
				if (plan.clash.length) {
					this.msgKind = 'error';
					this.msg = this.tx('err_recipe_clash', { name: plan.clash[0] });
					return;
				}
				const cfg = await updateCfg({ materials: cleanList(this.list) });
				this.cfg = cfg;
				this.changed = false;
				const said = await this.syncRecipes(plan);
				this.markOriginals();
				this.msgKind = said.failed ? 'warning' : 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.materials.materials_saved') + said.text;
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
		// the recipes follow their materials by name: a renamed material moves its recipe, one taken out takes it (the person is told what moved)
		async syncRecipes(plan) {
			const out = { text: '', failed: false };
			for (const r of plan.rename) {
				try {
					const g = await api('layerrecipes.get', { name: r.from }, { quiet: true });
					await api('layerrecipes.set', { name: r.to, recipe: Object.assign({}, g.recipe, { material: String(r.to).slice(0, 40) }) });
					await api('layerrecipes.remove', { name: r.from });
					out.text += ' ' + this.tx('recipe_renamed', { from: r.from, to: r.to });
				} catch (e) {
					out.failed = true;
					out.text += ' ' + this.tx('recipe_move_failed', { from: r.from, to: r.to, error: (e && e.message) || String(e) });
				}
			}
			for (const name of plan.remove) {
				try {
					await api('layerrecipes.remove', { name });
					out.text += ' ' + this.tx('recipe_removed', { name });
				} catch (e) {
					out.failed = true;
					out.text += ' ' + this.tx('recipe_remove_failed', { name, error: (e && e.message) || String(e) });
				}
			}
			await this.loadLinks();
			return out;
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
			// the state may have changed since the button was tapped (a job started, the machine went busy)
			if (this.heatReason) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.materials.could_not_preheat', { error: this.heatReason });
				return;
			}
			this.cfg = (await readJson(CFG_FILE, {})) || this.cfg; // the staging may have changed in another tab
			const t = this.selectedTool;
			// several zones (pellet): all at the material's temperature
			// pellet zones: the 1st at the material's temperature, the others with their
			// staging (Pellet and zones), never above their cap
			// a zone with its own number in the material takes it (never above its cap); without one: the staging
			const esc = (this.cfg && this.cfg.step) || {};
			const temps = extruderTemps(m, (t.heaters && t.heaters.length ? t.heaters : [null]).map(h => ({ id: h, max: ((this.heaters.find(c => c.id === h) || {}).max) || null })), esc);
			// the tool is NOT selected: only its heaters are set (selecting it would run the tool change macros and move the head)
			const heat = heatZonesCode(t.number, temps);
			if (!heat) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.materials.could_not_preheat', { error: i18n.t('plugins.WorkshopPrinting.materials.nozzle_temperature_missing') });
				return;
			}
			const codes = [heat];
			const bedOwn = this.bedShown(m).filter(z => z.own);
			if (bedOwn.length) this.bedShown(m).forEach(z => codes.push(`M140 P${z.id} S${z.t}`)); // zones with their own number: every zone gets its own set point
			else if (this.bed && m.bed > 0) codes.push(`M140 S${Math.round(m.bed)}`);
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
.details {
	background: rgba(25, 118, 210, 0.05);
	padding: 10px 12px;
}
.zone {
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.field.bad {
	border-color: #e53935;
	color: #e53935;
}
</style>
