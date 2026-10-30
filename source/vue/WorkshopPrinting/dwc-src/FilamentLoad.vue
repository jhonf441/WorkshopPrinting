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
		<v-alert v-if="!isFff" density="compact" variant="tonal" type="info" class="mt-3 mb-0">{{ t('filament.only_fff') }}</v-alert>

		<!-- 1. the material and the temperature: double tap (it heats, DESIGN.md 5 level 2) -->
		<div class="text-title-small mt-3">{{ t('filament.step_material') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ t('filament.material_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<v-select v-model="material" :items="materials" item-title="name" return-object :label="$t('plugins.WorkshopPrinting.common.material')" density="compact" variant="outlined" hide-details class="fl-select" />
			<span v-if="temp !== null" class="text-body-medium">{{ t('filament.heat_to', { tool: toolName, temp, now: nowText }) }}</span>
			<span v-else class="text-body-small text-medium-emphasis">{{ t('filament.no_temp') }}</span>
			<v-chip size="small" variant="outlined" :color="heatColor">{{ t('filament.heat_' + heat) }}</v-chip>
		</div>
		<div v-if="loaded" class="text-body-small text-medium-emphasis mt-1">{{ t('filament.loaded_now', { name: loaded }) }}</div>
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<v-btn size="small" :color="armed === 'heat' ? 'amber-darken-3' : 'primary'" :disabled="!isFff || temp === null || !canOperate || sending" @click="arm('heat', heatUp)">
				<v-icon size="small" start>mdi-fire</v-icon>{{ armed === 'heat' ? t('filament.heat_again', { temp }) : t('filament.heat') }}
			</v-btn>
			<!-- turning the heater off is safe (level 1): one tap -->
			<v-btn size="small" variant="outlined" :disabled="!canOperate || !isFff || !nozzle || !(nozzle.target > 0) || sending" @click="coolDown()">
				<v-icon size="small" start>mdi-snowflake</v-icon>{{ t('filament.cool') }}
			</v-btn>
		</div>

		<!-- 2. load / unload: double tap (it moves the extruder); the reason is written when it cannot -->
		<div class="text-title-small mt-4">{{ t('filament.step_move') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ macros.load || macros.unload ? t('filament.macro_help', { name: materialName || loaded || '...' }) : t('filament.direct_help') }}</div>
		<div v-if="!macros.load || !macros.unload" class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<span class="text-body-medium">{{ t('filament.length') }}</span>
			<input v-model.number="form.length" type="number" step="10" :min="limits.length.min" :max="limits.length.max" class="field" :disabled="!canOperate" /> mm
			<span class="text-body-medium ml-2">{{ t('filament.speed') }}</span>
			<input v-model.number="form.speed" type="number" step="0.5" :min="limits.speed.min" :max="limits.speed.max" class="field" :disabled="!canOperate" /> mm/s
			<span class="text-body-small text-medium-emphasis">{{ t('filament.limits', { lmin: limits.length.min, lmax: limits.length.max, smin: limits.speed.min, smax: limits.speed.max }) }}</span>
		</div>
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<v-btn size="small" :color="armed === 'load' ? 'amber-darken-3' : 'primary'" :disabled="!!blockReason || !(macros.load || formOk) || !canOperate || sending" @click="arm('load', () => move('load'))">
				<v-icon size="small" start>mdi-arrow-down-bold</v-icon>{{ armed === 'load' ? $t('plugins.WorkshopPrinting.common.tap_again') : t(macros.load ? 'filament.load_macro' : 'filament.load') }}
			</v-btn>
			<v-btn size="small" variant="outlined" :color="armed === 'unload' ? 'amber-darken-3' : undefined" :disabled="!!blockReason || !(macros.unload || formOk) || !canOperate || sending" @click="arm('unload', () => move('unload'))">
				<v-icon size="small" start>mdi-arrow-up-bold</v-icon>{{ armed === 'unload' ? $t('plugins.WorkshopPrinting.common.tap_again') : t(macros.unload ? 'filament.unload_macro' : 'filament.unload') }}
			</v-btn>
			<span v-if="blockReason" class="text-body-small text-medium-emphasis">{{ blockReason }}</span>
			<span v-else-if="!formOk && !(macros.load && macros.unload)" class="text-body-small text-warning">{{ t('filament.bad_form') }}</span>
		</div>

		<!-- 3. the wrap-up -->
		<div class="text-title-small mt-4">{{ t('filament.step_after') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ t('filament.after_help') }}</div>
		<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</pc-section>
</template>

<script setup>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CFG_FILE, MATERIALS_DEF, readJson, listItemsFolder, isError } from './util.js'
import { FILAMENTS_DIR, LOAD_DEFAULTS, LOAD_LIMITS, coolCodes, directCodes, heatCodes, heatState, loadTemp, loadedFilament, macroCodes, macroState, moveBlock, normalize } from './filament-load.js'
import { jobRunning } from './job-control.js'
import { machineFree } from './machine-free.js' // job (file, paused or live) and machine state (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { NEED } from './print-sections.js'
import { useRole } from './use-role.js' // what the role may do (vue/_shared)
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { machineModel, i18n } from './dwc-host.js'

const props = defineProps({
	isFff: { type: Boolean, default: false },
	tool: { type: Object, default: null },
	nozzle: { type: Object, default: null }, // the first zone of the tool (Print.vue heaters)
	minExtrusion: { type: Number, default: 160 }, // heat.coldExtrudeTemperature
	state: { type: String, default: '' }
})

const { atLeast } = useRole()

const limits = LOAD_LIMITS
const materials = ref([])
const material = ref(null)
const form = ref({ length: LOAD_DEFAULTS.length, speed: LOAD_DEFAULTS.speed })
const macros = ref({ load: false, unload: false })
const armed = ref(null)
const armedTimer = ref(null)
const sending = ref(false)
const msg = ref(null)
const msgKind = ref('info')

// heating and moving the extruder: an operator's, like the pellet motor test (NEED, print-sections.js)
const canOperate = computed(() => {
	return atLeast(NEED.operate);
})

const model = computed(() => {
	return machineModel();
})

const toolName = computed(() => (props.tool ? props.tool.name || 'T' + props.tool.number : ''))
const extruder = computed(() => (props.tool && props.tool.extruders && props.tool.extruders.length ? props.tool.extruders[0] : 0))
const materialName = computed(() => (material.value && material.value.nozzle > 0 ? material.value.name : ''))
const temp = computed(() => loadTemp(material.value, props.nozzle))
const nowText = computed(() => (props.nozzle && !props.nozzle.sensorBad && props.nozzle.current != null ? Math.round(props.nozzle.current) : '--'))
const heat = computed(() => heatState(props.nozzle))
const heatColor = computed(() => ({ ready: 'success', heating: 'amber-darken-3', off: 'grey-darken-1' }[heat.value]))
const loaded = computed(() => loadedFilament(model.value, extruder.value))
const formOk = computed(() => normalize(form.value).ok)

const free = computed(() => {
	return machineFree(model.value, { t: ts, serviceText, serviceDefaultKey, purpose: 'move' });
})

// why the extruder may not move now ('' = it may): job, machine not free, no reading, below the cold extrusion temperature
const blockReason = computed(() => {
	const why = moveBlock({ tool: props.tool, nozzle: props.nozzle, minTemp: props.minExtrusion, busyJob: jobRunning(props.state), notFree: !free.value.free });
	if (!why) return '';
	if (why === 'machine') return free.value.reason;
	return t('filament.block_' + why, { min: Math.round(props.minExtrusion) });
})

// the macros of the material picked (load.g) and of the filament the board remembers (unload.g)
watch([materialName, loaded], () => { checkMacros(); }, { immediate: true })

onMounted(async () => {
	const cfg = (await readJson(CFG_FILE, {})) || {};
	const list = Array.isArray(cfg.materials) && cfg.materials.length ? cfg.materials : MATERIALS_DEF;
	materials.value = [{ name: t('filament.material_none'), nozzle: 0 }].concat(list);
	material.value = materials.value.find(m => m.name === cfg.last && m.nozzle > 0) || materials.value[0];
})

onBeforeUnmount(() => {
	clearTimeout(armedTimer.value);
})

function t(key, params) {
	return i18n.t('plugins.WorkshopPrinting.' + key, params);
}

async function checkMacros() {
	const name = materialName.value, cur = loaded.value;
	const load = name ? macroState(await listItemsFolder(FILAMENTS_DIR + '/' + name)).load : false;
	const unload = cur ? macroState(await listItemsFolder(FILAMENTS_DIR + '/' + cur)).unload : false;
	if (name === materialName.value && cur === loaded.value) macros.value = { load, unload };
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

async function run(codes, okText) {
	if (!canOperate.value || sending.value || !codes.length) return false;
	sending.value = true;
	msg.value = null;
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
		msg.value = t('filament.could_not', { error: e.message || String(e) });
		return false;
	} finally {
		sending.value = false;
	}
}

function heatUp() {
	if (!props.tool || temp.value === null) return;
	run(heatCodes(props.tool.number, temp.value), t('filament.heating_sent', { temp: temp.value }));
}

function coolDown() {
	if (!props.tool) return;
	run(coolCodes(props.tool.number), t('filament.cooled'));
}

// load / unload: the macro of the board when it is there, else the direct extrusion; checked again at the tap
function move(action) {
	if (blockReason.value || !props.tool) return;
	const useMacro = action === 'load' ? macros.value.load : macros.value.unload;
	if (useMacro) {
		const codes = macroCodes(action, props.tool.number, materialName.value);
		run(codes, t('filament.macro_done', { code: codes[codes.length - 1] }));
		return;
	}
	const v = normalize(form.value);
	if (!v.ok) return;
	run(directCodes(action, props.tool.number, v.value), t(action === 'load' ? 'filament.loaded' : 'filament.unloaded', { mm: v.value.length }));
}
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
