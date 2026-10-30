<template>
	<pc-section icon="mdi-grain" :title="$t('plugins.WorkshopPrinting.printing.pellet_panel')">
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>
			{{ $t('plugins.WorkshopPrinting.pellet.intro_1') }} <b>{{ $t('plugins.WorkshopPrinting.pellet.intro_pellet_extruder') }}</b>{{ $t('plugins.WorkshopPrinting.pellet.intro_2') }} <b>{{ $t('plugins.WorkshopPrinting.pellet.intro_several_zones') }}</b> {{ $t('plugins.WorkshopPrinting.pellet.intro_3') }} <b>{{ $t('plugins.WorkshopPrinting.pellet.intro_steps') }}</b>{{ $t('plugins.WorkshopPrinting.pellet.intro_4') }}
			</p>
		</details>
		<v-alert v-if="!isFff" density="compact" variant="tonal" type="info" class="mt-3 mb-0">{{ $t('plugins.WorkshopPrinting.common.the_extruder_only_exists_in_fff') }}</v-alert>
		<template v-else>
			<div v-if="!currentTool" class="text-body-medium text-medium-emphasis mt-3">{{ $t('plugins.WorkshopPrinting.pellet.no_tool_defined') }}</div>
			<template v-else>
				<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopPrinting.pellet.extruder_tap_a_zone', { name: currentTool.name || ('T' + currentTool.number) }) }}</div>
				<v-row density="compact">
					<v-col cols="12" lg="7">
						<pellet-hmi :zones="zones" :fans-throat="fansThroat" :fans-tool="fansTool" :motor="motorHmi" :selected="pick" :orientation="layout.value" :feed="feedHmi" @select="select" />
					</v-col>
					<v-col cols="12" lg="5">
						<v-card v-if="pick.type === 'zone' && zoneSel" variant="outlined" class="pa-3">
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								<span class="text-title-medium">{{ sel === 0 ? $t('plugins.WorkshopPrinting.common.zone_1_nozzle') : $t('plugins.WorkshopPrinting.pellet.zone_n', { n: sel + 1 }) }}</span>
								<v-chip variant="outlined" size="x-small" :color="colorZone(zoneSel)">{{ stateZone(zoneSel) }}</v-chip>
								<v-spacer />
								<span class="text-medium-emphasis text-body-small">{{ $t('plugins.WorkshopPrinting.pellet.heater_h_sensor', { h: zoneSel.id, sensor: zoneSel.sensorName || ('S' + zoneSel.sensor) }) }}</span>
							</div>
							<div class="text-headline-medium my-1">{{ zoneSel.sensorBad ? '--' : Math.round(zoneSel.current) }} °C</div>
							<div class="text-body-medium">
								{{ $t('plugins.WorkshopPrinting.common.target') }} <b>{{ zoneSel.target > 0 ? Math.round(zoneSel.target) + ' °C' : $t('plugins.WorkshopPrinting.pellet.off') }}</b>
								<span class="text-medium-emphasis ml-2">{{ $t('plugins.WorkshopPrinting.pellet.limit_c', { max: zoneSel.max }) }}</span>
							</div>
							<div v-if="zoneSel.sensorBad || zoneSel.state === 'fault'" class="text-body-small text-error mt-1">
								{{ zoneSel.explanation || $t('plugins.WorkshopPrinting.pellet.the_zone_is_in_fault_check') }}
							</div>
							<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
								<input v-model.number="tempNew" type="number" step="5" min="0" :max="zoneSel.max" class="field" /> °C
								<!-- calentar = nivel 2 (DESIGN.md 5): doble toque ambar -->
								<v-btn size="small" :color="armed === 'heat' ? 'amber-darken-3' : 'primary'" :disabled="!canHeat || !canOperate" @click="arm('heat', heatZone)">
									<v-icon size="small" start>mdi-fire</v-icon>{{ armed === 'heat' ? $t('plugins.WorkshopPrinting.pellet.tap_again_heats_to', { c: tempNew }) : $t('plugins.WorkshopPrinting.pellet.heat_this_zone') }}
								</v-btn>
								<v-btn size="small" variant="outlined" :disabled="!(zoneSel.target > 0) || !canOperate" @click="powerOffZone()"><v-icon size="small" start>mdi-snowflake</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.turn_zone_off') }}</v-btn>
							</div>
							<div v-if="reasonNo" class="text-body-small text-medium-emphasis mt-1">{{ reasonNo }}</div>
							<v-divider class="my-3" />
							<div class="text-body-medium">
								<template v-if="sel === 0">
									{{ $t('plugins.WorkshopPrinting.pellet.the_nozzle_goes_to_the_material') }}
								</template>
								<template v-else>
									{{ $t('plugins.WorkshopPrinting.pellet.step_readonly', { c: step[zoneSel.id] || 0 }) }}
								</template>
							</div>
							<div v-if="canConfig" class="d-flex flex-wrap mt-3" style="gap:8px">
								<v-btn size="x-small" variant="outlined" :title="$t('plugins.WorkshopPrinting.pellet.tune_pid_tip')" @click="$emit('goto', { section: 'pid', heater: zoneSel.id })"><v-icon size="x-small" start>mdi-tune</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.tune_pid') }}</v-btn>
							</div>
						</v-card>
						<!-- fan: speed (set by hand) or trigger temperatures (thermostatic) -->
						<v-card v-else-if="pick.type === 'fan' && fanSel" variant="outlined" class="pa-3">
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								<v-icon size="small">mdi-fan</v-icon>
								<span class="text-title-medium">{{ fanSel.name }}</span>
								<v-chip size="x-small" variant="outlined">{{ fanSel.thermostatic ? $t('plugins.WorkshopPrinting.pellet.fan_auto') : $t('plugins.WorkshopPrinting.pellet.fan_manual') }}</v-chip>
								<v-spacer />
								<span class="text-medium-emphasis text-body-small">M106 P{{ fanSel.id }}<template v-if="fanSel.rpm > 0"> · {{ fanSel.rpm }} rpm</template></span>
							</div>
							<div class="text-headline-medium my-1">{{ Math.round(fanSel.value * 100) }} %</div>
							<div v-if="fanSel.state === 'ordered'" class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pellet.fan_no_tach_note') }}</div>
							<div v-else-if="fanSel.state === 'stalled'" class="text-body-small text-error">{{ $t('plugins.WorkshopPrinting.pellet.fan_stalled_note') }}</div>
							<template v-if="!fanSel.thermostatic">
								<v-slider v-model="fanNew" :min="0" :max="100" step="5" density="compact" hide-details thumb-label :disabled="!canOperate" @end="setFan()" />
								<div class="d-flex flex-wrap mt-2" style="gap:6px">
									<v-btn size="x-small" variant="outlined" :disabled="!canOperate" @click="fanNew = 0; setFan()">{{ $t('plugins.WorkshopPrinting.pellet.fan_off') }}</v-btn>
									<v-btn size="x-small" variant="outlined" :disabled="!canOperate" @click="fanNew = 50; setFan()">50 %</v-btn>
									<v-btn size="x-small" variant="outlined" :disabled="!canOperate" @click="fanNew = 100; setFan()">100 %</v-btn>
								</div>
								<div class="text-body-small text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.pellet.fan_runtime_note') }}</div>
							</template>
							<template v-else>
								<div class="text-body-medium">{{ $t('plugins.WorkshopPrinting.pellet.fan_thermo_what', { zones: fanSel.zonesText }) }}</div>
								<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
									{{ $t('plugins.WorkshopPrinting.pellet.fan_on_from') }} <input v-model.number="trigLow" type="number" step="1" min="0" max="300" class="field" /> °C
									{{ $t('plugins.WorkshopPrinting.pellet.fan_full_from') }} <input v-model.number="trigHigh" type="number" step="1" min="0" max="300" class="field" /> °C
									<v-btn size="small" :color="armed === 'trig' ? 'amber-darken-3' : 'primary'" :disabled="!trigOk || !canOperate" @click="arm('trig', setTrigger)">
										{{ armed === 'trig' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.fan_apply') }}
									</v-btn>
								</div>
								<div class="text-body-small text-warning mt-2">{{ $t('plugins.WorkshopPrinting.pellet.fan_thermo_warn') }}</div>
							</template>
						</v-card>
						<!-- motor: live state, flow and pressure advance, and a short extrusion test -->
						<v-card v-else-if="pick.type === 'motor'" variant="outlined" class="pa-3">
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								<v-icon size="small">mdi-engine</v-icon>
								<span class="text-title-medium">{{ motorHmi.title }}</span>
								<v-chip variant="outlined" size="x-small" :color="motorHmi.running ? '#2e7d32' : '#616161'">{{ motorHmi.stateText }}</v-chip>
								<v-spacer />
								<span class="text-medium-emphasis text-body-small">{{ motorHmi.driveText }}</span>
							</div>
							<div class="text-headline-medium my-1">{{ motorHmi.rateText }}</div>
							<div v-if="ext" class="text-body-small text-medium-emphasis">
								{{ $t('plugins.WorkshopPrinting.pellet.motor_specs', { steps: ext.stepsPerMm, micro: ext.microstepping ? ext.microstepping.value : '?', vmax: Math.round(ext.speed / 60), acc: ext.acceleration, jerk: ext.jerk }) }}
							</div>
							<v-divider class="my-3" />
							<div class="text-title-small">{{ $t('plugins.WorkshopPrinting.pellet.motor_test') }}</div>
							<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
								<input v-model.number="testMm" type="number" step="1" min="1" max="100" class="field" /> mm
								<input v-model.number="testSpeed" type="number" step="0.5" min="0.5" max="60" class="field" /> mm/s
								<v-btn size="small" :color="armed === 'ext' ? 'amber-darken-3' : 'primary'" :disabled="!!motorReason || !canOperate" @click="arm('ext', () => runTest(false))">
									<v-icon size="small" start>mdi-arrow-down-bold</v-icon>{{ armed === 'ext' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.extrude') }}
								</v-btn>
								<v-btn size="small" variant="outlined" :color="armed === 'ret' ? 'amber-darken-3' : undefined" :disabled="!!motorReason || !canOperate" @click="arm('ret', () => runTest(true))">
									<v-icon size="small" start>mdi-arrow-up-bold</v-icon>{{ armed === 'ret' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.retract') }}
								</v-btn>
							</div>
							<div v-if="motorReason" class="text-body-small text-medium-emphasis mt-1">{{ motorReason }}</div>
							<v-divider class="my-3" />
							<div class="d-flex align-center flex-wrap" style="gap:8px">
								{{ $t('plugins.WorkshopPrinting.pellet.flow') }} <input v-model.number="flowNew" type="number" step="1" min="10" max="300" class="field" /> %
								<v-btn size="x-small" variant="outlined" :disabled="!flowCodeOk || !canOperate" @click="applyFlow()">{{ $t('plugins.WorkshopPrinting.pellet.fan_apply') }}</v-btn>
								<span class="ml-3">{{ $t('plugins.WorkshopPrinting.pellet.advance') }}</span> <input v-model.number="paNew" type="number" step="0.01" min="0" max="2" class="field" /> s
								<v-btn size="x-small" variant="outlined" :disabled="!paCodeOk || !canOperate" @click="applyAdvance()">{{ $t('plugins.WorkshopPrinting.pellet.fan_apply') }}</v-btn>
							</div>
							<div class="text-body-small text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.pellet.motor_runtime_note') }}</div>
							<v-btn v-if="canConfig" size="x-small" variant="outlined" class="mt-2" :title="$t('plugins.WorkshopPrinting.pellet.tune_flow_tip')" @click="$emit('goto', { section: 'extruder' })"><v-icon size="x-small" start>mdi-scale-balance</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.tune_flow') }}</v-btn>
						</v-card>
						<pellet-feed v-else-if="pick.type === 'feed'" :config="feedRaw" :tool="currentTool" :busy="busy" :gp-in="gpIn" :gp-out="gpOut" :configure="false" :can-operate="canOperate" @msg="feedMsg" @error="e => { failure = e; }" />
						<div v-else class="text-body-medium text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pellet.hmi_tap_a_part') }}</div>
						<div v-if="zones.some(z => z.sensorBad)" class="text-body-small text-error mt-2">
							{{ $t('plugins.WorkshopPrinting.pellet.a_zone_reads_no_temperature_check') }}
						</div>
						<div v-if="fansOthers.length" class="text-body-small text-medium-emphasis mt-2">
							{{ $t('plugins.WorkshopPrinting.pellet.other_fans', { list: fansOthers.map(f => f.name + ' ' + Math.round(f.value * 100) + ' %').join(', ') }) }}
						</div>
					</v-col>
				</v-row>

				<error-notice v-if="failure" :error="failure" class="mt-3" />
				<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
				<div v-if="canConfig" class="mt-4">
					<v-btn size="x-small" variant="outlined" @click="$emit('goto', { section: 'zones' })"><v-icon size="x-small" start>mdi-cog-outline</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.open_setup') }}</v-btn>
				</div>
			</template>
		</template>
	</pc-section>
</template>

<script setup>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CFG_FILE, readJson, isError } from './util.js'
import { rememberForNozzle, persistAdvance } from './nozzle-store.js'
import PelletHmi from './PelletHmi.vue'
import PelletFeed from './PelletFeed.vue'
import { normalize as normFeed, hopperState } from './pellet-feed.js'
import { machineFree } from './machine-free.js' // job (file, paused or live) and machine state (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { NEED } from './print-sections.js'
import { layout, loadLayout } from './pellet-orientation.js'
import { spinSeconds, fanState, fanCode, fanTriggerCode, extrudeCode, flowCode, advanceCode, motorBlock } from './pellet-hmi.js'
import { useRole } from './use-role.js' // what the role may do (vue/_shared)
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { machineModel, i18n } from './dwc-host.js'

const props = defineProps({
	isFff: { type: Boolean, default: false },
	currentTool: { type: Object, default: null },
	heaters: { type: Array, default: () => [] },
	tools: { type: Array, default: () => [] },
	fans: { type: Array, default: () => [] }
})

const emit = defineEmits(['goto'])

const { atLeast } = useRole()

const step = ref({})
const msg = ref(null)
const msgKind = ref('info')
const failure = ref(null)
const sel = ref(0)
const tempNew = ref(null)
const armed = ref(null)
const armedTimer = ref(null)
const testing = ref(false)
const feedRaw = ref(null)
const pick = ref({ type: 'zone', id: 0 })
const fanNew = ref(0)
const trigLow = ref(45)
const trigHigh = ref(50)
const testMm = ref(5)
const testSpeed = ref(2)
const flowNew = ref(100)
const paNew = ref(0)

// operator: the actions that only move heat / air / the motor (NEED, print-sections.js); this panel writes no configuration
const canOperate = computed(() => {
	return atLeast(NEED.operate);
})

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

const zoneSel = computed(() => {
	return zones.value[sel.value] || null;
})

const busy = computed(() => {
	const st = model.value.state && model.value.state.status;
	return ['processing', 'paused', 'pausing', 'resuming', 'simulating'].includes(st);
})

const reasonNo = computed(() => {
	const z = zoneSel.value;
	if (!z) return '';
	if (z.sensorBad) return i18n.t('plugins.WorkshopPrinting.pellet.can_t_heat_the_zone_doesn');
	if (z.state === 'fault') return i18n.t('plugins.WorkshopPrinting.pellet.can_t_heat_the_zone_is');
	if (busy.value) return i18n.t('plugins.WorkshopPrinting.pellet.a_job_is_running_the_job');
	if (!(tempNew.value > 0 && tempNew.value <= z.max)) return i18n.t('plugins.WorkshopPrinting.pellet.temp_range', { max: z.max });
	return '';
})

const canHeat = computed(() => {
	return !!zoneSel.value && !reasonNo.value;
})

// fans: the tool's blow on the part (next to the nozzle);
// the automatic (thermostatic) ones cool the throat
const fansTool = computed(() => {
	const ids = (props.currentTool && props.currentTool.fans) || [];
	return props.fans.filter(f => ids.includes(f.id));
})

const fansThroat = computed(() => {
	return props.fans.filter(f => f.thermostatic && !fansTool.value.includes(f));
})

const fansOthers = computed(() => {
	return props.fans.filter(f => !fansTool.value.includes(f) && !fansThroat.value.includes(f));
})

// ---- panel (PelletHmi): the motor / extruder of the tool and the part the person picked ----
const ext = computed(() => {
	const ex = (model.value.move && model.value.move.extruders) || [];
	return ex[extruderNumber.value] || null;
})

const extruderNumber = computed(() => {
	const t = props.currentTool;
	return t && t.extruders && t.extruders.length ? t.extruders[0] : 0;
})

const rate = computed(() => {
	const cm = model.value.move && model.value.move.currentMove;
	return cm && cm.extrusionRate > 0 ? cm.extrusionRate : 0;
})

const motorHmi = computed(() => {
	const running = rate.value > 0 || testing.value;
	const rateNow = testing.value ? Number(testSpeed.value) || 0 : rate.value;
	return {
		label: 'M' + extruderNumber.value,
		title: i18n.t('plugins.WorkshopPrinting.pellet.motor_title', { n: extruderNumber.value }),
		running,
		rateText: (running ? rateNow.toFixed(1) : '0.0') + ' mm/s',
		driveText: ext.value && ext.value.drives && ext.value.drives.length ? 'E' + extruderNumber.value + ' > ' + i18n.t('plugins.WorkshopPrinting.pellet.drive_n', { n: ext.value.drives[0] }) : 'E' + extruderNumber.value,
		stateText: running ? i18n.t('plugins.WorkshopPrinting.pellet.motor_running') : i18n.t('plugins.WorkshopPrinting.pellet.motor_stopped'),
		speedTurn: running ? spinSeconds(Math.min(1, rateNow / 10), 2.4, 0.5) : 0
	};
})

// ---- feeding of the hopper (pellet-feed.js) ----
const gpIn = computed(() => {
	return (model.value.sensors && model.value.sensors.gpIn) || [];
})

const gpOut = computed(() => {
	return (model.value.state && model.value.state.gpOut) || [];
})

const feedCfg = computed(() => {
	return normFeed(feedRaw.value);
})

const feedHmi = computed(() => {
	const c = feedCfg.value;
	const st = hopperState(c, gpIn.value);
	const color = { full: '#2e7d32', empty: '#c62828', unknown: '#9e9e9e' }[st];
	return {
		title: i18n.t('plugins.WorkshopPrinting.pellet.hmi_feed_title'),
		modeText: c.mode === 'auto' ? i18n.t('plugins.WorkshopPrinting.pellet.hmi_feed_auto') : i18n.t('plugins.WorkshopPrinting.pellet.hmi_feed_manual'),
		levelText: i18n.t('plugins.WorkshopPrinting.pellet.feed_level_' + st), color
	};
})

const fanSel = computed(() => {
	if (pick.value.type !== 'fan') return null;
	const f = props.fans.find(x => x.id === pick.value.id);
	if (!f) return null;
	const mf = (model.value.fans || [])[f.id] || {};
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
})

const trigOk = computed(() => {
	const f = fanSel.value;
	return !!f && !!fanTriggerCode(f.id, f.heaters, trigLow.value, trigHigh.value);
})

const freeMove = computed(() => {
	return machineFree(model.value, { t: ts, serviceText, serviceDefaultKey, purpose: 'move' });
})

const motorReason = computed(() => {
	const min = model.value.heat && model.value.heat.coldExtrudeTemperature != null ? model.value.heat.coldExtrudeTemperature : 160;
	const why = motorBlock({ busyJob: busy.value, notFree: !freeMove.value.free, zones: zones.value, minTemp: min });
	if (!why) return '';
	if (why === 'machine') return freeMove.value.reason;
	return i18n.t('plugins.WorkshopPrinting.pellet.motor_block_' + why, { min });
})

const flowCodeOk = computed(() => {
	return !!flowCode(flowNew.value);
})

const paCodeOk = computed(() => {
	return !!advanceCode(extruderNumber.value, paNew.value);
})

watch(sel, () => { putTempNew(); })

watch(pick, () => { seedEditors(); })

watch(ext, () => { if (pick.value.type === 'motor') seedEditors(); })

watch(zones, () => { if (tempNew.value == null) putTempNew(); })

onMounted(async () => {
	putTempNew();
	const cfg = (await readJson(CFG_FILE, {})) || {};
	step.value = Object.assign({}, cfg.step || {});
	feedRaw.value = cfg.feed || null;
	loadLayout();
})

onBeforeUnmount(() => {
	clearTimeout(armedTimer.value);
})

// color segun el estado (DESIGN.md 2): verde en temperatura, ambar calentando,
// naranja pasada, rojo falla, gris apagada
function colorZone(z) {
	if (z.sensorBad || z.state === 'fault') return '#c62828';
	if (z.state === 'tuning') return '#e65100';
	if (!(z.target > 0) || z.state === 'off') return '#616161';
	if (z.current > z.target + 10) return '#e65100';
	if (Math.abs(z.current - z.target) <= 3) return '#2e7d32';
	return '#ff8f00';
}

function stateZone(z) {
	if (z.sensorBad) return i18n.t('plugins.WorkshopPrinting.common.no_sensor');
	if (z.state === 'fault') return i18n.t('plugins.WorkshopPrinting.pellet.st_fault');
	if (z.state === 'tuning') return i18n.t('plugins.WorkshopPrinting.pellet.st_tuning');
	if (!(z.target > 0) || z.state === 'off') return z.current > 50 ? i18n.t('plugins.WorkshopPrinting.pellet.off_still_hot') : i18n.t('plugins.WorkshopPrinting.pellet.st_off');
	if (z.current > z.target + 10) return i18n.t('plugins.WorkshopPrinting.pellet.hotter_than_the_target');
	if (Math.abs(z.current - z.target) <= 3) return i18n.t('plugins.WorkshopPrinting.pellet.at_temperature');
	return i18n.t('plugins.WorkshopPrinting.pellet.st_heating');
}

function choose(k) {
	sel.value = k;
	armed.value = null;
}

function feedMsg(m) {
	failure.value = null;
	msgKind.value = m.kind;
	msg.value = m.text;
}

// a part of the panel was tapped: zone (heater), fan or motor
function select(p) {
	armed.value = null;
	pick.value = p;
	if (p.type === 'zone') sel.value = p.id;
}

function seedEditors() {
	if (pick.value.type === 'fan' && fanSel.value) {
		fanNew.value = Math.round(fanSel.value.value * 100);
		trigLow.value = fanSel.value.low != null ? fanSel.value.low : 45;
		trigHigh.value = fanSel.value.high != null ? fanSel.value.high : trigLow.value;
	}
	if (pick.value.type === 'motor') {
		flowNew.value = Math.round(((ext.value && ext.value.factor) || 1) * 100);
		paNew.value = (ext.value && ext.value.pressureAdvance) || 0;
	}
}

async function run(codes, okText, errKey) {
	try {
		for (const c of codes) {
			const r = await sendCode({ code: c, log: true });
			if (isError(r)) throw new Error(r);
		}
		msgKind.value = 'success';
		msg.value = okText;
		return true;
	} catch (e) {
		msgKind.value = 'error';
		msg.value = i18n.t(errKey, { error: e.message || String(e) });
		return false;
	}
}

// part fan: safe (level 1), one action; a run-time value (config.g / the mode file keep the saved ones)
async function setFan() {
	const f = fanSel.value;
	if (!f || f.thermostatic) return;
	await run([fanCode(f.id, fanNew.value)], i18n.t('plugins.WorkshopPrinting.pellet.fan_set', { name: f.name, n: fanNew.value }), 'plugins.WorkshopPrinting.pellet.fan_error');
}

// trigger temperatures of a thermostatic fan (throat cooling): double tap, a wrong value can melt the pellet in the throat
async function setTrigger() {
	const f = fanSel.value;
	const code = f && fanTriggerCode(f.id, f.heaters, trigLow.value, trigHigh.value);
	if (!code) return;
	await run([code], i18n.t('plugins.WorkshopPrinting.pellet.fan_trigger_set', { name: f.name, low: trigLow.value, high: trigHigh.value }), 'plugins.WorkshopPrinting.pellet.fan_error');
}

// short extrusion / retraction test (the board refuses it cold anyway): double tap, never with a job
async function runTest(retract) {
	const code = extrudeCode(testMm.value, testSpeed.value, retract);
	if (!code || motorReason.value) return;
	testing.value = true;
	try {
		await run([`T${props.currentTool.number}`].concat(code.split('\n'), ['M400']), i18n.t(retract ? 'plugins.WorkshopPrinting.pellet.test_retracted' : 'plugins.WorkshopPrinting.pellet.test_extruded', { mm: testMm.value }), 'plugins.WorkshopPrinting.pellet.test_error');
	} finally {
		testing.value = false;
	}
}

async function applyFlow() {
	const code = flowCode(flowNew.value);
	if (code) await run([code], i18n.t('plugins.WorkshopPrinting.pellet.flow_set', { n: flowNew.value }), 'plugins.WorkshopPrinting.pellet.fan_error');
}

async function applyAdvance() {
	const code = advanceCode(extruderNumber.value, paNew.value);
	if (!code) return;
	const ok = await run([code], i18n.t('plugins.WorkshopPrinting.pellet.advance_set', { n: paNew.value }), 'plugins.WorkshopPrinting.pellet.fan_error');
	// the technician's setting is kept: in modefff.g (it comes back at start) and in the profile of the nozzle registered now;
	// an operator's try only changes the machine until it restarts
	if (ok && canConfig.value) {
		try {
			await persistAdvance(extruderNumber.value, paNew.value);
			rememberForNozzle({ advance: paNew.value });
			msg.value += ' ' + i18n.t('plugins.WorkshopPrinting.pellet.advance_saved');
		} catch (e) {
			msgKind.value = 'error';
			msg.value = i18n.t('plugins.WorkshopPrinting.pellet.advance_not_saved', { error: e.message || String(e) });
		}
	}
}

function putTempNew() {
	const z = zoneSel.value;
	if (!z) return;
	const boq = zones.value[0];
	const base = boq && boq.target > 0 ? boq.target : 200;
	tempNew.value = z.target > 0 ? Math.round(z.target) : Math.round(sel.value === 0 ? base : base + (Number(step.value[z.id]) || 0));
}

function arm(id, fn) {
	if (armed.value !== id) {
		armed.value = id;
		clearTimeout(armedTimer.value);
		armedTimer.value = setTimeout(() => { armed.value = null; }, 4000);
		return;
	}
	armed.value = null;
	fn();
}

// temperatures of all the tool's zones, changing only one
function tempsWith(k, t) {
	const act = (props.currentTool && props.currentTool.active) || [];
	return zones.value.map((z, i) => (i === k ? t : Math.round(act[i] || 0))).join(':');
}

async function heatZone() {
	const z = zoneSel.value;
	if (!z || !canHeat.value) return;
	const t = Math.round(tempNew.value);
	try {
		const r = await sendCode({ code: `M568 P${props.currentTool.number} S${tempsWith(sel.value, t)} A2`, log: true });
		if (isError(r)) throw new Error(r);
		msgKind.value = 'success';
		msg.value = i18n.t('plugins.WorkshopPrinting.pellet.zone_heating_to', { n: sel.value + 1, c: t });
	} catch (e) {
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.pellet.could_not_heat', { error: e.message || String(e) });
	}
}

// apagar es seguro (nivel 1): un toque
async function powerOffZone() {
	const z = zoneSel.value;
	if (!z) return;
	try {
		const temps = tempsWith(sel.value, 0);
		const all = temps.split(':').every(v => Number(v) === 0);
		const r = await sendCode({ code: all ? `M568 P${props.currentTool.number} A0` : `M568 P${props.currentTool.number} S${temps}`, log: true });
		if (isError(r)) throw new Error(r);
		msgKind.value = 'success';
		msg.value = i18n.t('plugins.WorkshopPrinting.pellet.zone_off', { n: sel.value + 1 });
	} catch (e) {
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.pellet.could_not_turn_off', { error: e.message || String(e) });
	}
}
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
