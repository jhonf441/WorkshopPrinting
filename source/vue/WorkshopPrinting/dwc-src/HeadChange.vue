<template>
	<pc-section icon="mdi-swap-horizontal" :title="$t('plugins.WorkshopPrinting.printing.head_change')">
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>
			{{ $t('plugins.WorkshopPrinting.headChange.wizard_to_change_the_head_steps') }}
			</p>
		</details>

		<div class="d-flex flex-wrap align-center mt-3" style="gap:8px">
			<span class="text-body-medium">{{ $t('plugins.WorkshopPrinting.headChange.switch_from') }} <b>{{ nameMode(origin) || '...' }}</b> {{ $t('plugins.WorkshopPrinting.headChange.to') }}</span>
			<v-btn v-if="origin !== mode && mode" size="x-small" variant="text" @click="beginOfNew()">{{ $t('plugins.WorkshopPrinting.headChange.start_over_from', { mode: nameMode(mode) }) }}</v-btn>
			<v-btn-toggle v-model="destination" mandatory density="compact" color="primary">
				<v-btn v-for="m in targets" :key="m" size="small" :value="m">{{ nameMode(m) }}</v-btn>
			</v-btn-toggle>
		</div>

		<div class="mt-3">
			<div v-for="(p, k) in steps" :key="destination + k" class="step" :class="{ done: done(k), current: k === next }">
				<div class="step-num">
					<v-icon v-if="done(k)" size="small" color="white">mdi-check</v-icon>
					<span v-else>{{ k + 1 }}</span>
				</div>
				<div class="step-body">
					<div class="text-body-medium" :class="{ 'font-weight-medium': k === next }">{{ p.text }}</div>
					<div v-if="p.detail" class="text-body-small text-medium-emphasis">{{ p.detail }}</div>
					<div class="mt-1">
						<v-checkbox v-if="p.kind === 'manual'" :model-value="done(k)" :disabled="k > next" density="compact" hide-details class="mt-0"
							:label="p.check || $t('plugins.WorkshopPrinting.headChange.done')" @update:model-value="mark(k, $event)" />
						<template v-else-if="p.kind === 'action'">
							<v-btn size="x-small" :color="armed === k ? 'amber-darken-3' : done(k) ? '' : 'primary'" :variant="(done(k)) ? 'outlined' : 'elevated'"
								:disabled="k > next || busy || !!block(p) || (p.can && !p.can())" @click="touch(k)">
								{{ armed === k ? $t('plugins.WorkshopPrinting.common.tap_again') : done(k) ? $t('plugins.WorkshopPrinting.headChange.again') : p.button }}
							</v-btn>
							<span v-if="k === next && block(p)" class="text-body-small text-warning ml-2">{{ block(p) }}</span>
							<span v-else-if="p.can && !p.can() && p.because" class="text-body-small text-warning ml-2">{{ p.because() }}</span>
						</template>
						<div v-else-if="p.kind === 'auto'" class="text-body-small" :class="p.ok() ? 'text-success' : 'text-warning'">
							{{ p.state() }}
						</div>
					</div>
				</div>
			</div>
		</div>
		<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
		<v-alert v-if="next >= steps.length" density="compact" variant="tonal" type="success" class="mt-3 mb-0">
			{{ $t('plugins.WorkshopPrinting.headChange.ready_machine_in_mode', { mode: nameMode(destination) }) }}
		</v-alert>
	</pc-section>
</template>

<script setup>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { isError } from './util.js'
import { pathExists } from './workshop-ids.js' // the Workbench is another plugin: nothing about it when it is absent
import { nozzleState } from './nozzle-state.js'
import { machineFree } from './machine-free.js' // trabajo de archivo, pausado o en vivo (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { useRouter } from 'vue-router'
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { machineModel, i18n } from './dwc-host.js'

const MACRO_MODE = { FFF: '0:/macros/mode/selectfff.g', Laser: '0:/macros/mode/selectlaser.g', CNC: '0:/macros/mode/selectcnc.g' };
const cold = 50; // °C: below it the nozzle can be removed

const props = defineProps({
	mode: { type: String, default: '' },
	state: { type: String, default: '' },
	homed: { type: Boolean, default: false },
	nozzle: { type: Object, default: null },
	// names of the modes the machine uses (machine-modes.js); null = not known, all of them
	modes: { type: Array, default: null }
})

const router = useRouter()

const origin = ref('')
const destination = ref(null)
const doneMap = ref({})
const armed = ref(null)
const armedTimer = ref(null)
const busy = ref(false)
const msg = ref(null)
const msgKind = ref('info')

const targets = computed(() => {
	return ['FFF', 'Laser', 'CNC'].filter(m => m !== origin.value && (!props.modes || props.modes.indexOf(m) >= 0));
})

const z = computed(() => {
	const ax = (machineModel().move && machineModel().move.axes) || [];
	return ax.find(a => a && a.letter === 'Z') || null;
})

const steps = computed(() => {
	const aFFF = destination.value === 'FFF';
	const hasWorkbench = pathExists(router, '/Plugins/Workbench');
	const since = origin.value === 'FFF'; // the mode it started with (does not change when changing mode)
	const raiseZ = {
		kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.raise_z_30_mm_to_make'), button: i18n.t('plugins.WorkshopPrinting.headChange.raise_z'),
		detail: i18n.t('plugins.WorkshopPrinting.headChange.moves_the_machine_if_z_is'),
		can: () => !!z.value && z.value.homed && z.value.machinePosition + 30 <= z.value.max,
		because: () => (!z.value || !z.value.homed ? i18n.t('plugins.WorkshopPrinting.headChange.z_not_homed') : i18n.t('plugins.WorkshopPrinting.headChange.there_are_not_30_mm_above')),
		free: 'move',
		// a single request (motion audit, finding 10): separate, another client of the same
		// channel could end up between the G91 and the G90 and move in relative
		codes: ['G91\nG1 Z30 F600 S0\nG90']
	};
	const p = [];
	if (since) {
		p.push({ kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.turn_off_the_nozzle_and_the'), button: i18n.t('plugins.WorkshopPrinting.headChange.turn_off'), codes: codesPowerOff() });
		// a sensor that is not connected reads -273 C: that is not "cold", nobody knows: the person checks it by hand
		const ns = nozzleState(props.nozzle, cold);
		if (ns === 'unreadable') {
			p.push({
				kind: 'manual', text: i18n.t('plugins.WorkshopPrinting.headChange.wait_for_nozzle_to_cool', { c: cold }),
				check: i18n.t('plugins.WorkshopPrinting.headChange.nozzle_no_reading_check')
			});
		} else {
			p.push({
				kind: 'auto', text: i18n.t('plugins.WorkshopPrinting.headChange.wait_for_nozzle_to_cool', { c: cold }),
				ok: () => nozzleState(props.nozzle, cold) !== 'hot',
				state: () => {
					if (!props.nozzle) return i18n.t('plugins.WorkshopPrinting.headChange.no_nozzle_ready');
					const c = Math.round(props.nozzle.current);
					return nozzleState(props.nozzle, cold) === 'hot' ? i18n.t('plugins.WorkshopPrinting.headChange.nozzle_at_c_still_hot', { c }) : i18n.t('plugins.WorkshopPrinting.headChange.nozzle_at_c_ready', { c });
				}
			});
		}
	} else {
		p.push({ kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.turn_off_the_laser_or_the'), button: i18n.t('plugins.WorkshopPrinting.headChange.turn_off'), codes: ['M5'] });
	}
	p.push(raiseZ);
	p.push({
		kind: 'manual',
		text: aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.remove_the_laser_or_the_spindle') : (destination.value === 'Laser' ? i18n.t('plugins.WorkshopPrinting.headChange.remove_pellet_extruder_mount_laser') : i18n.t('plugins.WorkshopPrinting.headChange.remove_pellet_extruder_mount_spindle')),
		detail: aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.connect_the_heater_the_thermistor_the') : i18n.t('plugins.WorkshopPrinting.headChange.disconnect_the_extruder_s_heater_and'),
		check: i18n.t('plugins.WorkshopPrinting.headChange.i_changed_the_head')
	});
	if (aFFF) p.push({ kind: 'manual', text: i18n.t('plugins.WorkshopPrinting.headChange.put_the_print_surface_on_and'), check: i18n.t('plugins.WorkshopPrinting.headChange.bed_ready') });
	p.push({ kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.switch_machine_to_mode', { mode: nameMode(destination.value) }), button: i18n.t('plugins.WorkshopPrinting.headChange.change_mode'), free: 'settings', codes: ['M98 P"' + MACRO_MODE[destination.value] + '"'] });
	p.push({ kind: 'action', text: i18n.t('plugins.WorkshopPrinting.headChange.home_g28'), button: i18n.t('plugins.WorkshopPrinting.headChange.homing'), detail: i18n.t('plugins.WorkshopPrinting.headChange.moves_the_machine'), free: 'move', codes: ['G28'] });
	p.push({
		kind: 'manual',
		text: aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.check_the_nozzle_z_height_before') : destination.value === 'Laser' ? i18n.t('plugins.WorkshopPrinting.headChange.check_the_laser_pointer_correction_and') : i18n.t('plugins.WorkshopPrinting.headChange.check_the_cutter_s_z_zero'),
		detail: hasWorkbench
			? (aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.the_bltouch_offset_is_specific_to') : i18n.t('plugins.WorkshopPrinting.headChange.in_work_zones_offsets'))
			: (aFFF ? i18n.t('plugins.WorkshopPrinting.headChange.the_bltouch_offset_is_specific_to_no_map') : ''),
		check: i18n.t('plugins.WorkshopPrinting.headChange.checked')
	});
	return p;
})

const next = computed(() => {
	for (let k = 0; k < steps.value.length; k++) {
		if (!done(k)) return k;
	}
	return steps.value.length;
})

if (props.mode) beginOfNew();

watch(() => props.mode, (m) => {
	// the model arrived after creating the component
	if (!origin.value && m) beginOfNew();
})

watch(destination, () => {
	doneMap.value = {};
	msg.value = null;
})

onBeforeUnmount(() => {
	clearTimeout(armedTimer.value);
})

function beginOfNew() {
	origin.value = props.mode;
	destination.value = props.mode === 'FFF' ? 'Laser' : 'FFF';
	doneMap.value = {};
	msg.value = null;
}

function nameMode(m) {
	return { FFF: i18n.t('plugins.WorkshopPrinting.headChange.fff_printing'), Laser: i18n.t('plugins.WorkshopPrinting.headChange.laser'), CNC: 'CNC' }[m] || m;
}

function codesPowerOff() {
	const tools = (machineModel().tools || []).filter(t => t);
	return tools.map(t => `M568 P${t.number} S0 R0 A0`).concat(['M140 S0']);
}

// Steps that move or change the mode (libre: 'mover' / 'settings'): never with a file job,
// paused or live, nor with the machine busy (motion audit,
// finding 7). Turning off (M5, heaters) is never blocked. '' = allowed.
function block(p) {
	if (!p || !p.free) return '';
	const ml = machineFree(machineModel(), { t: ts, serviceText, serviceDefaultKey, purpose: p.free });
	return ml.free || ml.confirm ? '' : ml.reason; // confirm: allowed with a double tap (see tocar)
}

// live job open but still: moving asks for a second double tap with the reason (only on the page)
function confirmLive(p) {
	if (!p || !p.free) return null;
	const ml = machineFree(machineModel(), { t: ts, serviceText, serviceDefaultKey, purpose: p.free });
	return ml.confirm ? ml : null;
}

function done(k) {
	const p = steps.value[k];
	if (!p) return false;
	if (p.kind === 'auto') return p.ok();
	// the change mode step is done if the machine is already in the target
	if (p.codes && p.codes[0].startsWith('M98') && props.mode === destination.value) return true;
	return !!doneMap.value[k];
}

function mark(k, v) {
	doneMap.value[k] = !!v;
	if (!v) {
		// desmarcar uno deshace los siguientes
		Object.keys(doneMap.value).forEach(i => { if (+i > k) delete doneMap.value[i]; });
	}
}

function touch(k) {
	const p = steps.value[k];
	const moves = p.codes.some(c => /^G(1|28)\b/m.test(c)); // m: the G1 may come after a G91 in the same block
	const cv = confirmLive(p);
	if ((moves || cv) && armed.value !== k) {
		armed.value = k;
		if (cv) {
			msgKind.value = 'warning';
			msg.value = p.text + ': ' + cv.reason + i18n.t('plugins.WorkshopPrinting.headChange.tap_again_to_confirm');
		}
		clearTimeout(armedTimer.value);
		armedTimer.value = setTimeout(() => { armed.value = null; }, 4000);
		return;
	}
	armed.value = null;
	run(k, p);
}

async function run(k, p) {
	const b = block(p); // se vuelve a mirar al tocar
	if (b) {
		msgKind.value = 'error';
		msg.value = p.text + ': ' + b;
		return;
	}
	busy.value = true;
	msg.value = null;
	try {
		for (const c of p.codes) {
			const r = await sendCode({ code: c, log: true });
			if (isError(r)) throw new Error(r);
		}
		doneMap.value[k] = true;
	} catch (e) {
		msgKind.value = 'error';
		msg.value = p.text + ': ' + (e.message || e);
	} finally {
		busy.value = false;
	}
}
</script>

<style scoped>
.explica {
	background: rgba(25, 118, 210, 0.08);
	border-radius: 6px;
	padding: 8px 12px;
}
.step {
	display: flex;
	gap: 10px;
	padding: 8px 0;
	border-bottom: 1px solid rgba(128, 128, 128, 0.15);
	opacity: 0.6;
}
.step.current,
.step.done {
	opacity: 1;
}
.step-num {
	flex: none;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: #607d8b;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	font-weight: 700;
}
.step.current .step-num {
	background: #1976d2;
}
.step.done .step-num {
	background: #2e7d32;
}
.step-body {
	flex: 1;
	min-width: 0;
}
</style>
