<template>
	<!-- CONFIGURE the pellet extruder (technician). Not a second copy of the drawing: the panel (Operate) is for looking and for
	     running; this is for what is WRITTEN: the zones and their order, the fans, the feeding, the motor and the layout of the panel. -->
	<div>
		<div class="wf-section-head">
			<h3>{{ (currentTool && currentTool.name) || $t('plugins.WorkshopPrinting.pellet.setup_title') }}</h3>
			<span v-if="currentTool" class="wf-pill">T{{ currentTool.number }}</span>
			<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.setup_intro') }}</p>
		</div>
		<v-alert v-if="!isFff" dense text type="info" class="mt-3 mb-0">{{ $t('plugins.WorkshopPrinting.common.the_extruder_only_exists_in_fff') }}</v-alert>
		<template v-else>
			<div v-if="!currentTool" class="text-body-2 grey--text mt-3">{{ $t('plugins.WorkshopPrinting.pellet.no_tool_defined') }}</div>
			<template v-else>
				<div class="wf-tabs" role="tablist" :aria-label="$t('plugins.WorkshopPrinting.pellet.sec_zones')">
					<button v-for="s in sectionList" :key="s.id" type="button" role="tab" class="wf-tab" :class="{ on: section === s.id }" :aria-selected="section === s.id" @click="section = s.id">
						<v-icon small>{{ s.icon }}</v-icon>{{ s.label }}
					</button>
				</div>
				<error-notice v-if="failure" :error="failure" class="mt-3" />
				<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>

				<!-- ===== Heat zones: order, steps, sensors ===== -->
				<div v-show="section === 'zones'" class="mt-4">
					<div class="wf-section-head">
<v-icon class="pc-ico" small>mdi-fire</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.sec_zones') }}</h3>
<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.zones_note') }}</p>
</div>
					<div class="pc-zones">
						<div
							v-for="(z, k) in zones" :key="z.id" class="pc-zone" :class="{ nozzle: k === 0, 'drop-here': dragFrom >= 0 && dragOver === k && dragFrom !== k, dragging: dragFrom === k }" draggable="true"
							@dragstart="dragFrom = k" @dragover.prevent="dragOver = k" @drop.prevent="dropOn(k)" @dragend="dragFrom = -1; dragOver = -1"
						>
							<span class="pc-grip" :title="$t('plugins.WorkshopPrinting.pellet.drag_hint')"><v-icon small>mdi-drag</v-icon></span>
							<span class="pc-idx">{{ k + 1 }}</span>
							<div class="pc-zname">
								<b>{{ z.name }}</b>
								<v-chip v-if="k === 0" x-small outlined class="ml-1">{{ $t('plugins.WorkshopPrinting.pellet.nozzle') }}</v-chip>
								<div class="pc-zsub">H{{ z.id }} &middot; {{ z.sensorName || ('S' + z.sensor) }}</div>
							</div>
							<div class="pc-temp">
								<div class="pc-nums">
									<span class="pc-now">{{ z.sensorBad ? '--' : Math.round(z.current) }} &deg;C</span>
									<span class="pc-tgt">{{ $t('plugins.WorkshopPrinting.pellet.target_now', { t: z.target > 0 ? Math.round(z.target) : '--' }) }}</span>
								</div>
								<div class="pc-bar"><i :style="{ width: barPct(z.current, z) + '%' }" /><b v-if="z.target > 0" :style="{ left: barPct(z.target, z) + '%' }" /></div>
								<div class="pc-lim">
									<span>{{ $t('plugins.WorkshopPrinting.pellet.col_limit') }} {{ z.max }} &deg;C</span>
									<span v-if="k > 0">{{ $t('plugins.WorkshopPrinting.pellet.col_step') }} <input v-model.number="step[z.id]" type="number" step="5" class="field" :disabled="!canConfig" @change="changed = true" /> &deg;C</span>
									<span class="pc-state"><span class="pc-dot" :style="{ background: color(z) }" />{{ label(z) }}</span>
								</div>
							</div>
							<div class="pc-act">
								<v-btn icon x-small :disabled="k === 0 || !canConfig" :title="$t('plugins.WorkshopPrinting.pellet.move_up')" @click="askReorder({ from: k, to: k - 1 })"><v-icon small>mdi-arrow-up</v-icon></v-btn>
								<v-btn icon x-small :disabled="k === zones.length - 1 || !canConfig" :title="$t('plugins.WorkshopPrinting.pellet.move_down')" @click="askReorder({ from: k, to: k + 1 })"><v-icon small>mdi-arrow-down</v-icon></v-btn>
								<v-btn x-small outlined :disabled="!canConfig" @click="addMonitor(k)"><v-icon x-small left>mdi-shield-plus</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.add_sensor') }}</v-btn>
							</div>
						</div>
					</div>
					<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
						<v-btn x-small outlined :disabled="!canConfig" :title="$t('plugins.WorkshopPrinting.pellet.add_zone_tip')" @click="addZone()"><v-icon x-small left>mdi-plus</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.add_zone') }}</v-btn>
						<v-btn x-small :color="changed ? 'primary' : ''" :disabled="!changed || !canConfig" :loading="saving" @click="saveStep()">{{ $t('plugins.WorkshopPrinting.pellet.save_steps') }}</v-btn>
						<span class="text-caption grey--text">{{ $t('plugins.WorkshopPrinting.pellet.preheat_materials_uses_it') }}</span>
					</div>
					<div class="wf-sub">
						<div class="wf-section-head">
<v-icon class="pc-ico" small>mdi-tune</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.coupled_pid_title') }}</h3>
</div>
						<details class="wf-more">
							<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
							<p>{{ $t('plugins.WorkshopPrinting.pellet.coupled_pid_note') }}</p>
						</details>
						<pid v-if="section === 'zones'" zones-only :is-fff="isFff" :heaters="heaters" :tool="currentTool" :state="state" />
					</div>
					<div class="wf-sub">
						<div class="wf-section-head">
<v-icon class="pc-ico" small>mdi-connection</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.connections_title') }}</h3>
</div>
					<!-- the forms that write modefff.g: output and sensor of each zone, their limits and monitors (free connectors only) -->
					<extruder-config ref="cfg" :tool="currentTool" @msg="(t, m) => { msgKind = t; msg = m; }" @error="e => { failure = e; }" />
					</div>
				</div>

				<!-- ===== Fans ===== -->
				<div v-show="section === 'fans'" class="mt-4">
					<div class="wf-section-head">
<v-icon class="pc-ico" small>mdi-fan</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.sec_fans') }}</h3>
<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.fans_note') }}</p>
</div>
					<div class="pc-tiles">
						<div v-for="f in fanRows" :key="f.id" class="pc-tile">
							<div class="pc-tile-t"><b>{{ f.name }}</b><v-chip x-small outlined>{{ f.kindText }}</v-chip></div>
							<div class="pc-tile-m">M106 P{{ f.id }} &middot; {{ Math.round(f.value * 100) }} %</div>
							<div class="pc-bar cool"><i :style="{ width: Math.round(f.value * 100) + '%' }" /></div>
						</div>
						<div v-if="!fanRows.length" class="pc-tile-m">{{ $t('plugins.WorkshopPrinting.pellet.no_fans') }}</div>
					</div>
					<v-btn small outlined class="mt-3" :disabled="!canConfig" @click="newFan = !newFan"><v-icon small left>mdi-fan-plus</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.add_fan') }}</v-btn>
					<pellet-fan-add v-if="newFan && canConfig" class="mt-3" :tool="currentTool" :busy="busy" :configure="canConfig" :om-fans="model.fans || []" :zones="zones" @saved="reloadPending" @msg="say" />
				</div>

				<!-- ===== Hopper feeding ===== -->
				<div v-show="section === 'feed'" class="mt-4">
					<pellet-feed :config="feedRaw" :tool="currentTool" :busy="busy" :gp-in="gpIn" :gp-out="gpOut" :configure="canConfig" :can-operate="canOperate" @saved="feedSaved" @msg="say" @error="e => { failure = e; }" />
				</div>

				<!-- ===== Motor / extruder ===== -->
				<div v-show="section === 'motor'" class="mt-4">
					<div class="wf-section-head">
<v-icon class="pc-ico" small>mdi-engine</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.motor_title', { n: extruderNumber }) }}</h3>
<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.motor_setup_note') }}</p>
</div>
					<div v-if="ext" class="pc-specs">
						<div><div class="k">{{ $t('plugins.WorkshopPrinting.pellet.spec_steps') }}</div><div class="v">{{ ext.stepsPerMm }}</div></div>
						<div><div class="k">{{ $t('plugins.WorkshopPrinting.pellet.spec_micro') }}</div><div class="v">{{ ext.microstepping ? ext.microstepping.value : '?' }}</div></div>
						<div><div class="k">{{ $t('plugins.WorkshopPrinting.pellet.spec_vmax') }}</div><div class="v">{{ Math.round(ext.speed / 60) }} mm/s</div></div>
						<div><div class="k">{{ $t('plugins.WorkshopPrinting.pellet.spec_acc') }}</div><div class="v">{{ ext.acceleration }} mm/s&sup2;</div></div>
						<div><div class="k">{{ $t('plugins.WorkshopPrinting.pellet.spec_jerk') }}</div><div class="v">{{ ext.jerk }} mm/min</div></div>
					</div>
					<div v-if="ext" class="pc-tile-m mt-3">{{ $t('plugins.WorkshopPrinting.pellet.motor_runtime_values', { flow: Math.round((ext.factor || 1) * 100), pa: ext.pressureAdvance || 0 }) }}</div>
					<div class="d-flex flex-wrap mt-3" style="gap:8px">
						<v-btn small outlined :title="$t('plugins.WorkshopPrinting.pellet.tune_flow_tip')" @click="$emit('goto', { section: 'extruder' })"><v-icon small left>mdi-scale-balance</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.tune_flow') }}</v-btn>
						<v-btn small outlined @click="$emit('goto', { section: 'pellet' })"><v-icon small left>mdi-engine</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.open_panel') }}</v-btn>
					</div>
				</div>

				<!-- ===== Nozzle change: steps and what to redo with the new diameter ===== -->
				<div v-show="section === 'nozzle'" class="mt-4">
					<nozzle-change :tool="currentTool" :zones="zones" :saved="nozzleSize" :busy="busy" :configure="canConfig" :ext="ext" :extruder="extruderNumber" @saved="v => { nozzleSize = v; }" @goto="g => $emit('goto', g)" />
				</div>

				<!-- ===== How the panel is drawn ===== -->
				<div v-show="section === 'layout'" class="mt-4">
					<div class="wf-section-head">
<v-icon class="pc-ico" small>mdi-view-dashboard-outline</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.sec_layout') }}</h3>
<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.layout_what') }}</p>
</div>
					<div class="pc-pick">
						<button type="button" class="pc-pickb" :class="{ on: layout.value === 'vertical' }" :disabled="!canConfig" @click="setLayout('vertical')"><span class="pc-draw"><i style="width:10px;height:26px" /></span>{{ $t('plugins.WorkshopPrinting.pellet.vertical') }}</button>
						<button type="button" class="pc-pickb" :class="{ on: layout.value === 'horizontal' }" :disabled="!canConfig" @click="setLayout('horizontal')"><span class="pc-draw"><i style="width:40px;height:10px" /></span>{{ $t('plugins.WorkshopPrinting.pellet.horizontal') }}</button>
					</div>
				</div>

				<!-- dragging or moving a zone changes which heater is the nozzle: it is explained and confirmed first -->
				<v-dialog :value="!!ask" max-width="560" persistent>
					<v-card v-if="ask" class="mt-3">
						<v-card-title class="text-subtitle-1"><v-icon left color="warning">mdi-alert</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.reorder_title') }}</v-card-title>
						<v-card-text class="text-body-2">
							<p>{{ $t('plugins.WorkshopPrinting.pellet.reorder_what', { name: ask.name, pos: ask.to + 1 }) }}</p>
							<ol class="mb-2"><li v-for="(n, i) in ask.names" :key="i" :class="{ 'font-weight-bold': i === ask.to }">{{ n }}</li></ol>
							<p v-if="ask.nozzleChanges" class="warning--text">{{ $t('plugins.WorkshopPrinting.pellet.reorder_nozzle', { name: ask.newNozzle }) }}</p>
							<ul>
								<li>{{ $t('plugins.WorkshopPrinting.pellet.reorder_i1') }}</li>
								<li>{{ $t('plugins.WorkshopPrinting.pellet.reorder_i2') }}</li>
								<li>{{ $t('plugins.WorkshopPrinting.pellet.reorder_i3') }}</li>
								<li>{{ $t('plugins.WorkshopPrinting.pellet.reorder_i4') }}</li>
							</ul>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn text @click="ask = null">{{ $t('plugins.WorkshopPrinting.pellet.reorder_cancel') }}</v-btn>
							<v-btn color="warning" :loading="writing" @click="confirmReorder()">{{ $t('plugins.WorkshopPrinting.pellet.reorder_do') }}</v-btn>
						</v-card-actions>
					</v-card>
				</v-dialog>
			</template>
		</template>
	</div>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import { CFG_FILE, MODE_FILE, readJson, readText, writeText, updateCfg, note } from './util.js'
import ExtruderConfig from './ExtruderConfig.vue'
import PelletFeed from './PelletFeed.vue'
import Pid from './Pid.vue' // the all-zones PID, mounted here in its zones-only form
import PelletFanAdd from './PelletFanAdd.vue'
import NozzleChange from './NozzleChange.vue'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { roleMixin } from './role-mixin.js' // what the role sees and may do (vue/_shared)
import { NEED } from './print-sections.js'
import { isFriendly } from './print-errors.js'
import { layout, loadLayout, saveLayout } from './pellet-orientation.js'
import { COLORS, zoneState, zoneLabel, moveItem, reorderM563 } from './pellet-hmi.js'

export default {
	mixins: [roleMixin],
	components: { ExtruderConfig, PelletFeed, PelletFanAdd, NozzleChange, ErrorNotice, Pid },
	props: {
		isFff: { type: Boolean, default: false },
		currentTool: { type: Object, default: null },
		heaters: { type: Array, default: () => [] },
		fans: { type: Array, default: () => [] },
		state: { type: String, default: '' } // machine state, for the PID block
	},
	data() {
		return {
			section: 'zones', step: {}, changed: false, saving: false, feedRaw: null, nozzleSize: 0,
			msg: null, msgKind: 'info', failure: null, ask: null, writing: false,
			dragFrom: -1, dragOver: -1, newFan: false
		};
	},
	computed: {
		// the sections of the strip (the toggle it replaces had the same six): id, icon and name
		sectionList() {
			const t = k => this.$t('plugins.WorkshopPrinting.' + k);
			return [
				{ id: 'zones', icon: 'mdi-fire', color: '#F57C00', label: t('pellet.sec_zones') },
				{ id: 'fans', icon: 'mdi-fan', color: '#00ACC1', label: t('pellet.sec_fans') },
				{ id: 'feed', icon: 'mdi-grain', color: '#7CB342', label: t('pellet.sec_feed') },
				{ id: 'motor', icon: 'mdi-engine', color: '#7E57C2', label: t('pellet.sec_motor') },
				{ id: 'nozzle', icon: 'mdi-nut', color: '#26A69A', label: t('nozzle.sec_nozzle') },
				{ id: 'layout', icon: 'mdi-view-dashboard-outline', color: '#5C6BC0', label: t('pellet.sec_layout') }
			];
		},
		layout() {
			return layout;
		},
		canOperate() {
			return this.atLeast(NEED.operate);
		},
		// this view writes the configuration: only a technician (Print.vue mounts it only for that role, and each action checks it again)
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
		busy() {
			const st = this.model.state && this.model.state.status;
			return ['processing', 'paused', 'pausing', 'resuming', 'simulating'].includes(st);
		},
		gpIn() {
			return (this.model.sensors && this.model.sensors.gpIn) || [];
		},
		gpOut() {
			return (this.model.state && this.model.state.gpOut) || [];
		},
		extruderNumber() {
			const t = this.currentTool;
			return t && t.extruders && t.extruders.length ? t.extruders[0] : 0;
		},
		ext() {
			const ex = (this.model.move && this.model.move.extruders) || [];
			return ex[this.extruderNumber] || null;
		},
		// every fan of the board with the role it plays for this extruder
		fanRows() {
			const mine = (this.currentTool && this.currentTool.fans) || [];
			return this.fans.map(f => Object.assign({}, f, {
				kindColor: mine.includes(f.id) ? 'info' : f.thermostatic ? 'deep-orange' : 'grey',
				kindText: mine.includes(f.id) ? i18n.t('plugins.WorkshopPrinting.pellet.newfan_part') : f.thermostatic ? i18n.t('plugins.WorkshopPrinting.pellet.newfan_throat') : i18n.t('plugins.WorkshopPrinting.pellet.fan_other')
			}));
		}
	},
	async mounted() {
		const cfg = (await readJson(CFG_FILE, {})) || {};
		this.step = Object.assign({}, cfg.step || {});
		this.feedRaw = cfg.feed || null;
		this.nozzleSize = Number(cfg.nozzleSize) > 0 ? Number(cfg.nozzleSize) : 0;
		loadLayout();
	},
	methods: {
		// where a temperature falls on the bar of its zone (0 to its limit)
		barPct(v, z) {
			return Math.max(0, Math.min(100, ((Number(v) || 0) / (z.max || 300)) * 100));
		},
		...mapActions('machine', ['sendCode']),
		color(z) {
			return COLORS[zoneState(z)];
		},
		label(z) {
			return zoneLabel(z, (k) => i18n.t(k));
		},
		say(m) {
			this.failure = null;
			this.msgKind = m.kind;
			this.msg = m.text;
		},
		fail(e, text) {
			if (isFriendly(e)) this.failure = e;
			else {
				this.msgKind = 'error';
				this.msg = text + (e.message || e);
			}
		},
		// the configuration was written: the board has to reload the FFF mode to use it
		async reloadPending() {
			const c = this.$refs.cfg;
			if (c) { await c.read(); c.reloadPending = true; }
		},
		async feedSaved(next) {
			this.feedRaw = next;
			await this.reloadPending();
		},
		// "+ Zone" and "+ Sensor": the forms of the extruder configuration below (free connectors, M950 / M308 / M307)
		showConfig(text) {
			this.msgKind = 'info';
			this.msg = text;
			this.$nextTick(() => { const c = this.$refs.cfg; if (c && c.$el && c.$el.scrollIntoView) c.$el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
		},
		addZone() {
			const c = this.$refs.cfg;
			if (!c || !this.canConfig) return;
			c.addZone();
			this.showConfig(i18n.t('plugins.WorkshopPrinting.pellet.add_zone_hint'));
		},
		addMonitor(k) {
			const c = this.$refs.cfg;
			const z = c && c.zones && c.zones[k];
			if (!this.canConfig) return;
			if (!z) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.pellet.add_sensor_none');
				return;
			}
			c.addMonitor(z);
			this.showConfig(i18n.t('plugins.WorkshopPrinting.pellet.add_sensor_hint'));
		},
		async setLayout(v) {
			if (!this.canConfig) return;
			this.failure = null;
			try {
				await saveLayout(v);
			} catch (e) {
				this.fail(e, i18n.t('plugins.WorkshopPrinting.common.could_not_save'));
			}
		},
		dropOn(k) {
			const from = this.dragFrom;
			this.dragFrom = -1;
			this.dragOver = -1;
			if (from >= 0 && from !== k) this.askReorder({ from, to: k });
		},
		// a zone moved: explain what it changes before touching modefff.g
		askReorder({ from, to }) {
			if (!this.canConfig) return;
			if (this.busy) {
				this.msgKind = 'error';
				this.msg = i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy');
				return;
			}
			const order = moveItem(this.zones.map(z => z.id), from, to);
			const nameOf = id => { const z = this.zones.find(x => x.id === id); const k = this.zones.indexOf(z); return (k === 0 ? i18n.t('plugins.WorkshopPrinting.common.zone_1_nozzle') : i18n.t('plugins.WorkshopPrinting.common.zone') + (k + 1)) + ' · H' + id; };
			const names = order.map((id, i) => (i === 0 ? i18n.t('plugins.WorkshopPrinting.common.zone_1_nozzle') : i18n.t('plugins.WorkshopPrinting.common.zone') + (i + 1)) + ' → H' + id);
			this.ask = { from, to, order, names, name: nameOf(this.zones[from].id), nozzleChanges: order[0] !== this.zones[0].id, newNozzle: 'H' + order[0] };
		},
		async confirmReorder() {
			const a = this.ask;
			if (!a || this.busy || !this.canConfig) return;
			this.failure = null;
			this.writing = true;
			try {
				const current = await readText(MODE_FILE);
				const r = reorderM563(current, this.currentTool.number, a.order);
				if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_err_' + r.error));
				const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
				await writeText(MODE_FILE + '.bak-' + stamp, current);
				await writeText(MODE_FILE, r.text);
				note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.reorder_log', { order: a.order.map(h => 'H' + h).join(':') }));
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.pellet.reorder_saved', { stamp });
				this.ask = null;
				await this.reloadPending();
			} catch (e) {
				this.fail(e, i18n.t('plugins.WorkshopPrinting.pellet.reorder_not_saved', { error: '' }));
				this.ask = null;
			} finally {
				this.writing = false;
			}
		},
		async saveStep() {
			if (!this.canConfig) return;
			this.failure = null;
			this.saving = true;
			try {
				const clean = {};
				Object.keys(this.step).forEach(k => { const v = Number(this.step[k]); if (isFinite(v) && v !== 0) clean[k] = Math.max(-150, Math.min(0, v)); });
				await updateCfg({ step: clean });
				this.step = clean;
				this.changed = false;
				note(this.sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.log_steps', { list: Object.keys(clean).map(k => 'H' + k + ' ' + clean[k] + ' °C').join(', ') || i18n.t('plugins.WorkshopPrinting.pellet.no_steps') }));
				this.msgKind = 'success';
				this.msg = i18n.t('plugins.WorkshopPrinting.pellet.steps_saved_preheat_materials_uses_them');
			} catch (e) {
				this.fail(e, i18n.t('plugins.WorkshopPrinting.common.could_not_save'));
			} finally {
				this.saving = false;
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
.nowrap {
	white-space: nowrap;
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
