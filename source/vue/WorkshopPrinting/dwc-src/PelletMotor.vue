<template>
	<!-- the motion of the extruder motor: acceleration, jerk and top speed are SHOWN here and changed in Machine > Motion (plan with preview, backup and history);
	     the retraction is applied now and WRITTEN in modefff.g. Machine is another plugin: without it (not installed or not enabled) nothing about it is shown (no button,
	     no name in the texts: the variants _no_machine) -->
	<v-card variant="outlined" class="pa-3">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon size="small">mdi-engine-outline</v-icon>
			<span class="text-title-medium">{{ $t('plugins.WorkshopPrinting.pellet.asst_title') }}</span>
		</div>
		<div class="text-body-small text-medium-emphasis mt-1">{{ machineOn ? $t('plugins.WorkshopPrinting.pellet.asst_intro') : $t('plugins.WorkshopPrinting.pellet.asst_intro_no_machine') }}</div>

		<div class="text-title-small mt-3">{{ $t('plugins.WorkshopPrinting.pellet.asst_machine_title') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ machineOn ? $t('plugins.WorkshopPrinting.pellet.asst_machine_help') : $t('plugins.WorkshopPrinting.pellet.asst_machine_help_no_machine') }}</div>
		<div v-if="!editable || !machineOn" class="text-body-small text-warning mt-1">{{ machineOn ? $t('plugins.WorkshopPrinting.pellet.asst_machine_first_only', { n: index }) : $t('plugins.WorkshopPrinting.pellet.asst_machine_first_only_no_machine', { n: index }) }}</div>
		<div v-for="r in rows" :key="r.key" class="mt-3">
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<span class="text-body-medium">{{ $t('plugins.WorkshopPrinting.pellet.asst_' + r.key) }}</span>
				<span class="text-body-medium font-weight-medium">{{ now[r.key] === null ? '-' : now[r.key] }}</span>
				<span class="text-body-small text-medium-emphasis">{{ r.unit }}</span>
				<span v-if="r.perMin && now[r.key] !== null" class="text-body-small text-medium-emphasis">({{ machineOn ? $t('plugins.WorkshopPrinting.pellet.asst_per_min', { n: Math.round(now[r.key] * 60) }) : $t('plugins.WorkshopPrinting.pellet.asst_per_min_no_machine', { n: Math.round(now[r.key] * 60) }) }})</span>
				<v-btn v-if="editable && machineOn" size="x-small" variant="outlined" :disabled="!configure" @click="openMachine(r.key)">
					<v-icon size="x-small" start>mdi-open-in-new</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.asst_machine_open') }}
				</v-btn>
			</div>
			<div class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pellet.asst_' + r.key + '_help') }}</div>
		</div>

		<div class="text-title-small mt-3">{{ $t('plugins.WorkshopPrinting.pellet.asst_presets') }}</div>
		<div v-for="p in presets" :key="p.id" class="text-body-small mt-1" :class="{ 'font-weight-medium': current && current.id === p.id }">
			{{ $t('plugins.WorkshopPrinting.pellet.asst_preset_' + p.id) }}: {{ $t('plugins.WorkshopPrinting.pellet.asst_preset_values', presetValues(p)) }}
		</div>
		<div class="text-body-small text-medium-emphasis mt-1">{{ current ? $t('plugins.WorkshopPrinting.pellet.asst_preset_' + current.id + '_note') : $t('plugins.WorkshopPrinting.pellet.asst_preset_none') }}</div>

		<div class="text-title-small mt-4">{{ $t('plugins.WorkshopPrinting.pellet.asst_retract_title') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pellet.asst_retract_help') }}</div>
		<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
			<span class="text-body-medium">{{ $t('plugins.WorkshopPrinting.pellet.asst_retractLength') }}</span>
			<input v-model.number="form.retractLength" type="number" step="0.1" :min="limits.retractLength.min" :max="limits.retractLength.max" class="field" :disabled="!configure" /> mm
			<template v-if="form.retractLength > 0">
				<span class="text-body-medium">{{ $t('plugins.WorkshopPrinting.pellet.asst_retractSpeed') }}</span>
				<input v-model.number="form.retractSpeed" type="number" step="1" :min="limits.retractSpeed.min" :max="limits.retractSpeed.max" class="field" :disabled="!configure" /> mm/s
			</template>
		</div>
		<div v-if="form.retractLength > 0 && !retract.ok" class="text-body-small text-warning mt-1">{{ $t('plugins.WorkshopPrinting.pellet.asst_retract_cold', { limit: retract.limit, cold: retract.cold.join(', ') }) }}</div>
		<div v-else-if="form.retractLength > 0" class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopPrinting.pellet.asst_retract_g10') }}</div>

		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn size="small" :color="armed === 'apply' ? 'amber-darken-3' : 'primary'" :loading="saving" :disabled="!configure" @click="arm('apply', apply)">
				{{ armed === 'apply' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.asst_apply') }}
			</v-btn>
			<v-btn size="small" variant="outlined" @click="$emit('goto', { section: 'pellet' })"><v-icon size="small" start>mdi-flask-outline</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.asst_test') }}</v-btn>
		</div>
		<div class="text-body-small text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.pellet.asst_note') }}</div>
	</v-card>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { changeOAddLineMode, note } from './util.js'
import { LIMITS, PRESETS, fromModel, presetOf, normalizeRetract, retractPlan, retractCheck, machineRoute, machineEditable } from './motor-assist.js'
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { i18n } from './dwc-host.js'
import { pluginActive } from './workshop-ids.js' // vue/_shared: Machine is another plugin, nothing about it when it is absent

const props = defineProps({
	busy: { type: Boolean, default: false },
	configure: { type: Boolean, default: false }, // the role writes the configuration (technician) and the setup view
	extruders: { type: Array, default: () => [] }, // model.move.extruders
	index: { type: Number, default: 0 }, // the extruder of the tool
	coldRetract: { type: Number, default: 0 }, // model.heat.coldRetractTemperature
	targets: { type: Array, default: () => [] } // active temperature of each heater of the tool
})

const emit = defineEmits(['msg', 'saved', 'goto'])

const router = useRouter()
const limits = LIMITS
const presets = PRESETS
const rows = [
	{ key: 'accel', unit: 'mm/s²' },
	{ key: 'jerk', unit: 'mm/min' },
	{ key: 'speed', unit: 'mm/s', perMin: true } // Machine's Motion module takes the speed in mm/min
]

const now = computed(() => fromModel(props.extruders[props.index]))
const editable = computed(() => machineEditable(props.index))
const machineOn = computed(() => pluginActive('machine'))
const form = ref({ retractLength: 0, retractSpeed: 20 })
const saving = ref(false)
const armed = ref(null)
const armedTimer = ref(null)

const current = computed(() => presetOf(now.value))
const retract = computed(() => retractCheck(props.coldRetract, props.targets))

onBeforeUnmount(() => {
	clearTimeout(armedTimer.value)
})

function arm(id, fn) {
	if (armed.value !== id) {
		armed.value = id
		clearTimeout(armedTimer.value)
		armedTimer.value = setTimeout(() => { armed.value = null }, 4000)
		return
	}
	armed.value = null
	fn()
}

// the numbers of a starting point as the text shows them (the speed also in mm/min, the unit Machine asks for)
function presetValues(p) {
	return Object.assign({ speedMin: Math.round(p.speed * 60) }, p)
}

// acceleration, jerk and top speed are changed in Machine (plan with preview, backup and history): this opens its Motion module on that parameter
function openMachine(key) {
	const route = machineRoute(key)
	if (route && router) router.push(route).catch(() => {})
}

function say(kind, text) {
	emit('msg', { kind, text })
}

async function apply() {
	if (saving.value || !props.configure) return
	saving.value = true
	try {
		if (props.busy) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy'))
		const v = normalizeRetract(form.value)
		if (!v.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.asst_err', { field: i18n.t('plugins.WorkshopPrinting.pellet.asst_' + v.field) }))
		const p = retractPlan(v.value)
		for (const code of p.codes) {
			const r = await sendCode({ code, log: true })
			if (/error|abort/i.test(r || '')) throw new Error(code + ': ' + r)
		}
		for (const l of p.lines) await changeOAddLineMode(l.start, l.text, 'M92 E')
		note(sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.asst_log', { codes: p.codes.join(' ') }))
		say('success', i18n.t('plugins.WorkshopPrinting.pellet.asst_saved'))
		emit('saved')
	} catch (e) {
		say('error', e.message || String(e))
	} finally {
		saving.value = false
	}
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
}
</style>
