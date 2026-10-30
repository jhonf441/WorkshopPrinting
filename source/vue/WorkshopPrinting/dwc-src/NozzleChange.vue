<template>
	<!-- Nozzle change of the pellet extruder (technician): guided steps (hot, because the pellet inside is hard when cold) and what has to be
	     done again afterwards, since the firmware does not know the diameter. -->
	<v-card variant="outlined" class="pa-3">
		<div class="text-title-medium">{{ $t('plugins.WorkshopPrinting.nozzle.title') }}</div>
		<div class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.nozzle.intro') }}</div>
		<div class="text-body-medium mt-2">
			{{ saved > 0 ? $t('plugins.WorkshopPrinting.nozzle.current_size', { d: saved }) : $t('plugins.WorkshopPrinting.nozzle.no_size_saved') }}
		</div>

		<!-- no nozzle registered yet: what the machine has now was calibrated with the nozzle that is fitted; asking its diameter keeps it as its profile -->
		<v-card v-if="!(saved > 0)" variant="outlined" class="pa-3 mt-2">
			<div class="text-body-medium font-weight-medium">{{ $t('plugins.WorkshopPrinting.nozzle.first_title') }}</div>
			<div class="text-body-small">{{ $t('plugins.WorkshopPrinting.nozzle.first_intro') }}</div>
			<div class="d-flex flex-wrap align-center mt-2" style="gap:12px">
				<v-text-field v-model.number="firstD" type="number" step="0.05" min="0.2" max="8" density="compact" variant="outlined" hide-details style="max-width:190px"
					:label="$t('plugins.WorkshopPrinting.nozzle.fitted_diameter')" suffix="mm" :disabled="!configure || busyHere" />
				<v-btn size="small" color="primary" :disabled="!configure || !validFirst || busyHere" :loading="running === 'first'" @click="registerCurrent">{{ $t('plugins.WorkshopPrinting.nozzle.first_button') }}</v-btn>
			</div>
			<div v-if="!configure" class="text-body-small text-warning mt-1">{{ $t('plugins.WorkshopPrinting.nozzle.only_technician') }}</div>
			<v-alert v-if="firstMsg" density="compact" variant="tonal" :type="firstKind" class="mt-2 mb-0">{{ firstMsg }}</v-alert>
		</v-card>

		<!-- what was calibrated with each nozzle (the one fitted now first) -->
		<div class="mt-2">
			<div class="text-body-small font-weight-medium">{{ $t('plugins.WorkshopPrinting.nozzle.profiles_title') }}
				<v-btn icon size="x-small" :title="$t('plugins.WorkshopPrinting.nozzle.profiles_refresh')" @click="loadProfiles"><v-icon size="x-small">mdi-refresh</v-icon></v-btn>
			</div>
			<div v-if="!profileList.length" class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.nozzle.profiles_none') }}</div>
			<div v-for="p in profileList" :key="p.d" class="text-body-small" :class="{ 'font-weight-medium': p.active }">
				{{ p.d }} mm<span v-if="p.active"> ({{ $t('plugins.WorkshopPrinting.nozzle.profile_fitted') }})</span>, {{ p.date || '?' }}:
				<span v-for="(i, n) in p.items" :key="i.id">{{ n ? ' | ' : '' }}{{ $t('plugins.WorkshopPrinting.nozzle.profile_' + i.id) }} <code>{{ i.text }}</code></span>
			</div>
		</div>

		<div class="d-flex flex-wrap align-center mt-2" style="gap:12px">
			<v-text-field v-model.number="diameter" type="number" step="0.05" min="0.2" max="8" density="compact" variant="outlined" hide-details style="max-width:190px"
				:label="$t('plugins.WorkshopPrinting.nozzle.new_diameter')" suffix="mm" :disabled="busyHere" />
			<v-text-field v-model.number="temp" type="number" step="5" density="compact" variant="outlined" hide-details style="max-width:190px"
				:label="$t('plugins.WorkshopPrinting.nozzle.melt_temperature')" suffix="°C" :disabled="busyHere" />
		</div>
		<div v-if="diameter !== '' && !valid" class="text-body-small text-error mt-1">{{ $t('plugins.WorkshopPrinting.nozzle.invalid_diameter') }}</div>
		<div v-else-if="valid && change === 'same'" class="text-body-small text-warning mt-1">{{ $t('plugins.WorkshopPrinting.nozzle.same_diameter') }}</div>

		<template v-if="valid">
			<div class="mt-3">
				<div v-for="(p, k) in steps" :key="k" class="step" :class="{ done: done(k), current: k === next }">
					<div class="step-num"><v-icon v-if="done(k)" size="small" color="white">mdi-check</v-icon><span v-else>{{ k + 1 }}</span></div>
					<div class="step-body">
						<div class="text-body-medium" :class="{ 'font-weight-medium': k === next }">{{ p.text }}</div>
						<div v-if="p.detail" class="text-body-small text-medium-emphasis">{{ p.detail }}</div>
						<div class="mt-1">
							<v-checkbox v-if="p.kind === 'manual'" :model-value="done(k)" :disabled="k > next" density="compact" hide-details class="mt-0" :label="p.check" @update:model-value="mark(k, $event)" />
							<template v-else-if="p.kind === 'action'">
								<v-btn size="x-small" :color="done(k) ? '' : 'primary'" :variant="(done(k)) ? 'outlined' : 'elevated'" :disabled="k > next || busyHere || !!p.blocked" :loading="running === k" @click="run(k)">
									{{ done(k) ? $t('plugins.WorkshopPrinting.headChange.again') : p.button }}
								</v-btn>
								<span v-if="k === next && p.blocked" class="text-body-small text-warning ml-2">{{ p.blocked }}</span>
							</template>
							<div v-else-if="p.kind === 'auto'" class="text-body-small" :class="p.ok() ? 'text-success' : 'text-warning'">{{ p.state() }}</div>
						</div>
					</div>
				</div>
			</div>
			<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>

			<!-- what has to be done again with this diameter -->
			<div v-if="next >= steps.length" class="mt-4">
				<v-alert density="compact" variant="tonal" type="success">{{ $t('plugins.WorkshopPrinting.nozzle.saved_now_redo', { d: diameter }) }}</v-alert>
				<!-- a profile saved for this diameter: flow, PID and pressure advance come back with one tap -->
				<div v-if="profileItems.length && !restored.length" class="followup">
					<div class="text-body-medium font-weight-medium">{{ $t('plugins.WorkshopPrinting.nozzle.profile_title', { d: diameter }) }}</div>
					<div class="text-body-small">{{ $t('plugins.WorkshopPrinting.nozzle.profile_found', { date: profile.date || '?' }) }}</div>
					<div v-for="i in profileItems" :key="i.id" class="text-body-small"><b>{{ $t('plugins.WorkshopPrinting.nozzle.profile_' + i.id) }}</b>: <code>{{ i.text }}</code></div>
					<v-btn size="x-small" color="primary" class="mt-1" :disabled="!configure || busyHere" :loading="applying" @click="applySaved">{{ $t('plugins.WorkshopPrinting.nozzle.profile_apply') }}</v-btn>
					<span v-if="!configure" class="text-body-small text-warning ml-2">{{ $t('plugins.WorkshopPrinting.nozzle.only_technician') }}</span>
				</div>
				<div v-else-if="!restored.length && after && after.change !== 'same'" class="text-body-small text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.nozzle.profile_none', { d: diameter }) }}</div>
				<v-alert v-if="restored.length" density="compact" variant="tonal" type="success" class="mt-2 mb-0">{{ $t('plugins.WorkshopPrinting.nozzle.profile_applied', { list: restored.map(i => $t('plugins.WorkshopPrinting.nozzle.profile_' + i)).join(', ') }) }}</v-alert>
				<div v-if="after && after.snapshot" class="text-body-small text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.nozzle.profile_kept', { d: after.old }) }}</div>
				<div v-for="f in follow" :key="f.id" class="followup">
					<div class="text-body-medium font-weight-medium">{{ $t('plugins.WorkshopPrinting.nozzle.follow_' + f.id + '_title') }}</div>
					<div class="text-body-small">{{ $t('plugins.WorkshopPrinting.nozzle.follow_' + f.id, limits) }}</div>
					<v-btn v-if="f.goto" size="x-small" variant="outlined" class="mt-1" @click="$emit('goto', { section: f.goto })">{{ $t('plugins.WorkshopPrinting.nozzle.follow_' + f.id + '_go') }}</v-btn>
				</div>
			</div>
		</template>
	</v-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { isError, updateCfg, note } from './util.js'
import { nozzleState } from './nozzle-state.js'
import { validDiameter, sizeChange, slicerLimits, heatCode, offCode, followUps } from './nozzle-change.js'
import { getProfile, profileItems as itemsOfProfile } from './nozzle-profiles.js'
import { readProfiles, snapshotNozzle, applyProfile } from './nozzle-store.js'
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { i18n } from './dwc-host.js'

const props = defineProps({
	tool: { type: Object, default: null },
	zones: { type: Array, default: () => [] }, // heaters of the tool, nozzle first
	saved: { type: Number, default: 0 }, // diameter kept in printing.json (0: none)
	busy: { type: Boolean, default: false }, // a job runs
	configure: { type: Boolean, default: false }, // technician: the step that writes printing.json
	ext: { type: Object, default: null }, // the extruder of the tool in the model (steps per mm, pressure advance)
	extruder: { type: Number, default: 0 } // its number
})

const emit = defineEmits(['saved', 'goto'])

const diameter = ref('')
const temp = ref(200)
const doneMap = ref({})
const running = ref(null)
const msg = ref(null)
const msgKind = ref('info')
const nozzles = ref({})
const after = ref(null)
const restored = ref([])
const applying = ref(false)
const firstD = ref('')
const firstMsg = ref(null)
const firstKind = ref('success')

const valid = computed(() => {
	return validDiameter(diameter.value);
})

const change = computed(() => {
	return sizeChange(props.saved, diameter.value);
})

// the change as it was when the diameter was registered (after that the registered one is the new one)
const changeNow = computed(() => {
	return after.value ? after.value.change : change.value;
})

const validFirst = computed(() => {
	return validDiameter(firstD.value);
})

const profileList = computed(() => {
	return Object.keys(nozzles.value || {}).map(d => ({ d, active: Number(d) === Number(props.saved), date: nozzles.value[d].date, items: itemsOfProfile(nozzles.value[d]) }))
		.filter(p => p.items.length).sort((a, b) => (b.active - a.active) || (Number(a.d) - Number(b.d)));
})

const profile = computed(() => {
	return getProfile(nozzles.value, diameter.value);
})

const profileItems = computed(() => {
	return after.value && after.value.change !== 'same' ? itemsOfProfile(profile.value) : [];
})

const heaterIds = computed(() => {
	return props.zones.map(z => z.id);
})

const busyHere = computed(() => {
	return props.busy || running.value !== null;
})

const limits = computed(() => {
	return Object.assign({ d: diameter.value, old: after.value ? after.value.old : props.saved }, slicerLimits(valid.value ? diameter.value : 0));
})

const follow = computed(() => {
	const back = restored.value.map(i => (i === 'advance' ? 'pressure' : i));
	return followUps(changeNow.value).filter(f => !back.includes(f.id));
})

const nozzle = computed(() => {
	return props.zones[0] || null;
})

const steps = computed(() => {
	const t = props.tool ? props.tool.number : 0;
	const T = (k, o) => i18n.t('plugins.WorkshopPrinting.nozzle.' + k, o);
	const p = [{
		kind: 'action', text: T('step_heat', { c: temp.value }), detail: T('step_heat_detail'), button: T('heat'), codes: [heatCode(t, temp.value)],
		blocked: nozzle.value && temp.value > nozzle.value.max ? T('over_limit', { c: nozzle.value.max }) : ''
	}];
	// a sensor that is not connected reads -273 C: it can never show "hot", so the person checks it by hand
	if (nozzleState(nozzle.value, temp.value - 10) === 'unreadable') {
		p.push({ kind: 'manual', text: T('step_wait_hot', { c: temp.value - 10 }), check: T('hot_no_reading_check') });
	} else {
		p.push({
			kind: 'auto', text: T('step_wait_hot', { c: temp.value - 10 }), ok: () => nozzleState(nozzle.value, temp.value - 10) === 'hot',
			state: () => T('nozzle_at', { c: nozzle.value ? Math.round(nozzle.value.current) : '?' })
		});
	}
	p.push({ kind: 'manual', text: T('step_remove'), detail: T('step_remove_detail'), check: T('removed') });
	p.push({ kind: 'manual', text: T('step_fit', { d: diameter.value }), detail: T('step_fit_detail'), check: T('fitted') });
	p.push({ kind: 'action', text: T('step_off'), button: T('turn_off'), codes: [offCode(t)] });
	p.push({ kind: 'action', text: T('step_save', { d: diameter.value }), button: T('save'), save: true, blocked: props.configure ? '' : T('only_technician') });
	return p;
})

const next = computed(() => {
	for (let k = 0; k < steps.value.length; k++) if (!done(k)) return k;
	return steps.value.length;
})

loadProfiles();

// another diameter or temperature starts again: the steps depend on them
watch(diameter, () => { reset(); })

watch(temp, () => { reset(); })

watch(() => props.saved, () => { loadProfiles(); })

function reset() {
	doneMap.value = {};
	msg.value = null;
	after.value = null;
	restored.value = [];
}

// the nozzle fitted now was never registered: its diameter is asked once and what the machine has becomes its profile
async function registerCurrent() {
	if (!props.configure || busyHere.value || !validFirst.value) return;
	running.value = 'first';
	firstMsg.value = null;
	try {
		const d = Number(firstD.value);
		await snapshotNozzle(d, { steps: props.ext && props.ext.stepsPerMm, advance: props.ext && props.ext.pressureAdvance }, heaterIds.value);
		await updateCfg({ nozzleSize: d });
		note(sendCode, 'config', i18n.t('plugins.WorkshopPrinting.nozzle.log_first', { d }));
		await loadProfiles();
		emit('saved', d);
		firstKind.value = 'success';
		firstMsg.value = i18n.t('plugins.WorkshopPrinting.nozzle.first_done', { d });
	} catch (e) {
		firstKind.value = 'error';
		firstMsg.value = e.message || String(e);
	} finally {
		running.value = null;
	}
}

async function loadProfiles() {
	try {
		nozzles.value = (await readProfiles()).nozzles;
	} catch (e) {
		nozzles.value = {};
	}
}

// the technician puts the saved flow / PID / advance of this diameter back (runs them and writes modefff.g)
async function applySaved() {
	if (!props.configure || busyHere.value || !profile.value) return;
	applying.value = true;
	msg.value = null;
	try {
		const plan = await applyProfile(sendCode, profile.value, props.extruder, heaterIds.value);
		restored.value = plan.ids;
		note(sendCode, 'config', i18n.t('plugins.WorkshopPrinting.nozzle.log_profile_applied', { d: diameter.value, list: plan.codes.join(' | ') }));
	} catch (e) {
		msgKind.value = 'error';
		msg.value = i18n.t('plugins.WorkshopPrinting.nozzle.profile_apply') + ': ' + (e.message || e);
	} finally {
		applying.value = false;
	}
}

function done(k) {
	const p = steps.value[k];
	if (!p) return false;
	if (p.kind === 'auto') return p.ok();
	return !!doneMap.value[k];
}

function mark(k, v) {
	doneMap.value[k] = !!v;
	if (!v) Object.keys(doneMap.value).forEach(i => { if (+i > k) delete doneMap.value[i]; });
}

async function run(k) {
	const p = steps.value[k];
	if (!p || busyHere.value || p.blocked) return;
	running.value = k;
	msg.value = null;
	try {
		if (p.save) {
			if (!props.configure) return;
			// the nozzle that leaves keeps what it has now (steps, advance, PID), so it comes back with its own numbers
			const old = props.saved;
			const changeKind = change.value;
			let snapshot = false;
			if (old > 0 && changeKind !== 'same') {
				try {
					snapshot = await snapshotNozzle(old, { steps: props.ext && props.ext.stepsPerMm, advance: props.ext && props.ext.pressureAdvance }, heaterIds.value);
				} catch (e) {
					snapshot = false;
				}
			}
			await updateCfg({ nozzleSize: Number(diameter.value) });
			await loadProfiles();
			after.value = { change: changeKind, old, snapshot };
			note(sendCode, 'config', i18n.t('plugins.WorkshopPrinting.nozzle.log_changed', { old: props.saved || '?', d: diameter.value }));
			emit('saved', Number(diameter.value));
		} else {
			for (const c of p.codes) {
				const r = await sendCode({ code: c, log: true });
				if (isError(r)) throw new Error(r);
			}
		}
		doneMap.value[k] = true;
	} catch (e) {
		msgKind.value = 'error';
		msg.value = p.text + ': ' + (e.message || e);
	} finally {
		running.value = null;
	}
}
</script>

<style scoped>
.step { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.15); opacity: 0.6; }
.step.current, .step.done { opacity: 1; }
.step-num { flex: none; width: 24px; height: 24px; border-radius: 50%; background: #607d8b; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
.step.current .step-num { background: #1976d2; }
.step.done .step-num { background: #2e7d32; }
.step-body { flex: 1; min-width: 0; }
.followup { padding: 8px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.15); }
</style>
