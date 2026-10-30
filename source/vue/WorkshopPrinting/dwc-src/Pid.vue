<template>
	<pc-section icon="mdi-chart-bell-curve" :title="$t('plugins.WorkshopPrinting.common.pid')" :bare="zonesOnly">
		<details v-if="!zonesOnly" class="wf-more">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>
			{{ $t('plugins.WorkshopPrinting.pid.intro') }} <b>{{ $t('plugins.WorkshopPrinting.pid.do_not_leave') }}</b>
			</p>
		</details>
		<v-alert v-if="!isFff" density="compact" variant="tonal" type="info" class="mt-3 mb-0">{{ $t('plugins.WorkshopPrinting.pid.the_nozzle_and_the_bed_only') }}</v-alert>
		<template v-else>
			<template v-if="!zonesOnly">
			<v-row density="compact" class="mt-3" align="center">
				<v-col cols="12" sm="4">
					<v-btn-toggle v-model="which" mandatory density="compact" color="primary">
						<v-btn v-for="h in options" :key="h.id" size="small" :value="h.id">{{ h.name }}</v-btn>
					</v-btn-toggle>
				</v-col>
				<v-col cols="6" sm="2"><v-text-field v-model.number="temp" :label="$t('plugins.WorkshopPrinting.pid.temperature_c')" type="number" density="compact" variant="outlined" hide-details /></v-col>
				<v-col cols="6" sm="3">
					<v-btn size="small" variant="outlined" color="error" :disabled="!can || !!inProgress" @click="touch()">
						{{ armed ? $t('plugins.WorkshopPrinting.pid.tap_again_it_will_heat') : $t('plugins.WorkshopPrinting.pid.calibrate') }}
					</v-btn>
				</v-col>
			</v-row>
			<div v-if="reasonNo" class="text-body-small text-warning mt-1"><v-icon size="x-small" color="warning" class="mr-1">mdi-lock-outline</v-icon>{{ reasonNo }}</div>
			<div v-if="chosen && temp > chosen.max" class="text-body-small text-error">{{ $t('plugins.WorkshopPrinting.pid.above_machine_limit', { max: chosen.max }) }}</div>
			<div v-if="inProgress && !zActive" class="text-body-medium mt-2">
				<v-progress-circular indeterminate size="16" width="2" class="mr-1" />
				{{ $t('plugins.WorkshopPrinting.pid.tuning_in_progress', { name: inProgress.name, c: Math.round(inProgress.current) }) }}
			</div>
			<pid-tune-chart v-if="trace && trace.points.length > 1" :trace="trace" />
			<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopPrinting.pid.current_model_of', { name: chosen ? chosen.name.toLowerCase() : '...' }) }}</div>
			<div class="text-body-medium" style="font-family:var(--tp-font-mono, monospace)">{{ modelTxt || $t('plugins.WorkshopPrinting.common.reading') }}</div>
			<template v-if="line">
				<div class="text-body-medium mt-2">{{ $t('plugins.WorkshopPrinting.pid.line_for_modefff') }} <code>{{ line }}</code></div>
				<div class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pid.now_in_the_file') }} <code>{{ lineFile || $t('plugins.WorkshopPrinting.pid.not_read') }}</code></div>
				<div class="d-flex flex-wrap mt-2" style="gap:8px">
					<v-btn size="small" :color="armedG ? 'amber-darken-3' : 'primary'" :disabled="!lineFile || lineFile.trim().startsWith(line)" :loading="saving" @click="touchSave()">
						{{ armedG ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.common.save_to_modefff_g') }}
					</v-btn>
					<v-btn size="small" variant="text" @click="readModel()">{{ $t('plugins.WorkshopPrinting.pid.read_again') }}</v-btn>
				</div>
				<div class="text-body-small text-medium-emphasis mt-1">
					{{ $t('plugins.WorkshopPrinting.pid.after_tuning_the_new_model_is') }}
				</div>
			</template>

			<!-- 2026-10-11: how the selected heater's PID is and how it works,
			     with the current values (read only; see PidDetail.vue) -->
			<v-divider v-if="chosen" class="my-4" />
			<pid-detail v-if="chosen" :om-heaters="heaters" :chosen="chosen" :reference="refTemp" :model-txt="modelTxt" @choose="which = $event" />

			</template>
			<!-- 2026-10-11: all the zones of a tool (pellet / several zones), one at a time,
			     with the neighbours hot. Done by the service (API pid.start): it continues even if the page is closed. -->
			<template v-if="toolsZones.length">
				<v-divider v-if="!zonesOnly" class="my-4" />
				<div v-if="!zonesOnly" class="text-title-medium font-weight-medium">{{ $t('plugins.WorkshopPrinting.pid.all_zones_automatic') }}</div>
				<details class="wf-more mt-1">
					<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
					<p>
					{{ $t('plugins.WorkshopPrinting.pid.in_a_barrel_with_several_zones') }} <b>{{ $t('plugins.WorkshopPrinting.pid.coupled') }}</b>{{ $t('plugins.WorkshopPrinting.pid.if_you_tune_a_zone_with') }}
					</p>
				</details>
				<v-row v-if="toolsZones.length > 1" density="compact" class="mt-2">
					<v-col cols="12">
						<v-btn-toggle v-model="toolZ" mandatory density="compact" color="primary">
							<v-btn v-for="t in toolsZones" :key="t" size="small" :value="t" :disabled="zActive">T{{ t }}</v-btn>
						</v-btn-toggle>
					</v-col>
				</v-row>
				<v-table density="compact" class="mt-2">
					<thead>
						<tr><th>{{ $t('plugins.WorkshopPrinting.common.zone') }}</th><th>{{ $t('plugins.WorkshopPrinting.common.now') }}</th><th>{{ $t('plugins.WorkshopPrinting.pid.target_c') }}</th><th>{{ $t('plugins.WorkshopPrinting.pid.result') }}</th></tr>
					</thead>
					<tbody>
						<tr v-for="z in zonesSel" :key="z.id" :class="zCurrent === z.id ? 'zone-current' : ''">
							<td>{{ z.name }}<span class="text-medium-emphasis text-body-small"> (H{{ z.id }})</span></td>
							<td>{{ z.current != null ? Math.round(z.current) + ' °C' : '-' }}</td>
							<td style="max-width:120px">
								<v-text-field v-model.number="objZ[z.id]" type="number" density="compact" hide-details :disabled="zActive"
									:error="!tempZOk(z)" :suffix="$t('plugins.WorkshopPrinting.pid.limit_n', { n: z.max })" />
							</td>
							<td>
								<v-chip variant="outlined" size="x-small" :color="chipZ(z.id).color">{{ chipZ(z.id).text }}</v-chip>
							</td>
						</tr>
					</tbody>
				</v-table>
				<div v-if="zonesSel.some(z => !tempZOk(z))" class="text-body-small text-error">{{ $t('plugins.WorkshopPrinting.pid.each_target_must_be_from_50') }}</div>
				<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
					<v-btn size="small" variant="outlined" color="error" :disabled="!canZ" @click="touchZones()">
						{{ armedZ ? $t('plugins.WorkshopPrinting.pid.tap_again_it_will_heat') : $t('plugins.WorkshopPrinting.pid.tune_all') }}
					</v-btn>
					<v-btn v-if="zActive" size="small" variant="outlined" :loading="cancellingZ" @click="cancelZones()">
						<v-icon size="small" start>mdi-stop</v-icon>{{ $t('plugins.WorkshopPrinting.pid.cancel') }}
					</v-btn>
					<span v-if="!zActive && reasonNoZ" class="text-body-small text-medium-emphasis">{{ reasonNoZ }}</span>
				</div>
				<div v-if="zActive" class="text-body-medium mt-2">
					<v-progress-circular indeterminate size="16" width="2" class="mr-1" />
					{{ textPhaseZ }}
					<span class="text-medium-emphasis">({{ minutesZ }} min)</span>
					<div class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pid.to_stop_cancel_turns_the_zones') }}</div>
				</div>
				<v-alert v-if="zState && !zActive && zState.error" density="compact" variant="tonal" :type="zState.phase === 'finished' ? 'warning' : 'error'" class="mt-2 mb-0">{{ zState.error }}</v-alert>
				<div v-for="z in zErrors" :key="'e' + z.h" class="text-body-small text-error">H{{ z.h }}: {{ z.error }}</div>
				<template v-if="linesZ.length && !zActive">
					<div class="text-title-small mt-3 mb-1">{{ $t('plugins.WorkshopPrinting.pid.new_lines_for_sys_modefff_g') }}</div>
					<div v-for="l in linesZ" :key="l.h" class="text-body-medium"><code>{{ l.line }}</code></div>
					<div class="d-flex flex-wrap mt-2" style="gap:8px">
						<v-btn size="small" :color="armedZG ? 'amber-darken-3' : 'primary'" :loading="savingZ" @click="touchSaveZones()">
							{{ armedZG ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pid.save_all_to_modefff_g') }}
						</v-btn>
					</div>
					<div class="text-body-small text-medium-emphasis mt-1">
						{{ $t('plugins.WorkshopPrinting.pid.the_new_models_are_already_in') }}
					</div>
				</template>
			</template>
		</template>
		<error-notice v-if="failure" :error="failure" class="mt-3" />
		<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</pc-section>
</template>

<script setup>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api, apiText } from './workshop-api.js'
import { MODE_FILE, CFG_FILE, MATERIALS_DEF, readText, writeText, readJson, changeLineMode, isError, markStartup, note } from './util.js'
import PidDetail from './PidDetail.vue'
import PidTuneChart from './PidTuneChart.vue'
import { fromService } from './pid-trace.js'
import { lineSince, replaceM307Lines } from './mode-lines.js'
import { rememberForNozzle } from './nozzle-store.js'
import ErrorNotice from './ErrorNotice.vue' // vue/_shared
import { isFriendly } from './print-errors.js'
import { NEED } from './print-sections.js'
import { useRole } from './use-role.js' // what the role may do (vue/_shared)
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { i18n } from './dwc-host.js'

const props = defineProps({
	isFff: { type: Boolean, default: false },
	zonesOnly: { type: Boolean, default: false }, // only the all-zones tuning (mounted inside the pellet setup)
	heaters: { type: Array, default: () => [] },
	tool: { type: Object, default: null },
	state: { type: String, default: '' }
})

const { atLeast } = useRole()

let timer = null
let traceTimer = null
let probing = null
let destroyed = false // set when the page leaves: the status polling stops

const which = ref(null)
const temp = ref(200)
const armed = ref(false)
const armedG = ref(false)
const modelTxt = ref('')
const lineFile = ref('')
const saving = ref(false)
const msg = ref(null)
const msgKind = ref('info')
const failure = ref(null)
const wasCalibrating = ref(false)
// the real record of the tuning in progress (or the last one): the SERVICE takes it while the heater is tuned (dsf/pid_trace.py), so any
// screen or session sees it and it goes on with this page closed; here it is only read (pid.trace)
const trace = ref(null)
let startedHere = null // {id, temp, at}: the target typed here, for when the board does not publish it
let traceTick = 0
// all the zones (2026-10-11): state published by the Pi (S"estado") and editable targets
const toolZ = ref(null)
const objZ = ref({})
const zState = ref(null)
const armedZ = ref(false)
const armedZG = ref(false)
const cancellingZ = ref(false)
const savingZ = ref(false)
const textMode = ref('')
const cfgImp = ref(null)

const options = computed(() => {
	return props.heaters.filter(h => h.paper === 'nozzle' || h.paper === 'bed' || h.paper === 'camera');
})

const chosen = computed(() => {
	return options.value.find(h => h.id === which.value) || null;
})

// temperature for the detail's calculations (2026-10-11): the target if it is
// on; otherwise, the calibrate temperature from above
const refTemp = computed(() => {
	const h = chosen.value;
	if (h && h.target > 0) return Number(h.target);
	const t = Number(temp.value);
	return Number.isFinite(t) && t > 0 ? t : 200;
})

const inProgress = computed(() => {
	return props.heaters.find(h => h.state === 'tuning') || null;
})

const can = computed(() => {
	const h = chosen.value;
	return props.isFff && !!h && h.state !== 'fault' && temp.value > 30 && temp.value <= h.max && props.state === 'idle' && !zActive.value;
})

// why "Calibrate" is locked: the button is only grey, so the page says the reason (a heater in fault, a bad temperature, a busy machine)
const reasonNo = computed(() => {
	const h = chosen.value
	if (!props.isFff || inProgress.value || can.value || !h) return ''
	const t = k => i18n.t('plugins.WorkshopPrinting.pid.' + k, { name: h.name, c: Math.round(h.current), max: h.max })
	if (h.state === 'fault') return t('locked_heater_fault')
	if (zActive.value) return t('locked_zones_running')
	if (!(temp.value > 30) || temp.value > h.max) return t('locked_temperature')
	if (props.state !== 'idle') return t('locked_machine_busy')
	return ''
})

// ---- all the zones (2026-10-11) ----
const toolsZones = computed(() => {
	return [...new Set(props.heaters.filter(h => h.paper === 'nozzle' && h.tool != null).map(h => h.tool))].sort((a, b) => a - b);
})

const zonesSel = computed(() => {
	return props.heaters.filter(h => h.paper === 'nozzle' && h.tool === toolZ.value).sort((a, b) => a.zone - b.zone);
})

const zActive = computed(() => {
	return !!(zState.value && zState.value.active);
})

const zCurrent = computed(() => {
	const e = zState.value;
	if (!e || !e.active || e.zone_current == null) return null;
	const z = (e.zones || [])[e.zone_current];
	return z ? z.h : null;
})

const canZ = computed(() => {
	return props.isFff && !zActive.value && !reasonNoZ.value && zonesSel.value.length > 0 && zonesSel.value.every(z => tempZOk(z));
})

const reasonNoZ = computed(() => {
	if (zActive.value) return '';
	if (props.state !== 'idle') return i18n.t('plugins.WorkshopPrinting.pid.the_machine_has_to_be_idle');
	if (inProgress.value) return i18n.t('plugins.WorkshopPrinting.pid.a_heater_is_already_being_tuned');
	if (zonesSel.value.some(z => z.state === 'fault')) return i18n.t('plugins.WorkshopPrinting.pid.a_zone_is_in_fault_check');
	return '';
})

const textPhaseZ = computed(() => {
	const e = zState.value || {};
	const zs = e.zones || [];
	const z = e.zone_current != null ? zs[e.zone_current] : null;
	if (!z) return i18n.t('plugins.WorkshopPrinting.pid.preparing');
	const nom = nameZ(z.h) + ' ' + i18n.t('plugins.WorkshopPrinting.pid.n_of_total_paren', { n: e.zone_current + 1, total: zs.length });
	const cold = Math.round(z.t - (e.margin_cold || 25));
	if (e.phase === 'calibrando') return i18n.t('plugins.WorkshopPrinting.pid.phase_tuning', { zone: nom });
	if (e.phase === 'waiting') {
		if (zs.length === 1) return i18n.t('plugins.WorkshopPrinting.pid.phase_waiting_cool', { zone: nom, c: cold });
		const missing = [];
		if (!e.neighbors_lists) missing.push(i18n.t('plugins.WorkshopPrinting.pid.wait_neighbours'));
		if (!e.zone_cold) missing.push(i18n.t('plugins.WorkshopPrinting.pid.wait_zone_cool', { c: cold }));
		return i18n.t('plugins.WorkshopPrinting.pid.phase_waiting_for', { zone: nom, what: missing.length ? missing.join(' ' + i18n.t('plugins.WorkshopPrinting.pid.and') + ' ') : i18n.t('plugins.WorkshopPrinting.pid.the_temperature_to_settle') });
	}
	return i18n.t('plugins.WorkshopPrinting.pid.phase_preparing', { zone: nom });
})

const minutesZ = computed(() => {
	const e = zState.value;
	return e && e.since ? Math.max(0, Math.round(((e.now || Date.now() / 1000) - e.since) / 60)) : 0;
})

const zErrors = computed(() => {
	return ((zState.value && zState.value.zones) || []).filter(z => z.error);
})

const linesZ = computed(() => {
	const zs = (zState.value && zState.value.zones) || [];
	const out = [];
	zs.forEach(z => {
		if (z.result !== 'ok' || !z.model) return;
		const l = lineSince(z.h, z.model, eOf(z.h));
		if (l) out.push({ h: z.h, line: l });
	});
	return out;
})

const eLine = computed(() => {
	const m = lineFile.value.match(/\bE([\d.]+)/);
	return m ? m[1] : '1.35';
})

const line = computed(() => {
	return chosen.value && modelTxt.value ? lineSince(chosen.value.id, modelTxt.value, eLine.value) : null;
})

watch(msg, (v) => {
	if (v) failure.value = null;
})

watch(options, (o) => {
		if (!o.find(h => h.id === which.value) && o.length) {
			which.value = o[0].id;
			// the watcher of which one does not exist yet in the first round (immediate): the
			// temperature according to the type is set here (2026-10-11: the bed ended up at 200 °C)
			const h = o[0];
			temp.value = h.paper === 'bed' ? 60 : h.paper === 'camera' ? 45 : 200;
		}
	}, { immediate: true })

watch(which, () => {
	const h = chosen.value;
	if (h) temp.value = h.paper === 'bed' ? 60 : h.paper === 'camera' ? 45 : 200;
	readModel();
})

watch(toolsZones, (t) => {
		if (!t.includes(toolZ.value) && t.length) toolZ.value = props.tool && t.includes(props.tool.number) ? props.tool.number : t[0];
	}, { immediate: true })

watch(zonesSel, () => {
		targetsPerDefault(false);
	}, { immediate: true })

async function readTrace() {
	if (destroyed) return;
	try {
		const r = await api('pid.trace', {}, { quiet: true, noLogin: true });
		const raw = r && r.trace;
		const h = raw ? props.heaters.find(x => x.id === raw.heater) : null;
		const mine = startedHere && raw && startedHere.id === raw.heater && raw.started_at * 1000 >= startedHere.at - 15000;
		trace.value = fromService(raw, h ? h.name : '', mine ? startedHere.temp : 0);
	} catch (e) {
		/* the chart keeps what it had */
	}
}
// every 3 s while a tuning goes on (or the last answer says it does), every 15 s otherwise, and never with the page hidden
function followTrace() {
	if (document.hidden) return;
	traceTick++;
	if (inProgress.value || (trace.value && !trace.value.endedAt) || traceTick % 5 === 1) readTrace();
}

watch(inProgress, (v) => {
	// when the calibration ends, read the new model (the all-zones one notifies by itself)
	if (zActive.value) {
		wasCalibrating.value = false;
		return;
	}
	if (v) wasCalibrating.value = true;
	else if (wasCalibrating.value) {
		wasCalibrating.value = false;
		msgKind.value = 'success';
		msg.value = i18n.t('plugins.WorkshopPrinting.pid.tuning_finished_check_the_new_model');
		setTimeout(() => readModel(), 1500);
	}
})

onMounted(async () => {
	readTrace();
	traceTimer = setInterval(followTrace, 3000);
	cfgImp.value = (await readJson(CFG_FILE, {})) || {};
	targetsPerDefault(false);
	// in case one was left running (the Pi continues it even if the page is closed)
	readStateZ();
})

onBeforeUnmount(() => {
	clearInterval(traceTimer);
	destroyed = true;
	clearTimeout(timer);
	clearTimeout(probing);
})

// a failed step: a missing role / PIN / service is shown with ErrorNotice (what role is needed, the PIN dialog); the rest keeps its text
function fail(e, text) {
	if (isFriendly(e)) {
		failure.value = e;
		msg.value = null;
		return;
	}
	failure.value = null;
	msgKind.value = 'error';
	msg.value = text;
}

const flags = { armed, armedG, armedZ, armedZG }
function arm(flag) {
	flags[flag].value = true;
	clearTimeout(timer);
	timer = setTimeout(() => { armed.value = false; armedG.value = false; armedZ.value = false; armedZG.value = false; }, 4000);
}

async function readModel() {
	const h = chosen.value;
	if (!h || !props.isFff) return;
	try {
		const r = await sendCode({ code: `M307 H${h.id}`, log: false });
		modelTxt.value = String(r || '').trim();
		const text = await readText(MODE_FILE);
		const l = text.split(/\r?\n/).find(x => x.trim().startsWith(`M307 H${h.id} `));
		lineFile.value = l ? l.split(';')[0].trim() : '';
	} catch (e) {
		modelTxt.value = i18n.t('plugins.WorkshopPrinting.pid.could_not_read', { error: e.message || String(e) });
	}
}

// Level 4 (DESIGN.md): it heats and cools by itself for several minutes. Notice with
// warnings and a checkbox; while it lasts, the Pi marks it as an active risk
// (red bar and LEDs) because it sees the heater in "tuning".
function touch() {
	const t = window.__workshop && window.__workshop.confirmLevel4;
	if (!t) {
		if (!armed.value) return arm('armed');
		armed.value = false;
		return calibrate();
	}
	const h = chosen.value;
	t({
		title: i18n.t('plugins.WorkshopPrinting.pid.tune_pid_title', { name: h.name, c: Math.round(temp.value) }),
		notices: [
			i18n.t('plugins.WorkshopPrinting.pid.the_heater_goes_up_and_down'),
			i18n.t('plugins.WorkshopPrinting.pid.while_it_lasts_no_job_controls'),
			i18n.t('plugins.WorkshopPrinting.pid.the_nozzle_and_the_bed_get'),
			i18n.t('plugins.WorkshopPrinting.pid.to_stop_status_turn_off_all')
		],
		understood: i18n.t('plugins.WorkshopPrinting.pid.understood_i_stay_next_to_the'),
		button: i18n.t('plugins.WorkshopPrinting.pid.tune')
	}).then(ok => { if (ok) calibrate(); });
}

async function calibrate() {
	const h = chosen.value;
	const t = Math.round(temp.value);
	// a single zone: by the tool (RRF uses its fan); several zones (pellet): one at a time
	const zones = props.heaters.filter(x => x.paper === 'nozzle' && x.tool === h.tool).length;
	const code = h.paper === 'nozzle' && zones === 1 && h.tool != null ? `M303 T${h.tool} S${t}` : `M303 H${h.id} S${t}`;
	startedHere = { id: h.id, temp: t, at: Date.now() };
	try {
		const r = await sendCode({ code, log: true });
		if (isError(r)) throw new Error(r);
		msgKind.value = 'info';
		msg.value = i18n.t('plugins.WorkshopPrinting.pid.tuning_started', { name: h.name.toLowerCase(), c: t });
	} catch (e) {
		fail(e, i18n.t('plugins.WorkshopPrinting.pid.could_not_start', { error: e.message || String(e) }));
	}
}

function touchSave() {
	if (!armedG.value) return arm('armedG');
	armedG.value = false;
	save();
}

// ---- all the zones (2026-10-11) ----
function nameZ(h) {
	const c = props.heaters.find(x => x.id === h);
	return c ? c.name : i18n.t('plugins.WorkshopPrinting.pid.heater_n', { n: h });
}

function tempZOk(z) {
	const t = Number(objZ.value[z.id]);
	return Number.isFinite(t) && t >= 50 && t < z.max;
}

// Target of each zone: the one it has now if it is on; otherwise, that of the
// last material (zone 1) plus its staging (Pellet); otherwise, the tool's active one.
function targetsPerDefault(pisar) {
	const cfg = cfgImp.value || {};
	const mats = Array.isArray(cfg.materials) && cfg.materials.length ? cfg.materials : MATERIALS_DEF;
	const mat = mats.find(m => m.name === cfg.last);
	const esc = cfg.step || {};
	const t = props.tool && props.tool.number === toolZ.value ? props.tool : null;
	const obj = Object.assign({}, objZ.value);
	zonesSel.value.forEach(z => {
		if (!pisar && obj[z.id] != null) return;
		let v = z.target > 0 ? z.target : null;
		if (v == null && mat) v = Math.round(mat.nozzle) + (z.zone > 0 ? Number(esc[z.id]) || 0 : 0);
		if (v == null && t && (t.active || [])[z.zone] > 0) v = t.active[z.zone];
		if (v == null) v = 200;
		if (z.max) v = Math.min(v, z.max - 5);
		obj[z.id] = Math.round(v);
	});
	objZ.value = obj;
}

function chipZ(h) {
	const zs = (zState.value && zState.value.zones) || [];
	const z = zs.find(x => x.h === h);
	if (!z) return { text: '-', color: 'grey' };
	if (zCurrent.value === h) return { text: i18n.t('plugins.WorkshopPrinting.pid.running'), color: 'error' };
	return {
		ok: { text: i18n.t('plugins.WorkshopPrinting.pid.done'), color: 'success' },
		failure: { text: i18n.t('plugins.WorkshopPrinting.pid.failed'), color: 'error' },
		cut: { text: i18n.t('plugins.WorkshopPrinting.pid.stopped'), color: 'grey-darken-1' },
		pending: { text: i18n.t('plugins.WorkshopPrinting.pid.pending'), color: 'grey' },
		in_progress: { text: i18n.t('plugins.WorkshopPrinting.pid.running'), color: 'error' }
	}[z.result] || { text: z.result, color: 'grey' };
}

function eOf(h) {
	const l = textMode.value.split(/\r?\n/).find(x => x.trim().startsWith(`M307 H${h} `));
	const m = l && l.split(';')[0].match(/\bE([\d.]+)/);
	return m ? m[1] : '1.35';
}

// API of WorkshopService pid.<op>: the JSON text of the service, or throws
async function m9003(op, args) {
	const r = String((await apiText('pid.' + op, args || {})) || '').trim();
	if (!r.startsWith('{') && isError(r)) throw new Error(r.replace(/^Error:\s*/i, ''));
	return r;
}

async function readStateZ() {
	clearTimeout(probing);
	const before = zActive.value;
	try {
		zState.value = JSON.parse(await m9003('status'));
		if (zState.value && zState.value.tool != null && (zActive.value || before)) toolZ.value = zState.value.tool;
		if (before && !zActive.value) await onFinishZ();
		else if (!zActive.value && linesZ.value.length && !textMode.value) textMode.value = await readText(MODE_FILE).catch(() => '');
	} catch (e) {
		// the service may not be there: it is retried by itself if it was running
	}
	if (zActive.value && !destroyed) probing = setTimeout(() => readStateZ(), 2000);
}

async function onFinishZ() {
	const e = zState.value || {};
	textMode.value = await readText(MODE_FILE).catch(() => '');
	if (e.phase === 'finished' && !e.error) {
		msgKind.value = 'success';
		msg.value = i18n.t('plugins.WorkshopPrinting.pid.tuning_of_all_zones_finished_check');
	} else if (e.phase === 'cancelled') {
		msgKind.value = 'info';
		msg.value = i18n.t('plugins.WorkshopPrinting.pid.zone_tuning_cancelled_the_zones_were');
	}
	readModel();
}

// Level 4 (DESIGN.md): it heats and cools by itself for a long time. The Pi
// opens the active risk "pid_zones" (red bar and LEDs) while it lasts.
function touchZones() {
	const t = window.__workshop && window.__workshop.confirmLevel4;
	if (!t) {
		if (!armedZ.value) return arm('armedZ');
		armedZ.value = false;
		return calibrateZones();
	}
	t({
		title: i18n.t('plugins.WorkshopPrinting.pid.tune_all_zones_title', { n: toolZ.value }),
		notices: [
			i18n.t('plugins.WorkshopPrinting.pid.all_zones_heat_to_their_target'),
			i18n.t('plugins.WorkshopPrinting.pid.while_it_lasts_no_job_controls'),
			i18n.t('plugins.WorkshopPrinting.pid.the_barrel_and_the_nozzle_get'),
			i18n.t('plugins.WorkshopPrinting.pid.to_stop_the_cancel_button_on')
		],
		understood: i18n.t('plugins.WorkshopPrinting.pid.understood_i_stay_next_to_the'),
		button: i18n.t('plugins.WorkshopPrinting.pid.tune_all')
	}).then(ok => { if (ok) calibrateZones(); });
}

async function calibrateZones() {
	const zonas = zonesSel.value.map(z => ({ h: z.id, t: Math.round(Number(objZ.value[z.id])) }));
	try {
		const r = await m9003('start', { tool: Number(toolZ.value), zones: zonas });
		if (!r.startsWith('{')) throw new Error(r);
		msgKind.value = 'info';
		msg.value = i18n.t('plugins.WorkshopPrinting.pid.tuning_of_all_zones_started_you');
	} catch (e) {
		fail(e, i18n.t('plugins.WorkshopPrinting.pid.could_not_start', { error: e.message || String(e) }));
	}
	readStateZ();
}

// Cancelar es seguro (apaga): un toque, siempre disponible mientras corre.
async function cancelZones() {
	cancellingZ.value = true;
	try {
		await m9003('cancel');
	} catch (e) {
		fail(e, i18n.t('plugins.WorkshopPrinting.pid.could_not_cancel_use', { error: e.message || String(e) }));
	} finally {
		cancellingZ.value = false;
		readStateZ();
	}
}

function touchSaveZones() {
	if (!armedZG.value) return arm('armedZG');
	armedZG.value = false;
	saveZones();
}

// All the M307 lines at once: a single .bak copy and a single write.
// If a zone has no M307 line, it is added after the last M307.
async function saveZones() {
	if (!atLeast(NEED.configure)) return; // writes modefff.g
	savingZ.value = true;
	try {
		const lista = linesZ.value.slice();
		const text = await readText(MODE_FILE);
		const r = replaceM307Lines(text, lista);
		const lineas = r.lines;
		const added = r.added;
		const sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
		await writeText(MODE_FILE + '.bak-' + sello, text);
		await writeText(MODE_FILE, r.text);
		textMode.value = lineas.join('\n');
		msgKind.value = 'success';
		msg.value = i18n.t('plugins.WorkshopPrinting.pid.saved_n_lines', { n: lista.length, stamp: sello }) +
			(added.length ? ' ' + i18n.t('plugins.WorkshopPrinting.pid.lines_added', { list: added.map(h => 'H' + h).join(', ') }) : '');
		markStartup('pid_nozzle', true, lista.map(l => l.line).join(' | ')).catch(() => {});
		rememberForNozzle({ pid: lista.reduce((o, l) => { o[l.h] = l.line; return o; }, {}) });
		note(sendCode, 'calibration', i18n.t('plugins.WorkshopPrinting.pid.log_all_zones_saved', { lines: lista.map(l => l.line).join(' | ') }));
		await readModel();
	} catch (e) {
		fail(e, i18n.t('plugins.WorkshopPrinting.common.could_not_save') + (e.message || e));
	} finally {
		savingZ.value = false;
	}
}

async function save() {
	if (!atLeast(NEED.configure)) return; // writes modefff.g
	saving.value = true;
	try {
		const r = await changeLineMode(`M307 H${chosen.value.id} `, line.value);
		msgKind.value = 'success';
		msg.value = i18n.t('plugins.WorkshopPrinting.pid.saved_before', { before: r.before.split(';')[0].trim() });
		markStartup('pid_' + chosen.value.paper, true, line.value).catch(() => {});
		if (chosen.value.paper === 'nozzle') rememberForNozzle({ pid: { [chosen.value.id]: line.value } });
		note(sendCode, 'calibration', i18n.t('plugins.WorkshopPrinting.pid.log_saved', { name: chosen.value.name, line: line.value }));
		await readModel();
	} catch (e) {
		fail(e, i18n.t('plugins.WorkshopPrinting.common.could_not_save') + (e.message || e));
	} finally {
		saving.value = false;
	}
}
defineExpose({ which }) // Print.vue picks the heater to tune from the pellet panel
</script>

<style scoped>
.zone-current {
	background: rgba(198, 40, 40, 0.08);
}
.explica {
	background: rgba(25, 118, 210, 0.08);
	border-radius: 6px;
	padding: 8px 12px;
}
</style>
