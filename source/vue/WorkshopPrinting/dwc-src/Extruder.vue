<template>
	<pc-section icon="mdi-scale-balance" :title="$t('plugins.WorkshopPrinting.printing.extruder')">
		<v-alert v-if="!isFff" density="compact" variant="tonal" type="info" class="mb-3">{{ $t('plugins.WorkshopPrinting.common.the_extruder_only_exists_in_fff') }}</v-alert>
		<v-alert v-else-if="!hot" density="compact" variant="tonal" type="warning" class="mb-3">
			{{ $t('plugins.WorkshopPrinting.extruder.needs_hot_nozzle', { now: nozzle ? Math.round(nozzle.current) : '--', min: Math.round(minExtrusion) }) }}
		</v-alert>

		<!-- Tipo de extrusor -->
		<div class="text-title-small mb-1">{{ $t('plugins.WorkshopPrinting.extruder.kind_title', { tool: toolName }) }}</div>
		<div class="text-body-medium">{{ $t('plugins.WorkshopPrinting.extruder.kind_hint') }}</div>
		<v-btn-toggle :model-value="kind" mandatory density="compact" variant="outlined" color="primary" class="mt-1 mb-4" :disabled="!canConfig" @update:model-value="setKind">
			<v-btn value="pellet" size="small">{{ $t('plugins.WorkshopPrinting.extruder.kind_pellet') }}</v-btn>
			<v-btn value="filament" size="small">{{ $t('plugins.WorkshopPrinting.extruder.kind_filament') }}</v-btn>
		</v-btn-toggle>

		<!-- Purga -->
		<div class="text-title-small mb-1">{{ $t('plugins.WorkshopPrinting.extruder.purge') }}</div>
		<div class="text-body-medium">{{ $t('plugins.WorkshopPrinting.extruder.pushes_plastic_out_of_the_nozzle') }}</div>
		<v-row density="compact" class="mt-1" align="center">
			<v-col cols="4" sm="2"><v-text-field v-model.number="purgeMm" :label="$t('plugins.WorkshopPrinting.extruder.length_mm')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="4" sm="2"><v-text-field v-model.number="purgeF" :label="$t('plugins.WorkshopPrinting.extruder.speed_mm_min')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="4" sm="3">
				<v-btn size="small" :color="armed === 'purge' ? 'amber-darken-3' : 'primary'" :disabled="!can || busy" @click="arm('purge', () => extrude(purgeMm, purgeF))">
					{{ armed === 'purge' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.extruder.purge_2') }}
				</v-btn>
			</v-col>
		</v-row>

		<!-- Caudal -->
		<div class="text-title-small mt-5 mb-1">{{ $t('plugins.WorkshopPrinting.extruder.calibrate_the_flow_by_weight') }}</div>
		<div class="text-body-medium">
			{{ $t('plugins.WorkshopPrinting.extruder.' + (kind === 'filament' ? 'filament_flow_intro' : 'pellet_flow_intro'), { diam }) }} <b>M92 E</b> {{ $t('plugins.WorkshopPrinting.extruder.now_steps_mm', { n: currentSteps }) }}
		</div>
		<ol class="text-body-medium mt-2 steps">
			<li>{{ $t('plugins.WorkshopPrinting.extruder.preheat_the_material_and_purge_until') }}</li>
			<li>{{ $t('plugins.WorkshopPrinting.extruder.tap') }} <b>{{ $t('plugins.WorkshopPrinting.extruder.extrude_to_weigh') }}</b> {{ $t('plugins.WorkshopPrinting.extruder.and_collect_everything') }}</li>
			<li>{{ $t('plugins.WorkshopPrinting.extruder.weigh_it_ideally_a_0_01') }}</li>
		</ol>
		<v-row density="compact" class="mt-1" align="center">
			<v-col cols="6" sm="3">
				<v-select v-model="material" :items="materials" item-title="name" return-object :label="$t('plugins.WorkshopPrinting.common.material')" density="compact" variant="outlined" hide-details />
			</v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="diam" :label="$t('plugins.WorkshopPrinting.extruder.diameter_in_the_slicer_mm')" type="number" step="0.01" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="testMm" :label="$t('plugins.WorkshopPrinting.extruder.length_mm')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="testF" :label="$t('plugins.WorkshopPrinting.extruder.speed_mm_min')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="12" sm="3">
				<v-btn size="small" :color="armed === 'test' ? 'amber-darken-3' : 'primary'" :disabled="!can || busy" @click="arm('test', () => extrude(testMm, testF, true))">
					{{ armed === 'test' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.extruder.extrude_to_weigh') }}
				</v-btn>
			</v-col>
		</v-row>
		<v-row density="compact" class="mt-1" align="center">
			<v-col cols="6" sm="3"><v-text-field v-model.number="weightG" :label="$t('plugins.WorkshopPrinting.extruder.measured_weight_g')" type="number" step="0.01" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="12" sm="9" class="text-body-medium">
				<template v-if="calculation">
					{{ $t('plugins.WorkshopPrinting.extruder.expected') }} <b>{{ calculation.expected.toFixed(2) }} g</b>, {{ $t('plugins.WorkshopPrinting.extruder.measured') }} <b>{{ weightG }} g</b>: {{ $t('plugins.WorkshopPrinting.extruder.the_extruder_gives') }}
					<b :class="Math.abs(calculation.pct - 100) > 5 ? 'text-warning' : 'text-success'">{{ calculation.pct.toFixed(0) }} %</b> {{ $t('plugins.WorkshopPrinting.extruder.of_what_was_requested') }}
					{{ $t('plugins.WorkshopPrinting.extruder.new') }} <b>M92 E{{ calculation.newItem }}</b>.
				</template>
				<span v-else class="text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.extruder.pick_the_material_and_type_the') }}</span>
			</v-col>
		</v-row>
		<v-alert v-if="calculation && (calculation.pct < 50 || calculation.pct > 200)" density="compact" variant="tonal" type="warning" class="mt-2 mb-0">
			{{ $t('plugins.WorkshopPrinting.extruder.very_different_from_expected_check_the') }}
		</v-alert>
		<div v-if="calculation" class="d-flex flex-wrap mt-2" style="gap:8px">
			<v-btn size="small" variant="outlined" :disabled="busy" @click="applyChanges(false)">{{ $t('plugins.WorkshopPrinting.extruder.apply_now_until_the_mode_changes') }}</v-btn>
			<v-btn size="small" :color="armed === 'save' ? 'amber-darken-3' : 'primary'" :disabled="busy" @click="arm('save', () => applyChanges(true))">
				{{ armed === 'save' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.common.save_to_modefff_g') }}
			</v-btn>
		</div>
		<div class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopPrinting.extruder.save_changes_the_m92_e_line') }}</div>
		<error-notice v-if="failure" :error="failure" class="mt-3" />
		<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</pc-section>
</template>

<script setup>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CFG_FILE, MATERIALS_DEF, readJson, updateCfg, changeLineMode, isError, markStartup, note } from './util.js'
import { rememberForNozzle } from './nozzle-store.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { isFriendly } from './print-errors.js'
import { NEED } from './print-sections.js'
import { useRole } from './use-role.js' // what the role may do (vue/_shared)
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { i18n } from './dwc-host.js'
import { kindOfTool, loadExtruderKinds, saveExtruderKind } from './extruder-kind.js' // pellets or filament of each tool (printing.json)

const props = defineProps({
	isFff: { type: Boolean, default: false },
	nozzle: { type: Object, default: null },
	extruder: { type: Object, default: null },
	tool: { type: Object, default: null },
	minExtrusion: { type: Number, default: 160 },
	state: { type: String, default: '' }
})

const { atLeast } = useRole()
const canConfig = computed(() => atLeast(NEED.configure))
const kind = computed(() => kindOfTool(props.tool ? props.tool.number : 0))
const toolName = computed(() => (props.tool ? props.tool.name || 'T' + props.tool.number : ''))

const cfg = ref({})
const materials = ref([])
const material = ref(null)
const diam = ref(1.75)
const purgeMm = ref(50)
const purgeF = ref(120)
const testMm = ref(100)
const testF = ref(60)
const weightG = ref(null)
const armed = ref(null)
const armedTimer = ref(null)
const busy = ref(false)
const msg = ref(null)
const msgKind = ref('info')
const failure = ref(null)

const currentSteps = computed(() => {
	return props.extruder ? props.extruder.stepsPerMm : null;
})

const hot = computed(() => {
	const b = props.nozzle;
	return !!b && b.current >= props.minExtrusion && b.target > 0 && Math.abs(b.current - b.target) <= 5;
})

const can = computed(() => {
	return props.isFff && hot.value && !!props.tool && ['idle', 'busy'].includes(props.state);
})

const calculation = computed(() => {
	const m = material.value;
	if (!m || !(m.density > 0) || !(weightG.value > 0) || !(diam.value > 0) || !(testMm.value > 0) || !currentSteps.value) return null;
	const area = Math.PI * Math.pow(diam.value / 2, 2); // mm2
	const expected = (testMm.value * area * m.density) / 1000; // g
	const pct = (weightG.value / expected) * 100;
	return { expected: expected, pct, newItem: Math.round((currentSteps.value * expected) / weightG.value * 10) / 10 };
})

onMounted(async () => {
	loadExtruderKinds();
	cfg.value = (await readJson(CFG_FILE, {})) || {};
	materials.value = Array.isArray(cfg.value.materials) && cfg.value.materials.length ? cfg.value.materials : MATERIALS_DEF;
	material.value = materials.value.find(m => m.name === cfg.value.last) || materials.value[0];
	if (cfg.value.diameter > 0) diam.value = cfg.value.diameter;
})

onBeforeUnmount(() => {
	clearTimeout(armedTimer.value);
})

async function setKind(v) {
	if (!v || !atLeast(NEED.configure)) return; // writes printing.json
	msg.value = null;
	try {
		await saveExtruderKind(props.tool ? props.tool.number : 0, v);
	} catch (e) {
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.extruder.could_not_save_kind') + (e.message || e);
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

async function send(codes) {
	for (const c of codes) {
		const r = await sendCode({ code: c, log: true });
		if (isError(r)) throw new Error(r);
	}
}

async function extrude(mm, f, test) {
	const L = Math.max(1, Math.min(500, Number(mm) || 0));
	const F = Math.max(10, Math.min(1200, Number(f) || 60));
	busy.value = true;
	msg.value = null;
	try {
		await send([`T${props.tool.number}`, 'M83', `G1 E${L} F${F}`, 'M400']);
		msgKind.value = 'success';
		msg.value = test ? i18n.t('plugins.WorkshopPrinting.extruder.extruded_weigh_it', { mm: L }) : i18n.t('plugins.WorkshopPrinting.extruder.purge_done', { mm: L });
		if (test) weightG.value = null;
	} catch (e) {
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.extruder.could_not_extrude', { error: e.message || String(e) });
	} finally {
		busy.value = false;
	}
}

async function applyChanges(save) {
	const n = calculation.value && calculation.value.newItem;
	if (!(n > 0)) return;
	if (save && !atLeast(NEED.configure)) return; // saving writes modefff.g
	failure.value = null;
	busy.value = true;
	try {
		await send([`M92 E${n}`]);
		let txt = i18n.t('plugins.WorkshopPrinting.extruder.applied_m92', { n });
		if (save) {
			const r = await changeLineMode('M92 E', `M92 E${n}`);
			txt += ' ' + i18n.t('plugins.WorkshopPrinting.extruder.saved_in_modefff_before', { before: r.before.trim() });
			markStartup('flow', true, `M92 E${n}`).catch(() => {});
			rememberForNozzle({ flow: { steps: n } });
			note(sendCode, 'calibration', i18n.t('plugins.WorkshopPrinting.extruder.log_flow_saved', { n, material: material.value ? material.value.name : '' }));
		}
		// recordar el diametro elegido
		updateCfg({ diameter: diam.value }).catch(() => {});
		msgKind.value = 'success';
		msg.value = txt;
	} catch (e) {
		if (isFriendly(e)) failure.value = e;
		else {
			msgKind.value = 'error';
			msg.value = i18n.t('plugins.WorkshopPrinting.extruder.could_not_apply') + (e.message || e);
		}
	} finally {
		busy.value = false;
	}
}
</script>

<style scoped>
.steps {
	padding-left: 20px;
}
</style>
