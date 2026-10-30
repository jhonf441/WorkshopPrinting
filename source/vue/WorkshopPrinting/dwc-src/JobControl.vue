<template>
	<!-- Job control (2026-10-30): what a person touches while a print runs. Pause / resume / cancel send the codes DWC's own buttons
	     send; the live corrections (Z baby-stepping M290, speed M220, flow M221 of the tool's extruder) show what the board applies now
	     from the object model. Operator's (NEED.operate): every button is disabled below that role. Logic in job-control.js. -->
	<v-card variant="outlined" class="pa-3 job-control">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon size="small">mdi-play-pause</v-icon>
			<span class="text-title-medium">{{ t('jobControl.title') }}</span>
			<v-chip size="small" variant="outlined">{{ stateText }}</v-chip>
		</div>
		<details class="wf-more mt-1">
			<summary>{{ $t('plugins.WorkshopPrinting.common.how_it_works') }}</summary>
			<p>{{ t('jobControl.help_what') }} {{ t('jobControl.help_why') }} {{ t('jobControl.help_missing') }} {{ t('jobControl.help_how') }}</p>
		</details>
		<v-alert v-if="!isFff" density="compact" variant="tonal" type="info" class="mt-2 mb-0">{{ t('jobControl.only_fff') }}</v-alert>

		<!-- pause / resume / cancel: cancel ends the job for good, so it takes two taps (DESIGN.md 5: danger = red outline, armed = filled) -->
		<div class="text-title-small mt-3">{{ t('jobControl.job_title') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ t('jobControl.job_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<v-btn size="small" color="primary" :disabled="!buttons.pause || !canOperate || sending" @click="job('pause')">
				<v-icon size="small" start>mdi-pause</v-icon>{{ t('jobControl.pause') }}
			</v-btn>
			<v-btn size="small" color="primary" :disabled="!buttons.resume || !canOperate || sending" @click="job('resume')">
				<v-icon size="small" start>mdi-play</v-icon>{{ t('jobControl.resume') }}
			</v-btn>
			<v-btn size="small" color="error" :variant="armed === 'cancel' ? 'elevated' : 'outlined'" :disabled="!buttons.cancel || !canOperate || sending" @click="arm('cancel', () => job('cancel'))">
				<v-icon size="small" start>mdi-stop</v-icon>{{ armed === 'cancel' ? t('jobControl.cancel_again') : t('jobControl.cancel') }}
			</v-btn>
			<span v-if="jobReason" class="text-body-small text-medium-emphasis">{{ jobReason }}</span>
		</div>

		<!-- Z baby-stepping: steps of hundredths, one tap each (DWC's own buttons work the same); the sum is capped by job-control.js and
		     the reset can move up to that cap at once, so it takes two taps -->
		<div class="text-title-small mt-4">{{ t('jobControl.baby_title') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ t('jobControl.baby_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<v-btn v-for="s in steps" :key="s" size="small" variant="outlined" :disabled="!isFff || !babyStepCode(s, babyNow) || !canOperate || sending" @click="baby(s)">
				{{ (s > 0 ? '+' : '') + s.toFixed(2) }}
			</v-btn>
			<span class="text-body-medium">{{ t('jobControl.baby_now') }} <b class="mono">{{ babyText }}</b></span>
			<v-btn size="x-small" :variant="armed === 'baby0' ? 'elevated' : 'text'" :color="armed === 'baby0' ? 'amber-darken-3' : undefined" :disabled="!isFff || babyNow === null || Math.abs(babyNow) < 0.005 || !canOperate || sending" @click="arm('baby0', babyReset)">
				{{ armed === 'baby0' ? t('jobControl.baby_reset_again') : t('jobControl.baby_reset') }}
			</v-btn>
		</div>
		<div class="text-body-small text-medium-emphasis mt-1">{{ t('jobControl.baby_limit', { limit: babyLimit }) }}</div>

		<!-- speed and flow factors: percentages over what the file asks; "now" is what the board reports -->
		<div class="text-title-small mt-4">{{ t('jobControl.factors_title') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ t('jobControl.speed_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<span class="text-body-medium">{{ t('jobControl.speed') }}</span>
			<input v-model.number="speedNew" type="number" step="5" :min="speedLimits.min" :max="speedLimits.max" class="field" :disabled="!canOperate" /> %
			<v-btn size="x-small" variant="outlined" :disabled="!isFff || !speedCode(speedNew) || !canOperate || sending" @click="applySpeed(speedNew)">{{ t('jobControl.apply') }}</v-btn>
			<v-btn size="x-small" variant="text" :disabled="!isFff || factors.speed === 100 || !canOperate || sending" @click="applySpeed(100)">100 %</v-btn>
			<span class="text-body-small text-medium-emphasis">{{ t('jobControl.now_pct', { n: factors.speed === null ? '--' : factors.speed }) }}</span>
		</div>
		<div class="text-body-small text-medium-emphasis mt-2">{{ t('jobControl.flow_help') }}</div>
		<div v-for="f in factors.flows" :key="f.extruder" class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<span class="text-body-medium">{{ t('jobControl.flow_e', { n: f.extruder }) }}</span>
			<input v-model.number="flowNew[f.extruder]" type="number" step="1" :min="flowLimits.min" :max="flowLimits.max" class="field" :disabled="!canOperate" /> %
			<v-btn size="x-small" variant="outlined" :disabled="!isFff || !flowCode(flowNew[f.extruder], f.extruder) || !canOperate || sending" @click="applyFlow(f.extruder, flowNew[f.extruder])">{{ t('jobControl.apply') }}</v-btn>
			<v-btn size="x-small" variant="text" :disabled="!isFff || f.percent === 100 || !canOperate || sending" @click="applyFlow(f.extruder, 100)">100 %</v-btn>
			<span class="text-body-small text-medium-emphasis">{{ t('jobControl.now_pct', { n: f.percent === null ? '--' : f.percent }) }}</span>
		</div>
		<div v-if="!factors.flows.length" class="text-body-small text-medium-emphasis mt-1">{{ t('jobControl.no_extruder') }}</div>
		<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>
	</v-card>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { BABY_LIMIT, BABY_STEPS, FLOW_LIMITS, SPEED_LIMITS, babyResetCode, babyStepCode, babyStepNow, babyStepText, factorsNow, flowCode, jobButtons, jobCode, jobRunning, speedCode } from './job-control.js'
import { TZ_FFF_STATES } from './fff-temps.js' // the translated names of the machine states (fff.st_<state>)
import { isError } from './util.js'
import { jobInLive } from './machine-free.js' // a live job (program through the bridge) has its controls in the Jog bar (vue/_shared)
import { NEED } from './print-sections.js'
import { useRole } from './use-role.js' // what the role may do (vue/_shared)
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { machineModel, i18n } from './dwc-host.js'

const props = defineProps({
	isFff: { type: Boolean, default: false }
})

const { atLeast } = useRole()

const steps = BABY_STEPS
const babyLimit = BABY_LIMIT
const speedLimits = SPEED_LIMITS
const flowLimits = FLOW_LIMITS

const speedNew = ref(100)
const flowNew = ref({})
const armed = ref(null)
const armedTimer = ref(null)
const sending = ref(false)
const msg = ref(null)
const msgKind = ref('info')

// pausing, cancelling, a Z step or a factor: an operator's, like heating a zone (NEED, print-sections.js)
const canOperate = computed(() => {
	return atLeast(NEED.operate);
})

const model = computed(() => {
	return machineModel();
})

const status = computed(() => {
	return (model.value.state && model.value.state.status) || '';
})

const live = computed(() => {
	return !!jobInLive(model.value);
})

// the tool the machine has now: the one that prints
const tool = computed(() => {
	const n = model.value.state && model.value.state.currentTool;
	return (model.value.tools || []).find(t => t && t.number === n) || null;
})

const buttons = computed(() => {
	return jobButtons(status.value, live.value);
})

const stateText = computed(() => {
	const s = status.value;
	return s ? (TZ_FFF_STATES[s] ? t('fff.st_' + s) : s) : '--';
})

// why the three buttons are grey (DESIGN.md 5: the reason written)
const jobReason = computed(() => {
	if (!canOperate.value) return t('jobControl.needs_operator');
	if (live.value) return t('jobControl.live_job');
	if (!jobRunning(status.value)) return t('jobControl.no_job');
	return '';
})

const babyNow = computed(() => {
	return babyStepNow(model.value);
})

const babyText = computed(() => {
	return babyStepText(babyNow.value);
})

const factors = computed(() => {
	return factorsNow(model.value, tool.value);
})

// the fields start with what the board applies (once per extruder, when the model says it)
let speedFilled = false
watch(factors, (f) => {
	if (f.speed !== null && !speedFilled) { speedFilled = true; speedNew.value = f.speed; }
	f.flows.forEach(x => { if (x.percent !== null && flowNew.value[x.extruder] === undefined) flowNew.value[x.extruder] = x.percent; });
}, { immediate: true })

onBeforeUnmount(() => {
	clearTimeout(armedTimer.value);
})

function t(key, params) {
	return i18n.t('plugins.WorkshopPrinting.' + key, params);
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
	if (!canOperate.value || sending.value) return;
	sending.value = true;
	msg.value = null;
	try {
		for (const c of codes) {
			const r = await sendCode({ code: c, log: true });
			if (isError(r)) throw new Error(r);
		}
		msgKind.value = 'success';
		msg.value = okText;
	} catch (e) {
		msgKind.value = 'error';
		msg.value = t('jobControl.could_not', { error: e.message || String(e) });
	} finally {
		sending.value = false;
	}
}

function job(action) {
	const code = jobCode(action);
	if (!code || !buttons.value[action]) return;
	run([code], t('jobControl.sent', { code }));
}

function baby(step) {
	const code = babyStepCode(step, babyNow.value);
	if (!code) return;
	run([code], t('jobControl.baby_set', { delta: (step > 0 ? '+' : '') + step.toFixed(2), sum: babyStepText((babyNow.value || 0) + step) }));
}

function babyReset() {
	run([babyResetCode()], t('jobControl.baby_zero'));
}

function applySpeed(percent) {
	const code = speedCode(percent);
	if (!code) return;
	speedNew.value = Math.round(percent);
	run([code], t('jobControl.speed_set', { n: Math.round(percent) }));
}

function applyFlow(extruder, percent) {
	const code = flowCode(percent, extruder);
	if (!code) return;
	flowNew.value[extruder] = Math.round(percent);
	run([code], t('jobControl.flow_set', { e: extruder, n: Math.round(percent) }));
}
</script>

<style scoped>
.field {
	width: 72px;
	padding: 2px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
	font-variant-numeric: tabular-nums;
}
.mono {
	font-family: var(--tp-font-mono, monospace);
}
</style>
