<template>
	<div ref="root">
	<pc-section icon="mdi-clipboard-check-outline" :title="$t('plugins.WorkshopPrinting.printing.printer_tests')">
		<v-alert v-if="startupPending > 0" density="compact" variant="tonal" type="warning" class="mb-2">{{ $t('plugins.WorkshopPrinting.commissioning.start_chip_first') }}</v-alert>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>
			{{ $t('plugins.WorkshopPrinting.commissioning.for_the_first_time_everything_is') }}
			</p>
		</details>
		<v-alert v-if="!isFff" density="compact" variant="tonal" type="info" class="mt-3 mb-0">
			{{ $t('plugins.WorkshopPrinting.commissioning.first_switch_the_machine_to_fff') }}
			<v-btn size="x-small" variant="text" color="primary" @click="$emit('go', 'head')">{{ $t('plugins.WorkshopPrinting.commissioning.go_to_head_change') }}</v-btn>
		</v-alert>
		<template v-else>
			<!-- Summary at the top (2026-10-11): how much is done and which one is next, with a single button to go there -->
			<div class="summary mt-3">
				<div class="d-flex align-center flex-wrap" style="gap:8px">
					<span class="text-title-medium font-weight-medium">{{ $t('plugins.WorkshopPrinting.commissioning.n_of_total_steps_done', { n: done, total: steps.length }) }}</span>
					<v-chip v-if="withProblem" size="small" variant="outlined" color="error"><v-icon size="x-small" start>mdi-alert</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.n_to_check', { n: withProblem }) }}</v-chip>
					<v-spacer />
					<template v-if="next">
						<span class="text-body-medium">{{ $t('plugins.WorkshopPrinting.commissioning.next') }} <b>{{ next.title }}</b></span>
						<v-btn v-if="openId !== next.id" size="small" color="primary" @click="openStep(next.id)">
							<v-icon size="small" start>mdi-arrow-right</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.go_to_step_n', { n: number(next.id) }) }}
						</v-btn>
					</template>
				</div>
				<v-progress-linear :model-value="steps.length ? (done / steps.length) * 100 : 0" color="success" height="6" rounded class="mt-2" />
			</div>
			<v-alert v-if="!next" density="compact" variant="tonal" type="success" class="mt-3 mb-0">
				{{ $t('plugins.WorkshopPrinting.commissioning.commissioning_complete_the_machine_is_ready') }}
			</v-alert>

			<div class="mt-2">
				<div v-for="(p, k) in steps" :key="p.id" class="step" :class="['p-' + p.state, { open: openId === p.id, follows: next && next.id === p.id }]">
					<!-- step header: tap to open or close -->
					<div class="step-cab" role="button" tabindex="0" @click="toggle(p.id)" @keydown.enter="toggle(p.id)">
						<div class="step-num">
							<v-icon v-if="p.state === 'ok'" size="small" color="white">mdi-check</v-icon>
							<v-icon v-else-if="p.state === 'bad'" size="small" color="white">mdi-close</v-icon>
							<span v-else>{{ k + 1 }}</span>
						</div>
						<div class="step-title">
							<div class="text-body-medium font-weight-medium">{{ p.title }}</div>
							<div v-if="openId !== p.id && p.summary" class="text-body-small text-medium-emphasis">{{ p.summary }}</div>
						</div>
						<v-chip size="x-small" :variant="(p.state !== 'ok') ? 'outlined' : 'flat'" :color="colorChip(p)">{{ textChip(p) }}</v-chip>
						<v-icon size="small">{{ openId === p.id ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
					</div>

					<div v-if="openId === p.id" class="step-body">
						<div class="text-body-medium">{{ p.help }}</div>

						<!-- 1. sensores: se mira en vivo -->
						<template v-if="p.id === 'sensors'">
							<div v-if="!heaters.length" class="text-body-medium text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.commissioning.there_are_no_heaters_configured_they') }}</div>
							<div v-for="h in heaters" :key="h.id" class="row text-body-medium">
								<v-icon size="small" :color="sensorOk(h) ? 'success' : 'error'">{{ sensorOk(h) ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
								<span class="name">{{ h.name }}</span>
								<b>{{ h.sensorBad ? $t('plugins.WorkshopPrinting.commissioning.no_reading') : Math.round(h.current) + ' °C' }}</b>
								<span v-if="!sensorOk(h)" class="text-error text-body-small">{{ h.explanation || (h.current > 50 ? $t('plugins.WorkshopPrinting.commissioning.it_is_hot_wait_for_it') : $t('plugins.WorkshopPrinting.commissioning.abnormal_resting_reading_5_to_50')) }}</span>
							</div>
							<div class="actions">
								<v-btn v-if="p.state === 'ok'" size="small" color="primary" @click="advance(p.id)">
									<v-icon size="small" start>mdi-arrow-right</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.good_next_step') }}
								</v-btn>
								<template v-else-if="heaters.length">
									<v-btn size="small" color="primary" @click="$emit('go', 'state')"><v-icon size="small" start>mdi-thermometer</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.see_in_status') }}</v-btn>
									<span class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.commissioning.it_checks_itself_when_the_sensor') }}</span>
								</template>
							</div>
						</template>

						<!-- 2. calentadores: prueba real, de a uno (nivel 2: calienta, doble toque) -->
						<template v-else-if="p.id === 'heaters'">
							<div v-for="h in heaters" :key="h.id" class="row text-body-medium">
								<v-icon size="small" :color="iconCal(h).color">{{ iconCal(h).icon }}</v-icon>
								<span class="name">{{ h.name }}</span>
								<span v-if="test && test.id === h.id" class="text-body-small">
									<v-progress-circular indeterminate size="12" width="2" class="mr-1" />{{ test.text }}
								</span>
								<span v-else-if="resultCal(h)" class="text-body-small" :class="resultCal(h).ok ? 'text-success' : 'text-error'">
									{{ resultCal(h).text }}<span v-if="resultCal(h).date" class="text-medium-emphasis"> ({{ resultCal(h).date }})</span>
								</span>
								<span v-else-if="reasonNoCal(h)" class="text-body-small text-medium-emphasis">{{ reasonNoCal(h) }}</span>
								<span v-else class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.commissioning.not_tested') }}</span>
								<v-btn v-if="!(test && test.id === h.id) && resultCal(h) && !reasonNoCal(h)" size="x-small" :variant="(armed !== 'cal' + h.id) ? 'outlined' : 'elevated'" :color="armed === 'cal' + h.id ? 'amber-darken-3' : undefined" @click="arm('cal' + h.id, () => testHeater(h))">
									{{ armed === 'cal' + h.id ? $t('plugins.WorkshopPrinting.commissioning.tap_again_it_heats') : $t('plugins.WorkshopPrinting.commissioning.repeat') }}
								</v-btn>
							</div>
							<div class="actions">
								<v-btn v-if="test" size="small" variant="outlined" @click="cancelTest()"><v-icon size="small" start>mdi-stop</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.stop_the_test') }}</v-btn>
								<v-btn v-else-if="calNext" size="small" :color="armed === 'cal' + calNext.id ? 'amber-darken-3' : 'primary'" :disabled="!!reasonNoCal(calNext)" @click="arm('cal' + calNext.id, () => testHeater(calNext))">
									<v-icon size="small" start>mdi-fire</v-icon>{{ armed === 'cal' + calNext.id ? $t('plugins.WorkshopPrinting.commissioning.tap_again_it_heats') + calNext.name.toLowerCase() : $t('plugins.WorkshopPrinting.commissioning.test') + calNext.name.toLowerCase() }}
								</v-btn>
								<v-btn v-else-if="p.state === 'ok'" size="small" color="primary" @click="advance(p.id)">
									<v-icon size="small" start>mdi-arrow-right</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.good_next_step') }}
								</v-btn>
								<span v-if="!test && calNext && reasonNoCal(calNext)" class="text-body-small text-medium-emphasis">{{ reasonNoCal(calNext) }}</span>
								<span v-else-if="!calNext && p.state !== 'ok'" class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.commissioning.fix_what_is_marked_in_red') }}</span>
							</div>
						</template>

						<!-- 3. ventiladores -->
						<template v-else-if="p.id === 'fans'">
							<div v-for="f in fans" :key="f.id" class="row text-body-medium">
								<v-icon size="small">mdi-fan</v-icon>
								<span class="name">{{ f.name }}</span>
								<v-btn v-if="!f.thermostatic" size="x-small" variant="outlined" :disabled="!free || turning === f.id" @click="testFan(f)">
									{{ turning === f.id ? $t('plugins.WorkshopPrinting.commissioning.spinning') : $t('plugins.WorkshopPrinting.commissioning.spin_3_s') }}
								</v-btn>
								<span v-else class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.commissioning.automatic_spins_only_when_the_nozzle') }}</span>
							</div>
							<div v-if="!fans.length" class="text-body-medium text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.commissioning.there_are_no_fans_configured') }}</div>
							<div v-if="!free" class="text-body-small text-medium-emphasis mt-1">{{ reasonBusy }}</div>
							<div class="actions">
								<v-btn v-if="!marked(p.id)" size="small" color="primary" @click="mark(p.id, true)">
									<v-icon size="small" start>mdi-check</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.yes_they_all_spin_and_blow') }}
								</v-btn>
								<v-btn v-else size="small" color="primary" @click="advance(p.id)"><v-icon size="small" start>mdi-arrow-right</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.next_step') }}</v-btn>
							</div>
						</template>

						<!-- 4. extruder: done in other tabs, here it is only guided -->
						<template v-else-if="p.id === 'extruder'">
							<ol class="text-body-medium mt-2 list">
								<li>{{ $t('plugins.WorkshopPrinting.commissioning.preheat_the_material') }} <v-btn size="x-small" variant="outlined" @click="$emit('go', 'materials')">{{ $t('plugins.WorkshopPrinting.commissioning.go_to_materials') }}</v-btn></li>
								<li>{{ $t('plugins.WorkshopPrinting.commissioning.when_the_nozzle_is_at_temperature') }} <v-btn size="x-small" variant="outlined" @click="$emit('go', 'extruder')">{{ $t('plugins.WorkshopPrinting.commissioning.go_to_extruder') }}</v-btn></li>
								<li>{{ $t('plugins.WorkshopPrinting.commissioning.check_that_plastic_comes_out_of') }}</li>
							</ol>
							<div class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.commissioning.if_the_screw_turns_backwards_nothing') }}</div>
							<div class="actions">
								<v-btn v-if="!marked(p.id)" size="small" color="primary" @click="mark(p.id, true)">
									<v-icon size="small" start>mdi-check</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.yes_plastic_comes_out') }}
								</v-btn>
								<v-btn v-else size="small" color="primary" @click="advance(p.id)"><v-icon size="small" start>mdi-arrow-right</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.next_step') }}</v-btn>
							</div>
						</template>

						<!-- 5..9: done in another tab (or in Zones) -->
						<template v-else>
							<div class="actions">
								<v-btn v-if="p.state !== 'ok' && p.button" size="small" color="primary" @click="p.go === -1 ? goZones() : $emit('go', p.go)">
									<v-icon size="small" start>mdi-open-in-app</v-icon>{{ p.button }}
								</v-btn>
								<template v-else>
									<v-btn size="small" color="primary" @click="advance(p.id)"><v-icon size="small" start>mdi-arrow-right</v-icon>{{ $t('plugins.WorkshopPrinting.commissioning.next_step') }}</v-btn>
									<v-btn v-if="p.button" size="small" variant="outlined" @click="p.go === -1 ? goZones() : $emit('go', p.go)">{{ p.button }}</v-btn>
								</template>
								<v-btn v-if="p.manual && !marked(p.id)" size="small" variant="outlined" @click="mark(p.id, true)"><v-icon size="small" start>mdi-check</v-icon>{{ p.manual }}</v-btn>
							</div>
							<div v-if="p.only" class="text-body-small text-medium-emphasis mt-1">{{ p.only }}</div>
						</template>

						<div v-if="startup[p.id] && startup[p.id].date && startup[p.id].ok" class="text-body-small text-medium-emphasis mt-2">
							{{ $t('plugins.WorkshopPrinting.commissioning.done_on', { date: startup[p.id].date }) }} {{ startup[p.id].detail }}
							<v-btn v-if="p.manual || p.id === 'fans' || p.id === 'extruder'" size="x-small" variant="text" @click="mark(p.id, false)">{{ $t('plugins.WorkshopPrinting.commissioning.mark_as_pending') }}</v-btn>
						</div>
						<!-- moving between steps: the same four buttons as the other start-up assistants (Previous, Skip, Next, Close) -->
						<div class="d-flex flex-wrap mt-3 startup-buttons startup-nav" style="gap:8px">
							<v-btn size="small" :disabled="k === 0" @click="openStep(steps[k - 1].id)">{{ $t('plugins.WorkshopPrinting.startup.assist_prev') }}</v-btn>
							<v-btn size="small" :disabled="k === steps.length - 1" @click="openStep(steps[k + 1].id)">{{ $t('plugins.WorkshopPrinting.startup.assist_skip') }}</v-btn>
							<v-btn size="small" color="primary" @click="advance(p.id)">{{ $t('plugins.WorkshopPrinting.startup.assist_next') }}</v-btn>
							<v-btn size="small" @click="open = '-'">{{ $t('plugins.WorkshopPrinting.startup.assist_close') }}</v-btn>
						</div>
					</div>
				</div>
			</div>
		</template>
		<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</pc-section>
	</div>
</template>

<script setup>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CFG_FILE, readJson, markStartup, note } from './util.js'
import { pathExists } from './workshop-ids.js' // the Workbench is another plugin: nothing about it when it is absent
import { useRouter } from 'vue-router'
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { i18n } from './dwc-host.js'

const SUBA_MIN = 5; // °C that must rise in the test
const TEST_S = 120;

// Redesign 2026-10-11 ("improve and redesign the commissioning topic"):
// step-by-step assistant. At the top how much is done and which one is next; each step
// opens one at a time with ONE main button (test, confirm or go to the tab
// where it is done). The ids of cfg.startup do not change (Pid and Extruder mark them).

const props = defineProps({
	startupPending: { type: Number, default: 0 },
	isFff: { type: Boolean, default: false },
	heaters: { type: Array, default: () => [] },
	tools: { type: Array, default: () => [] },
	fans: { type: Array, default: () => [] },
	state: { type: String, default: '' }
})

const emit = defineEmits(['go'])

const router = useRouter()

const root = ref(null) // template ref: the root element, watched to reread when this tab is shown
const startup = ref({})
const test = ref(null)
const resCal = ref({})
const armed = ref(null)
const armedTimer = ref(null)
const msg = ref(null)
const msgKind = ref('info')
const open = ref(null)
const turning = ref(null)
const obs = ref(null)

const free = computed(() => {
	return props.state === 'idle';
})

const reasonBusy = computed(() => {
	if (free.value) return '';
	if (['processing', 'paused', 'pausing', 'resuming', 'simulating', 'cancelling'].includes(props.state)) return i18n.t('plugins.WorkshopPrinting.common.a_job_is_running_wait_for');
	if (props.state === 'busy') return i18n.t('plugins.WorkshopPrinting.common.the_machine_is_busy_moving_or');
	return props.state ? i18n.t('plugins.WorkshopPrinting.commissioning.machine_not_idle_state', { state: props.state }) : i18n.t('plugins.WorkshopPrinting.commissioning.machine_not_idle');
})

const steps = computed(() => {
	const hasWorkbench = pathExists(router, '/Plugins/Workbench');
	const cs = props.heaters;
	const sensOk = cs.length > 0 && cs.every(h => sensorOk(h));
	const calTested = cs.filter(h => (resultCal(h) || {}).ok).length;
	const calBad = cs.some(h => resultCal(h) && !resultCal(h).ok);
	const calOk = cs.length > 0 && calTested === cs.length;
	const est = id => ((startup.value[id] || {}).ok ? 'ok' : 'pending');
	const fecha = id => ((startup.value[id] || {}).ok ? i18n.t('plugins.WorkshopPrinting.commissioning.done_on', { date: startup.value[id].date }) : '');
	const sensMal = cs.filter(h => !sensorOk(h)).length;
	const p = [
		{ id: 'sensors', title: i18n.t('plugins.WorkshopPrinting.commissioning.temperature_sensors'), help: i18n.t('plugins.WorkshopPrinting.commissioning.at_rest_each_sensor_has_to'), state: cs.length ? (sensOk ? 'ok' : 'bad') : 'pending',
			summary: !cs.length ? i18n.t('plugins.WorkshopPrinting.commissioning.no_heaters') : sensMal ? sensMal + i18n.t('plugins.WorkshopPrinting.commissioning.with_a_problem') : i18n.t('plugins.WorkshopPrinting.commissioning.all_read_fine') },
		{ id: 'heaters', title: i18n.t('plugins.WorkshopPrinting.commissioning.each_heater_heats'), help: i18n.t('plugins.WorkshopPrinting.commissioning.heater_test_help', { rise: SUBA_MIN, min: TEST_S / 60 }),
			state: calOk ? 'ok' : calBad ? 'bad' : 'pending', summary: cs.length ? i18n.t('plugins.WorkshopPrinting.commissioning.n_of_total_tested', { n: calTested, total: cs.length }) : '' },
		{ id: 'fans', title: i18n.t('plugins.WorkshopPrinting.common.fans'), help: i18n.t('plugins.WorkshopPrinting.commissioning.the_part_cooling_fan_is_tested'), state: est('fans'), summary: fecha('fans') },
		{ id: 'extruder', title: i18n.t('plugins.WorkshopPrinting.commissioning.the_extruder_pushes_outward'), help: i18n.t('plugins.WorkshopPrinting.commissioning.with_the_nozzle_hot_purge_and'), state: est('extruder'), summary: fecha('extruder') },
		{ id: 'flow', title: i18n.t('plugins.WorkshopPrinting.commissioning.extruder_flow_m92_e'), help: i18n.t('plugins.WorkshopPrinting.commissioning.pellet_what_comes_out_is_weighed'), go: 'extruder', button: i18n.t('plugins.WorkshopPrinting.commissioning.go_to_extruder'), only: i18n.t('plugins.WorkshopPrinting.commissioning.it_is_marked_done_by_itself'), state: est('flow'), summary: fecha('flow') },
		{ id: 'pid_nozzle', title: i18n.t('plugins.WorkshopPrinting.commissioning.nozzle_pid'), help: i18n.t('plugins.WorkshopPrinting.commissioning.so_it_holds_the_temperature_without'), go: 'pid', button: i18n.t('plugins.WorkshopPrinting.commissioning.go_to_pid'), only: i18n.t('plugins.WorkshopPrinting.commissioning.it_is_marked_done_by_itself_2'), state: est('pid_nozzle'), summary: fecha('pid_nozzle') },
		{ id: 'pid_bed', title: i18n.t('plugins.WorkshopPrinting.commissioning.bed_pid'), help: i18n.t('plugins.WorkshopPrinting.commissioning.same_as_the_nozzle_takes_longer'), go: 'pid', button: i18n.t('plugins.WorkshopPrinting.commissioning.go_to_pid'), only: i18n.t('plugins.WorkshopPrinting.commissioning.it_is_marked_done_by_itself_3'), state: est('pid_bed'), summary: fecha('pid_bed') }
	];
	if (cs.some(h => h.paper === 'camera')) p.push({ id: 'pid_camera', title: i18n.t('plugins.WorkshopPrinting.commissioning.chamber_pid'), help: i18n.t('plugins.WorkshopPrinting.commissioning.heated_chamber'), go: 'pid', button: i18n.t('plugins.WorkshopPrinting.commissioning.go_to_pid'), only: i18n.t('plugins.WorkshopPrinting.commissioning.it_is_marked_done_by_itself_4'), state: est('pid_camera'), summary: fecha('pid_camera') });
	p.push({ id: 'height_z', title: i18n.t('plugins.WorkshopPrinting.commissioning.first_layer_z_height_and_mesh'), help: hasWorkbench ? i18n.t('plugins.WorkshopPrinting.commissioning.fff_mode_bltouch_offset_and_the') : i18n.t('plugins.WorkshopPrinting.commissioning.fff_mode_bltouch_offset_and_the_no_map'), go: -1, button: hasWorkbench ? i18n.t('plugins.WorkshopPrinting.commissioning.open_work_zones') : '', manual: i18n.t('plugins.WorkshopPrinting.commissioning.i_already_measured_the_z_height'), state: est('height_z'), summary: fecha('height_z') });
	return p;
})

const done = computed(() => {
	return steps.value.filter(p => p.state === 'ok').length;
})

const withProblem = computed(() => {
	return steps.value.filter(p => p.state === 'bad').length;
})

// the first one missing (in order: a badly done step holds back the ones below)
const next = computed(() => {
	return steps.value.find(p => p.state !== 'ok') || null;
})

// open: what the user chose; if none chosen, the next one. '-' = none
const openId = computed(() => {
	if (open.value === '-') return null;
	if (open.value && steps.value.some(p => p.id === open.value)) return open.value;
	return next.value ? next.value.id : null;
})

// the next heater without a good test (the step 2 main button)
const calNext = computed(() => {
	return props.heaters.find(h => !(resultCal(h) || {}).ok && !h.sensorBad && h.state !== 'fault') || null;
})

watch(() => props.heaters, () => {
	followTest();
})

onMounted(async () => {
	await readStartup();
	// Pid and Extruder mark their steps from their tab: on returning to this one, reread
	if (window.IntersectionObserver && root.value instanceof Element) {
		obs.value = new IntersectionObserver(is => { if (is.some(e => e.isIntersecting)) readStartup(); });
		obs.value.observe(root.value);
	}
})

onBeforeUnmount(() => {
	clearTimeout(armedTimer.value);
	if (obs.value) obs.value.disconnect();
	if (test.value) poweroff(test.value.h);
})

async function readStartup() {
	const cfg = (await readJson(CFG_FILE, {})) || {};
	startup.value = cfg.startup || {};
}

function goZones() {
	if (router) router.push('/Plugins/Workbench');
}

function number(id) {
	return steps.value.findIndex(p => p.id === id) + 1;
}

function openStep(id) {
	open.value = id;
}

function toggle(id) {
	open.value = openId.value === id ? '-' : id;
}

// paso terminado: volver a seguir al que falta
function advance(id) {
	if (open.value === id || open.value === '-' || !open.value) {
		const k = steps.value.findIndex(p => p.id === id);
		const prox = steps.value.slice(k + 1).find(p => p.state !== 'ok');
		open.value = prox ? prox.id : null;
	}
}

function colorChip(p) {
	if (p.state === 'ok') return 'success';
	if (p.state === 'bad') return 'error';
	return next.value && next.value.id === p.id ? 'primary' : 'grey';
}

function textChip(p) {
	if (p.state === 'ok') return i18n.t('plugins.WorkshopPrinting.commissioning.chip_done');
	if (p.state === 'bad') return i18n.t('plugins.WorkshopPrinting.commissioning.chip_check');
	return next.value && next.value.id === p.id ? i18n.t('plugins.WorkshopPrinting.commissioning.chip_next') : i18n.t('plugins.WorkshopPrinting.commissioning.chip_missing');
}

function sensorOk(h) {
	if (h.sensorBad) return false;
	return h.current >= 5 && h.current <= 50 || h.state !== 'off'; // hot from use: it is not a sensor fault
}

// test result: the current one or the saved one (with its date)
function resultCal(h) {
	if (resCal.value[h.id]) return resCal.value[h.id];
	const g = startup.value['cal_' + h.id];
	return g && g.date ? { ok: !!g.ok, text: g.detail || (g.ok ? i18n.t('plugins.WorkshopPrinting.commissioning.heats_fine') : i18n.t('plugins.WorkshopPrinting.commissioning.it_did_not_heat')), date: g.date } : null;
}

function iconCal(h) {
	const r = resultCal(h);
	if (test.value && test.value.id === h.id) return { icon: 'mdi-fire', color: 'amber-darken-3' };
	if (!r) return { icon: 'mdi-circle-outline', color: 'grey' };
	return r.ok ? { icon: 'mdi-check-circle', color: 'success' } : { icon: 'mdi-alert-circle', color: 'error' };
}

// why it cannot be tested now (written, DESIGN.md 5)
function reasonNoCal(h) {
	if (test.value) return i18n.t('plugins.WorkshopPrinting.commissioning.a_test_is_running');
	if (h.sensorBad) return i18n.t('plugins.WorkshopPrinting.commissioning.no_sensor_reading_fix_it_first');
	if (h.state === 'fault') return i18n.t('plugins.WorkshopPrinting.commissioning.in_fault_clear_it_in_status');
	if (!free.value) return reasonBusy.value;
	return '';
}

function marked(id) {
	return !!(startup.value[id] && startup.value[id].ok);
}

async function mark(id, v) {
	try {
		startup.value = await markStartup(id, v);
		msg.value = null;
		if (v) advance(id);
	} catch (e) {
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.common.could_not_save') + (e.message || e);
	}
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

function codePut(h, t) {
	if (h.paper === 'bed') return `M140 S${t}`;
	if (h.paper === 'camera') return `M141 S${t}`;
	if (h.tool != null) {
		const tool = props.tools.find(x => x.number === h.tool);
		const n = (tool && tool.heaters || []).length || 1;
		const temps = Array.from({ length: n }, (_, i) => (i === h.zone ? t : 0)).join(':');
		return `M568 P${h.tool} S${temps} A2`;
	}
	return `M140 H${h.id} S${t}`;
}

async function poweroff(h) {
	const c = h.paper === 'bed' ? 'M140 S0' : h.paper === 'camera' ? 'M141 S0' : h.tool != null ? `M568 P${h.tool} A0` : null;
	if (c) await sendCode({ code: c, log: true }).catch(() => {});
}

async function testHeater(h) {
	if (reasonNoCal(h)) return;
	const target = h.paper === 'bed' || h.paper === 'camera' ? 40 : 60;
	test.value = { id: h.id, h, since: Date.now(), t0: h.current, target: target, text: i18n.t('plugins.WorkshopPrinting.commissioning.heating_from', { c: Math.round(h.current) }) };
	try {
		await sendCode({ code: codePut(h, target), log: true });
	} catch (e) {
		finishTest(false, i18n.t('plugins.WorkshopPrinting.commissioning.could_not_turn_on', { error: e.message || String(e) }));
	}
}

// apagar es seguro (nivel 1): un toque, sin guardar resultado
async function cancelTest() {
	const pr = test.value;
	if (!pr) return;
	test.value = null;
	await poweroff(pr.h);
	msgKind.value = 'info';
	msg.value = i18n.t('plugins.WorkshopPrinting.commissioning.test_stopped', { name: pr.h.name.toLowerCase() });
}

// every time the state arrives: see how much it rose
function followTest() {
	const pr = test.value;
	if (!pr) return;
	const h = props.heaters.find(x => x.id === pr.id);
	if (!h) return;
	const rose = h.current - pr.t0;
	const s = Math.round((Date.now() - pr.since) / 1000);
	if (h.state === 'fault') return finishTest(false, i18n.t('plugins.WorkshopPrinting.commissioning.went_into_fault'));
	if (rose >= SUBA_MIN) return finishTest(true, i18n.t('plugins.WorkshopPrinting.commissioning.rose_ok', { s, c: rose.toFixed(1) }));
	if (s > TEST_S) return finishTest(false, i18n.t('plugins.WorkshopPrinting.commissioning.rose_too_little', { c: rose.toFixed(1), s: TEST_S }));
	pr.text = i18n.t('plugins.WorkshopPrinting.commissioning.progress', { c: Math.round(h.current), rise: rose.toFixed(1), s });
}

async function finishTest(ok, texto) {
	const pr = test.value;
	if (!pr) return;
	test.value = null;
	await poweroff(pr.h);
	resCal.value[pr.id] = { ok, text: texto };
	note(sendCode, ok ? 'calibration' : 'warning', i18n.t('plugins.WorkshopPrinting.commissioning.log_test', { name: pr.h.name, text: texto }));
	try {
		startup.value = await markStartup('cal_' + pr.id, ok, texto);
	} catch (e) {
		/* no critico */
	}
	// all good: continue with the missing step
	if (ok && props.heaters.every(h => (resultCal(h) || {}).ok)) advance('heaters');
}

async function testFan(f) {
	turning.value = f.id;
	try {
		await sendCode({ code: `M106 P${f.id} S1`, log: true });
		setTimeout(() => {
			sendCode({ code: `M106 P${f.id} S0`, log: true }).catch(() => {});
			if (turning.value === f.id) turning.value = null;
		}, 3000);
	} catch (e) {
		turning.value = null;
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.common.couldn_t') + (e.message || e);
	}
}
</script>

<style scoped>
.explica {
	background: rgba(25, 118, 210, 0.08);
	border-radius: 6px;
	padding: 8px 12px;
}
.summary {
	border: 1px solid rgba(128, 128, 128, 0.25);
	border-radius: 6px;
	padding: 10px 12px;
}
.step {
	border-bottom: 1px solid rgba(128, 128, 128, 0.15);
	border-left: 3px solid transparent;
}
.step.open {
	border-left-color: #1976d2;
	background: rgba(25, 118, 210, 0.05);
}
.step-cab {
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 44px;
	padding: 6px 8px;
	cursor: pointer;
}
.step-title {
	flex: 1;
	min-width: 0;
}
.step-num {
	flex: none;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: #455a64;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	font-weight: 700;
}
.follows .step-num {
	background: #1976d2;
}
.p-ok .step-num {
	background: #2e7d32;
}
.p-bad .step-num {
	background: #c62828;
}
.step-body {
	padding: 0 8px 10px 42px;
}
.row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 6px;
}
.row .name {
	min-width: 150px;
}
.actions {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 12px;
}
.list li {
	margin-bottom: 4px;
}
@media (max-width: 600px) {
	.step-body {
		padding-left: 12px;
	}
}
</style>
