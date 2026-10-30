<template>
	<!-- CONFIGURE the pellet extruder (technician). Not a second copy of the drawing: the panel (Operate) is for looking and for
	     running; this is for what is WRITTEN: the zones and their order, the fans, the feeding, the motor and the layout of the panel. -->
	<div>
		<div class="wf-section-head">
			<h3>{{ (currentTool && currentTool.name) || $t('plugins.WorkshopPrinting.pellet.setup_title') }}</h3>
			<span v-if="currentTool" class="wf-pill">T{{ currentTool.number }}</span>
			<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.setup_intro') }}</p>
		</div>
		<v-alert v-if="!isFff" density="compact" variant="tonal" type="info" class="mt-3 mb-0">{{ $t('plugins.WorkshopPrinting.common.the_extruder_only_exists_in_fff') }}</v-alert>
		<template v-else>
			<div v-if="!currentTool" class="text-body-medium text-medium-emphasis mt-3">{{ $t('plugins.WorkshopPrinting.pellet.no_tool_defined') }}</div>
			<template v-else>
				<div class="wf-tabs" role="tablist" :aria-label="$t('plugins.WorkshopPrinting.pellet.sec_zones')">
					<button v-for="s in sectionList" :key="s.id" type="button" role="tab" class="wf-tab" :class="{ on: section === s.id }" :aria-selected="section === s.id" @click="section = s.id">
						<v-icon size="small">{{ s.icon }}</v-icon>{{ s.label }}
					</button>
				</div>
				<error-notice v-if="failure" :error="failure" class="mt-3" />
				<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>

				<!-- ===== Heat zones: order, steps, sensors ===== -->
				<div v-show="section === 'zones'" class="mt-4">
					<div class="wf-section-head">
<v-icon class="pc-ico" size="small">mdi-fire</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.sec_zones') }}</h3>
<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.zones_note') }}</p>
</div>
					<div class="pc-zones">
						<div
							v-for="(z, k) in zones" :key="z.id" class="pc-zone" :class="{ nozzle: k === 0, 'drop-here': dragFrom >= 0 && dragOver === k && dragFrom !== k, dragging: dragFrom === k }" draggable="true"
							@dragstart="dragFrom = k" @dragover.prevent="dragOver = k" @drop.prevent="dropOn(k)" @dragend="dragFrom = -1; dragOver = -1"
						>
							<span class="pc-grip" :title="$t('plugins.WorkshopPrinting.pellet.drag_hint')"><v-icon size="small">mdi-drag</v-icon></span>
							<span class="pc-idx">{{ k + 1 }}</span>
							<div class="pc-zname">
								<b>{{ z.name }}</b>
								<v-chip v-if="k === 0" size="x-small" variant="outlined" class="ml-1">{{ $t('plugins.WorkshopPrinting.pellet.nozzle') }}</v-chip>
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
								<v-btn icon size="x-small" variant="text" :disabled="k === 0 || !canConfig" :title="$t('plugins.WorkshopPrinting.pellet.move_up')" @click="askReorder({ from: k, to: k - 1 })"><v-icon size="small">mdi-arrow-up</v-icon></v-btn>
								<v-btn icon size="x-small" variant="text" :disabled="k === zones.length - 1 || !canConfig" :title="$t('plugins.WorkshopPrinting.pellet.move_down')" @click="askReorder({ from: k, to: k + 1 })"><v-icon size="small">mdi-arrow-down</v-icon></v-btn>
								<v-btn size="x-small" variant="outlined" :disabled="!canConfig" @click="addMonitor(k)"><v-icon size="x-small" start>mdi-shield-plus</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.add_sensor') }}</v-btn>
							</div>
						</div>
					</div>
					<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
						<v-btn size="x-small" variant="outlined" :disabled="!canConfig" :title="$t('plugins.WorkshopPrinting.pellet.add_zone_tip')" @click="addZone()"><v-icon size="x-small" start>mdi-plus</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.add_zone') }}</v-btn>
						<v-btn size="x-small" :color="changed ? 'primary' : ''" :disabled="!changed || !canConfig" :loading="saving" @click="saveStep()">{{ $t('plugins.WorkshopPrinting.pellet.save_steps') }}</v-btn>
						<span class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pellet.preheat_materials_uses_it') }}</span>
					</div>
					<div class="wf-sub">
						<div class="wf-section-head">
<v-icon class="pc-ico" size="small">mdi-tune</v-icon>
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
<v-icon class="pc-ico" size="small">mdi-connection</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.connections_title') }}</h3>
</div>
					<!-- the forms that write modefff.g: output and sensor of each zone, their limits and monitors (free connectors only) -->
					<extruder-config ref="cfg" :tool="currentTool" @msg="(t, m) => { msgKind = t; msg = m; }" @error="e => { failure = e; }" />
					</div>
				</div>

				<!-- ===== Fans ===== -->
				<div v-show="section === 'fans'" class="mt-4">
					<div class="wf-section-head">
<v-icon class="pc-ico" size="small">mdi-fan</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.sec_fans') }}</h3>
<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.fans_note') }}</p>
</div>
					<div class="pc-tiles">
						<div v-for="f in fanRows" :key="f.id" class="pc-tile">
							<div class="pc-tile-t"><b>{{ f.name }}</b><v-chip size="x-small" variant="outlined">{{ f.kindText }}</v-chip></div>
							<div class="pc-tile-m">M106 P{{ f.id }} &middot; {{ Math.round(f.value * 100) }} %</div>
							<div class="pc-bar cool"><i :style="{ width: Math.round(f.value * 100) + '%' }" /></div>
						</div>
						<div v-if="!fanRows.length" class="pc-tile-m">{{ $t('plugins.WorkshopPrinting.pellet.no_fans') }}</div>
					</div>
					<v-btn size="small" variant="outlined" class="mt-3" :disabled="!canConfig" @click="newFan = !newFan"><v-icon size="small" start>mdi-fan-plus</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.add_fan') }}</v-btn>
					<pellet-fan-add v-if="newFan && canConfig" class="mt-3" :tool="currentTool" :busy="busy" :configure="canConfig" :om-fans="model.fans || []" :zones="zones" @saved="reloadPending" @msg="say" />
				</div>

				<!-- ===== Hopper feeding ===== -->
				<div v-show="section === 'feed'" class="mt-4">
					<pellet-feed :config="feedRaw" :tool="currentTool" :busy="busy" :gp-in="gpIn" :gp-out="gpOut" :configure="canConfig" :can-operate="canOperate" @saved="feedSaved" @msg="say" @error="e => { failure = e; }" />
				</div>

				<!-- ===== Motor / extruder ===== -->
				<div v-show="section === 'motor'" class="mt-4">
					<div class="wf-section-head">
<v-icon class="pc-ico" size="small">mdi-engine</v-icon>
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
						<v-btn size="small" variant="outlined" :title="$t('plugins.WorkshopPrinting.pellet.tune_flow_tip')" @click="$emit('goto', { section: 'extruder' })"><v-icon size="small" left>mdi-scale-balance</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.tune_flow') }}</v-btn>
						<v-btn size="small" variant="outlined" @click="$emit('goto', { section: 'pellet' })"><v-icon size="small" left>mdi-engine</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.open_panel') }}</v-btn>
					</div>
				</div>

				<!-- ===== Nozzle change: steps and what to redo with the new diameter ===== -->
				<div v-show="section === 'nozzle'" class="mt-4">
					<nozzle-change :tool="currentTool" :zones="zones" :saved="nozzleSize" :busy="busy" :configure="canConfig" :ext="ext" :extruder="extruderNumber" @saved="v => { nozzleSize = v; }" @goto="g => $emit('goto', g)" />
				</div>

				<!-- ===== How the panel is drawn ===== -->
				<div v-show="section === 'layout'" class="mt-4">
					<div class="wf-section-head">
<v-icon class="pc-ico" size="small">mdi-view-dashboard-outline</v-icon>
<h3>{{ $t('plugins.WorkshopPrinting.pellet.sec_layout') }}</h3>
<p class="wf-lead">{{ $t('plugins.WorkshopPrinting.pellet.layout_what') }}</p>
</div>
					<div class="pc-pick">
						<button type="button" class="pc-pickb" :class="{ on: layout.value === 'vertical' }" :disabled="!canConfig" @click="setLayout('vertical')"><span class="pc-draw"><i style="width:10px;height:26px" /></span>{{ $t('plugins.WorkshopPrinting.pellet.vertical') }}</button>
						<button type="button" class="pc-pickb" :class="{ on: layout.value === 'horizontal' }" :disabled="!canConfig" @click="setLayout('horizontal')"><span class="pc-draw"><i style="width:40px;height:10px" /></span>{{ $t('plugins.WorkshopPrinting.pellet.horizontal') }}</button>
					</div>
				</div>

				<!-- dragging or moving a zone changes which heater is the nozzle: it is explained and confirmed first -->
				<v-dialog :model-value="!!ask" max-width="560" persistent>
					<v-card v-if="ask" class="mt-3">
						<v-card-title class="text-title-medium"><v-icon start color="warning">mdi-alert</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.reorder_title') }}</v-card-title>
						<v-card-text class="text-body-medium">
							<p>{{ $t('plugins.WorkshopPrinting.pellet.reorder_what', { name: ask.name, pos: ask.to + 1 }) }}</p>
							<ol class="mb-2"><li v-for="(n, i) in ask.names" :key="i" :class="{ 'font-weight-bold': i === ask.to }">{{ n }}</li></ol>
							<p v-if="ask.nozzleChanges" class="text-warning">{{ $t('plugins.WorkshopPrinting.pellet.reorder_nozzle', { name: ask.newNozzle }) }}</p>
							<ul>
								<li>{{ $t('plugins.WorkshopPrinting.pellet.reorder_i1') }}</li>
								<li>{{ $t('plugins.WorkshopPrinting.pellet.reorder_i2') }}</li>
								<li>{{ $t('plugins.WorkshopPrinting.pellet.reorder_i3') }}</li>
								<li>{{ $t('plugins.WorkshopPrinting.pellet.reorder_i4') }}</li>
							</ul>
						</v-card-text>
						<v-card-actions>
							<v-spacer />
							<v-btn variant="text" @click="ask = null">{{ $t('plugins.WorkshopPrinting.pellet.reorder_cancel') }}</v-btn>
							<v-btn color="warning" :loading="writing" @click="confirmReorder()">{{ $t('plugins.WorkshopPrinting.pellet.reorder_do') }}</v-btn>
						</v-card-actions>
					</v-card>
				</v-dialog>
			</template>
		</template>
	</div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { CFG_FILE, MODE_FILE, readJson, readText, writeText, updateCfg, note } from './util.js'
import ExtruderConfig from './ExtruderConfig.vue'
import PelletFeed from './PelletFeed.vue'
import Pid from './Pid.vue' // the all-zones PID, mounted here in its zones-only form
import PelletFanAdd from './PelletFanAdd.vue'
import NozzleChange from './NozzleChange.vue'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { NEED } from './print-sections.js'
import { isFriendly } from './print-errors.js'
import { layout, loadLayout, saveLayout } from './pellet-orientation.js'
import { COLORS, zoneState, zoneLabel, moveItem, reorderM563 } from './pellet-hmi.js'
import { useRole } from './use-role.js' // what the role may do (vue/_shared)
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { machineModel, i18n } from './dwc-host.js'

const props = defineProps({
	isFff: { type: Boolean, default: false },
	currentTool: { type: Object, default: null },
	heaters: { type: Array, default: () => [] },
	fans: { type: Array, default: () => [] },
	state: { type: String, default: '' } // machine state, for the PID block
})

const emit = defineEmits(['goto'])

const { atLeast } = useRole()

const cfg = ref(null)

const section = ref('zones')
const step = ref({})
const changed = ref(false)
const saving = ref(false)
const feedRaw = ref(null)
const nozzleSize = ref(0)
const msg = ref(null)
const msgKind = ref('info')
const failure = ref(null)
const ask = ref(null)
const writing = ref(false)
const dragFrom = ref(-1)
const dragOver = ref(-1)
const newFan = ref(false)

const canOperate = computed(() => {
	return atLeast(NEED.operate);
})

// this view writes the configuration: only a technician (Print.vue mounts it only for that role, and each action checks it again)
const canConfig = computed(() => {
	return atLeast(NEED.configure);
})

const model = computed(() => {
	return machineModel();
})

const zones = computed(() => {
	const t = props.currentTool;
	return t ? props.heaters.filter(h => h.tool === t.number).sort((a, b) => a.zone - b.zone) : [];
})

const busy = computed(() => {
	const st = model.value.state && model.value.state.status;
	return ['processing', 'paused', 'pausing', 'resuming', 'simulating'].includes(st);
})

const gpIn = computed(() => {
	return (model.value.sensors && model.value.sensors.gpIn) || [];
})

const gpOut = computed(() => {
	return (model.value.state && model.value.state.gpOut) || [];
})

const extruderNumber = computed(() => {
	const t = props.currentTool;
	return t && t.extruders && t.extruders.length ? t.extruders[0] : 0;
})

const ext = computed(() => {
	const ex = (model.value.move && model.value.move.extruders) || [];
	return ex[extruderNumber.value] || null;
})

// every fan of the board with the role it plays for this extruder
const fanRows = computed(() => {
	const mine = (props.currentTool && props.currentTool.fans) || [];
	return props.fans.map(f => Object.assign({}, f, {
		kindColor: mine.includes(f.id) ? 'info' : f.thermostatic ? 'deep-orange' : 'grey',
		kindText: mine.includes(f.id) ? i18n.t('plugins.WorkshopPrinting.pellet.newfan_part') : f.thermostatic ? i18n.t('plugins.WorkshopPrinting.pellet.newfan_throat') : i18n.t('plugins.WorkshopPrinting.pellet.fan_other')
	}));
})

onMounted(async () => {
	const cfg = (await readJson(CFG_FILE, {})) || {};
	step.value = Object.assign({}, cfg.step || {});
	feedRaw.value = cfg.feed || null;
	nozzleSize.value = Number(cfg.nozzleSize) > 0 ? Number(cfg.nozzleSize) : 0;
	loadLayout();
})

const sectionList = computed(() => {
	const t = k => i18n.t('plugins.WorkshopPrinting.' + k)
	return [
		{ id: 'zones', icon: 'mdi-fire', color: '#F57C00', label: t('pellet.sec_zones') },
		{ id: 'fans', icon: 'mdi-fan', color: '#00ACC1', label: t('pellet.sec_fans') },
		{ id: 'feed', icon: 'mdi-grain', color: '#7CB342', label: t('pellet.sec_feed') },
		{ id: 'motor', icon: 'mdi-engine', color: '#7E57C2', label: t('pellet.sec_motor') },
		{ id: 'nozzle', icon: 'mdi-nut', color: '#26A69A', label: t('nozzle.sec_nozzle') },
		{ id: 'layout', icon: 'mdi-view-dashboard-outline', color: '#5C6BC0', label: t('pellet.sec_layout') }
	]
})
// where a temperature falls on the bar of its zone (0 to its limit)
function barPct(v, z) {
	return Math.max(0, Math.min(100, ((Number(v) || 0) / (z.max || 300)) * 100))
}
function color(z) {
	return COLORS[zoneState(z)];
}

function label(z) {
	return zoneLabel(z, (k) => i18n.t(k));
}

function say(m) {
	failure.value = null;
	msgKind.value = m.kind;
	msg.value = m.text;
}

function fail(e, text) {
	if (isFriendly(e)) failure.value = e;
	else {
		msgKind.value = 'error';
		msg.value = text + (e.message || e);
	}
}

// the configuration was written: the board has to reload the FFF mode to use it
async function reloadPending() {
	const c = cfg.value;
	if (c) { await c.read(); c.reloadPending = true; }
}

async function feedSaved(next) {
	feedRaw.value = next;
	await reloadPending();
}

// "+ Zone" and "+ Sensor": the forms of the extruder configuration below (free connectors, M950 / M308 / M307)
function showConfig(text) {
	msgKind.value = 'info';
	msg.value = text;
	nextTick(() => { const c = cfg.value; if (c && c.$el && c.$el.scrollIntoView) c.$el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

function addZone() {
	const c = cfg.value;
	if (!c || !canConfig.value) return;
	c.addZone();
	showConfig(i18n.t('plugins.WorkshopPrinting.pellet.add_zone_hint'));
}

function addMonitor(k) {
	const c = cfg.value;
	const z = c && c.zones && c.zones[k];
	if (!canConfig.value) return;
	if (!z) {
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.pellet.add_sensor_none');
		return;
	}
	c.addMonitor(z);
	showConfig(i18n.t('plugins.WorkshopPrinting.pellet.add_sensor_hint'));
}

async function setLayout(v) {
	if (!canConfig.value) return;
	failure.value = null;
	try {
		await saveLayout(v);
	} catch (e) {
		fail(e, i18n.t('plugins.WorkshopPrinting.common.could_not_save'));
	}
}

function dropOn(k) {
	const from = dragFrom.value;
	dragFrom.value = -1;
	dragOver.value = -1;
	if (from >= 0 && from !== k) askReorder({ from, to: k });
}

// a zone moved: explain what it changes before touching modefff.g
function askReorder({ from, to }) {
	if (!canConfig.value) return;
	if (busy.value) {
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy');
		return;
	}
	const order = moveItem(zones.value.map(z => z.id), from, to);
	const nameOf = id => { const z = zones.value.find(x => x.id === id); const k = zones.value.indexOf(z); return (k === 0 ? i18n.t('plugins.WorkshopPrinting.common.zone_1_nozzle') : i18n.t('plugins.WorkshopPrinting.common.zone') + (k + 1)) + ' · H' + id; };
	const names = order.map((id, i) => (i === 0 ? i18n.t('plugins.WorkshopPrinting.common.zone_1_nozzle') : i18n.t('plugins.WorkshopPrinting.common.zone') + (i + 1)) + ' → H' + id);
	ask.value = { from, to, order, names, name: nameOf(zones.value[from].id), nozzleChanges: order[0] !== zones.value[0].id, newNozzle: 'H' + order[0] };
}

async function confirmReorder() {
	const a = ask.value;
	if (!a || busy.value || !canConfig.value) return;
	failure.value = null;
	writing.value = true;
	try {
		const current = await readText(MODE_FILE);
		const r = reorderM563(current, props.currentTool.number, a.order);
		if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_err_' + r.error));
		const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
		await writeText(MODE_FILE + '.bak-' + stamp, current);
		await writeText(MODE_FILE, r.text);
		note(sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.reorder_log', { order: a.order.map(h => 'H' + h).join(':') }));
		msgKind.value = 'success';
		msg.value = i18n.t('plugins.WorkshopPrinting.pellet.reorder_saved', { stamp });
		ask.value = null;
		await reloadPending();
	} catch (e) {
		fail(e, i18n.t('plugins.WorkshopPrinting.pellet.reorder_not_saved', { error: '' }));
		ask.value = null;
	} finally {
		writing.value = false;
	}
}

async function saveStep() {
	if (!canConfig.value) return;
	failure.value = null;
	saving.value = true;
	try {
		const clean = {};
		Object.keys(step.value).forEach(k => { const v = Number(step.value[k]); if (isFinite(v) && v !== 0) clean[k] = Math.max(-150, Math.min(0, v)); });
		await updateCfg({ step: clean });
		step.value = clean;
		changed.value = false;
		note(sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.log_steps', { list: Object.keys(clean).map(k => 'H' + k + ' ' + clean[k] + ' °C').join(', ') || i18n.t('plugins.WorkshopPrinting.pellet.no_steps') }));
		msgKind.value = 'success';
		msg.value = i18n.t('plugins.WorkshopPrinting.pellet.steps_saved_preheat_materials_uses_them');
	} catch (e) {
		fail(e, i18n.t('plugins.WorkshopPrinting.common.could_not_save'));
	} finally {
		saving.value = false;
	}
}
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
