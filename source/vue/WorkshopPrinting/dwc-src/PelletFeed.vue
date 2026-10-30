<template>
			<!-- feeding of the hopper: level sensor + feeding mechanism, by hand or automatic. READ the board, WRITE modefff.g -->
			<v-card v-if="feedForm" variant="outlined" class="pa-3">
				<div class="d-flex align-center flex-wrap" style="gap:8px">
					<v-icon size="small">mdi-grain</v-icon>
					<span class="text-title-medium">{{ $t('plugins.WorkshopPrinting.pellet.feed_title') }}</span>
					<span class="pc-state"><span class="pc-dot" :style="{ background: feedHmi.color }" />{{ feedHmi.levelText }}</span>
				</div>
				<div class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopPrinting.pellet.feed_intro') }}</div>
				<div v-if="!configure" class="text-body-medium mt-2">{{ feedForm.mode === 'auto' ? $t('plugins.WorkshopPrinting.pellet.feed_auto') : $t('plugins.WorkshopPrinting.pellet.feed_manual') }}</div>
				<v-btn-toggle v-if="configure" v-model="feedForm.mode" mandatory density="compact" color="primary" class="mt-2">
					<v-btn size="small" value="manual"><v-icon size="small" start>mdi-hand-back-right-outline</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.feed_manual') }}</v-btn>
					<v-btn size="small" value="auto" :disabled="!!feedAutoReason"><v-icon size="small" start>mdi-autorenew</v-icon>{{ $t('plugins.WorkshopPrinting.pellet.feed_auto') }}</v-btn>
				</v-btn-toggle>
				<div v-if="configure" class="text-body-small mt-1" :class="feedAutoReason ? 'text-warning' : 'text-medium-emphasis'">
					{{ feedAutoReason || (feedForm.mode === 'auto' ? $t('plugins.WorkshopPrinting.pellet.feed_auto_note') : $t('plugins.WorkshopPrinting.pellet.feed_manual_note')) }}
				</div>
				<v-divider class="my-3" />
				<div class="text-title-small">{{ $t('plugins.WorkshopPrinting.pellet.feed_sensor') }}</div>
				<div v-if="feedCfg.sensor && gpIn[feedCfg.sensor.index]" class="text-body-small">
					J{{ feedCfg.sensor.index }} · {{ feedCfg.sensor.pin || '?' }} · {{ $t('plugins.WorkshopPrinting.pellet.feed_value', { v: gpIn[feedCfg.sensor.index].value }) }}
				</div>
				<div v-else-if="feedCfg.sensor" class="text-body-small text-warning">{{ $t('plugins.WorkshopPrinting.pellet.feed_pending_reload') }}</div>
				<div v-else class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pellet.feed_no_sensor') }}</div>
				<div v-if="configure" class="d-flex align-center flex-wrap mt-1" style="gap:8px">
					<input v-model.trim="feedForm.sensorPin" class="field wide" placeholder="io3.in" />
					<select v-model.number="feedForm.present" class="field wide">
						<option :value="1">{{ $t('plugins.WorkshopPrinting.pellet.feed_present_1') }}</option>
						<option :value="0">{{ $t('plugins.WorkshopPrinting.pellet.feed_present_0') }}</option>
					</select>
				</div>
				<div class="text-title-small mt-3">{{ $t('plugins.WorkshopPrinting.pellet.feed_mechanism') }}</div>
				<div v-if="feedCfg.mechanism && gpOut[feedCfg.mechanism.index]" class="text-body-small">
					P{{ feedCfg.mechanism.index }} · {{ feedCfg.mechanism.pin || '?' }} · {{ Math.round((gpOut[feedCfg.mechanism.index].pwm || 0) * 100) }} %
				</div>
				<div v-else-if="feedCfg.mechanism" class="text-body-small text-warning">{{ $t('plugins.WorkshopPrinting.pellet.feed_pending_reload') }}</div>
				<div v-else class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopPrinting.pellet.feed_no_mechanism') }}</div>
				<div v-if="configure" class="d-flex align-center flex-wrap mt-1" style="gap:8px">
					<input v-model.trim="feedForm.mechPin" class="field wide" placeholder="out4" />
					<input v-model.number="feedForm.freq" type="number" min="1" max="5000" class="field" /> Hz
				</div>
				<div v-if="configure" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
					{{ $t('plugins.WorkshopPrinting.pellet.feed_run') }} <input v-model.number="feedForm.run_s" type="number" min="1" max="60" class="field" /> s
					{{ $t('plugins.WorkshopPrinting.pellet.feed_wait') }} <input v-model.number="feedForm.wait_s" type="number" min="0" max="600" class="field" /> s
					{{ $t('plugins.WorkshopPrinting.pellet.feed_max') }} <input v-model.number="feedForm.max_s" type="number" min="5" max="3600" class="field" /> s
				</div>
				<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
					<v-btn v-if="configure" size="small" :color="armed === 'feedsave' ? 'amber-darken-3' : 'primary'" :loading="feedSaving" @click="arm('feedsave', saveFeed)">
						{{ armed === 'feedsave' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.feed_save') }}
					</v-btn>
					<v-btn size="small" variant="outlined" :disabled="!feedReady || !canOperate" :color="armed === 'feednow' ? 'amber-darken-3' : undefined" @click="arm('feednow', feedNow)">
						<v-icon size="small" start>mdi-play</v-icon>{{ armed === 'feednow' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.feed_now', { s: feedForm.run_s }) }}
					</v-btn>
					<v-btn v-if="configure && (feedCfg.sensor || feedCfg.mechanism)" size="small" variant="text" color="error" @click="arm('feedrm', removeFeed)">
						{{ armed === 'feedrm' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.feed_remove') }}
					</v-btn>
				</div>
				<div v-if="configure" class="text-body-small text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.pellet.feed_save_note') }}</div>
			</v-card>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { MODE_FILE, readText, writeText, updateCfg, isError, note } from './util.js'
import { isFriendly } from './print-errors.js'
import { normalize as normFeed, hopperState, pinOk, pinInUse, nextFree, pulseCodes, definitionLines, triggerLine, triggerMacro, applyFeedToMode, nextTrigger, markedTrigger } from './pellet-feed.js'
import { confirmRisk } from './risk.js'
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { i18n } from './dwc-host.js'

const props = defineProps({
	config: { type: Object, default: null }, // what printing.json keeps ("feed")
	tool: { type: Object, default: null },
	busy: { type: Boolean, default: false },
	gpIn: { type: Array, default: () => [] },
	gpOut: { type: Array, default: () => [] },
	// F3-P: the form that writes modefff.g / printing.json is for a technician; an operator only sees the state and feeds now
	configure: { type: Boolean, default: true },
	canOperate: { type: Boolean, default: true }
})

const emit = defineEmits(['msg', 'saved', 'error'])

const feedForm = ref(null)
const feedSaving = ref(false)
const armed = ref(null)
const armedTimer = ref(null)

const feedCfg = computed(() => {
	return normFeed(props.config);
})

const feedHmi = computed(() => {
	const st = hopperState(feedCfg.value, props.gpIn);
	return { color: { full: '#2e7d32', empty: '#c62828', unknown: '#9e9e9e' }[st], levelText: i18n.t('plugins.WorkshopPrinting.pellet.feed_level_' + st) };
})

// what the form would leave defined, to say why automatic is not possible yet
const feedAutoReason = computed(() => {
	const f = feedForm.value;
	if (!f) return '';
	if (!pinOk(f.sensorPin)) return i18n.t('plugins.WorkshopPrinting.pellet.feed_need_sensor');
	if (!pinOk(f.mechPin)) return i18n.t('plugins.WorkshopPrinting.pellet.feed_need_mechanism');
	return '';
})

// the feeder is defined AND the board already has it (the mode was reloaded after saving)
const feedReady = computed(() => {
	const c = feedCfg.value;
	return !!c.mechanism && !!props.gpOut[c.mechanism.index];
})

seedFeed();

watch(() => props.config, () => { seedFeed(); })

onBeforeUnmount(() => {
	clearTimeout(armedTimer.value);
})

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

function say(kind, text) {
	emit('msg', { kind, text });
}

function seedFeed() {
	const c = feedCfg.value;
	feedForm.value = {
		mode: c.mode, sensorPin: (c.sensor && c.sensor.pin) || '', present: c.sensor ? c.sensor.present : 1,
		mechPin: (c.mechanism && c.mechanism.pin) || '', freq: c.mechanism ? c.mechanism.freq : 500, run_s: c.run_s, wait_s: c.wait_s, max_s: c.max_s
	};
}

// reads a text of the SD that may not exist
async function readOptional(path) {
	try {
		return await readText(path);
	} catch (e) {
		return '';
	}
}

// saves the feeding: printing.json, the lines of modefff.g and the trigger macro (automatic). Needs a mode reload
async function saveFeed() {
	const f = feedForm.value;
	if (!f || feedSaving.value || !props.configure) return;
	const tool = props.tool && props.tool.number;
	feedSaving.value = true;
	try {
		if (props.busy) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy'));
		const old = feedCfg.value;
		const sensorPin = f.sensorPin && f.sensorPin.trim(), mechPin = f.mechPin && f.mechPin.trim();
		if (sensorPin && !pinOk(sensorPin)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_pin', { pin: sensorPin }));
		if (mechPin && !pinOk(mechPin)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_pin', { pin: mechPin }));
		if (f.mode === 'auto' && !(sensorPin && mechPin)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_auto'));
		const texts = await Promise.all(['0:/sys/config.g', MODE_FILE, '0:/sys/modelaser.g', '0:/sys/modecnc.g'].map(p => readOptional(p)));
		[sensorPin, mechPin].filter(Boolean).forEach(p => { if (pinInUse(texts, p)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_pin_use', { pin: p })); });
		const inIdx = old.sensor ? old.sensor.index : nextFree(props.gpIn, 8);
		const outIdx = old.mechanism ? old.mechanism.index : nextFree(props.gpOut, 20);
		const next = normFeed({
			mode: f.mode, run_s: f.run_s, wait_s: f.wait_s, max_s: f.max_s,
			sensor: sensorPin ? { index: inIdx, present: f.present, pin: sensorPin } : null,
			mechanism: mechPin ? { index: outIdx, pin: mechPin, freq: f.freq } : null
		});
		const files = await listSys();
		const trig = markedTrigger(texts[1]) != null ? markedTrigger(texts[1]) : nextTrigger(files);
		if (next.mode === 'auto' && trig < 0) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_trigger'));
		const lines = definitionLines(next).concat(next.mode === 'auto' ? [triggerLine(next, trig)] : []);
		const r = applyFeedToMode(texts[1], tool, lines);
		if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_err_' + r.error));
		const ok = await confirmRisk({
			title: i18n.t('plugins.WorkshopPrinting.pellet.feed_confirm_title'),
			text: i18n.t('plugins.WorkshopPrinting.pellet.feed_confirm_text', { lines: lines.map(l => l.split(';')[0].trim()).join(' | ') || '-', mode: next.mode === 'auto' ? i18n.t('plugins.WorkshopPrinting.pellet.feed_auto') : i18n.t('plugins.WorkshopPrinting.pellet.feed_manual') })
		});
		if (!ok) return;
		const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
		if (r.text !== texts[1]) {
			await writeText(MODE_FILE + '.bak-' + stamp, texts[1]);
			await writeText(MODE_FILE, r.text);
		}
		if (next.mode === 'auto') await writeText('0:/sys/trigger' + trig + '.g', triggerMacro(next));
		else if (markedTrigger(texts[1]) != null) await writeText('0:/sys/trigger' + markedTrigger(texts[1]) + '.g', triggerMacro({}));
		await updateCfg({ feed: next });
		seedFeed();
		note(sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.feed_log', { mode: next.mode }));
		say('success', i18n.t('plugins.WorkshopPrinting.pellet.feed_saved', { stamp }));
		emit('saved', next);
	} catch (e) {
		if (isFriendly(e)) emit('error', e);
		else say('error', e.message || String(e));
	} finally {
		feedSaving.value = false;
	}
}

async function listSys() {
	try {
		const r = await fetch('/machine/directory/' + encodeURI('0:/sys'), { cache: 'no-store' });
		const l = r.ok ? await r.json() : [];
		return (Array.isArray(l) ? l : []).map(x => x && x.name);
	} catch (e) {
		return [];
	}
}

// forgets the feeding: the marked lines go away and the macro is left empty
async function removeFeed() {
	feedForm.value.sensorPin = '';
	feedForm.value.mechPin = '';
	feedForm.value.mode = 'manual';
	await saveFeed();
}

// one run of the mechanism by hand; the output is always switched off, also if something fails in the middle
async function feedNow() {
	const c = feedCfg.value;
	if (!feedReady.value) return;
	const p = pulseCodes(c.mechanism.index, feedForm.value.run_s);
	try {
		for (const code of [p.on, p.wait]) {
			const r = await sendCode({ code, log: true });
			if (isError(r)) throw new Error(r);
		}
		say('success', i18n.t('plugins.WorkshopPrinting.pellet.feed_pulsed', { s: feedForm.value.run_s }));
	} catch (e) {
		say('error', i18n.t('plugins.WorkshopPrinting.pellet.feed_pulse_error', { error: e.message || String(e) }));
	} finally {
		try { await sendCode({ code: p.off, log: true }); } catch (e) { /* the next run tries again */ }
	}
}
</script>

<style scoped>
.field {
	width: 64px;
	padding: 2px 5px;
	border: 1px solid rgba(128, 128, 128, 0.45);
	border-radius: 4px;
	color: inherit;
	background: transparent;
}
select.field.wide {
	width: 230px;
}
.field.wide {
	width: 120px;
}
</style>
