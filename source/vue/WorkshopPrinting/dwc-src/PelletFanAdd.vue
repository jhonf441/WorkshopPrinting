<template>
	<!-- adds a fan to the extruder from the panel: a part fan (joins the tool) or a throat fan (thermostatic). WRITES modefff.g -->
	<v-card variant="outlined" class="pa-3">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon size="small">mdi-fan-plus</v-icon>
			<span class="text-title-medium">{{ $t('plugins.WorkshopPrinting.pellet.newfan_title') }}</span>
		</div>
		<div class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopPrinting.pellet.newfan_intro') }}</div>
		<v-btn-toggle v-model="form.kind" mandatory density="compact" color="primary" class="mt-2">
			<v-btn size="small" value="part">{{ $t('plugins.WorkshopPrinting.pellet.newfan_part') }}</v-btn>
			<v-btn size="small" value="throat">{{ $t('plugins.WorkshopPrinting.pellet.newfan_throat') }}</v-btn>
		</v-btn-toggle>
		<div class="text-body-small text-medium-emphasis mt-1">{{ form.kind === 'throat' ? $t('plugins.WorkshopPrinting.pellet.newfan_throat_note') : $t('plugins.WorkshopPrinting.pellet.newfan_part_note') }}</div>
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<input v-model.trim="form.name" class="field wide" :placeholder="$t('plugins.WorkshopPrinting.pellet.newfan_name')" maxlength="24" />
			<input v-model.trim="form.pin" class="field wide" placeholder="out6" />
			<input v-model.number="form.freq" type="number" min="1" max="50000" class="field" /> Hz
		</div>
		<template v-if="form.kind === 'throat'">
			<div class="text-title-small mt-3">{{ $t('plugins.WorkshopPrinting.pellet.newfan_follows') }}</div>
			<v-checkbox v-for="z in zones" :key="z.id" v-model="form.heaters" :value="z.id" density="compact" hide-details class="mt-0" :label="'H' + z.id + ' · ' + z.name" />
			<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
				{{ $t('plugins.WorkshopPrinting.pellet.fan_on_from') }} <input v-model.number="form.low" type="number" min="0" max="300" class="field" /> °C
				{{ $t('plugins.WorkshopPrinting.pellet.fan_full_from') }} <input v-model.number="form.high" type="number" min="0" max="300" class="field" /> °C
			</div>
		</template>
		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn size="small" :color="armed === 'add' ? 'amber-darken-3' : 'primary'" :loading="saving" :disabled="!configure" @click="arm('add', save)">
				{{ armed === 'add' ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.newfan_save') }}
			</v-btn>
		</div>
		<div class="text-body-small text-medium-emphasis mt-2">{{ $t('plugins.WorkshopPrinting.pellet.newfan_note') }}</div>
		<template v-if="made.length">
			<v-divider class="my-3" />
			<div class="text-title-small">{{ $t('plugins.WorkshopPrinting.pellet.newfan_made') }}</div>
			<div v-for="f in made" :key="f.index" class="d-flex align-center" style="gap:8px">
				<span class="text-body-medium">M106 P{{ f.index }} · {{ f.name }} · {{ f.kind === 'throat' ? $t('plugins.WorkshopPrinting.pellet.newfan_throat') : $t('plugins.WorkshopPrinting.pellet.newfan_part') }}</span>
				<v-spacer />
				<v-btn size="x-small" variant="text" color="error" :loading="removing === f.index" @click="arm('rm' + f.index, () => remove(f.index))">
					{{ armed === 'rm' + f.index ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pellet.newfan_remove') }}
				</v-btn>
			</div>
		</template>
	</v-card>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { MODE_FILE, readText, writeText, note } from './util.js'
import { pinInUse } from './pellet-feed.js'
import { normalize, applyFan, marked, removeFan, nextFanIndex } from './pellet-fans.js'
import { confirmRisk } from './risk.js'
import { sendCode } from './send-code.js' // {code, log} wrapper over the machine store
import { i18n } from './dwc-host.js'

const props = defineProps({
	tool: { type: Object, default: null },
	busy: { type: Boolean, default: false },
	configure: { type: Boolean, default: false }, // the role writes the configuration (technician) and the setup view
	omFans: { type: Array, default: () => [] }, // model.fans
	zones: { type: Array, default: () => [] } // heaters of the tool
})

const emit = defineEmits(['msg', 'saved'])

const form = ref({ kind: 'part', name: '', pin: '', freq: 250, heaters: [], low: 45, high: 50 })
const saving = ref(false)
const removing = ref(null)
const armed = ref(null)
const armedTimer = ref(null)
const made = ref([])

if (props.zones.length) form.value.heaters = [props.zones[0].id];
loadMade();

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

async function readOptional(path) {
	try {
		return await readText(path);
	} catch (e) {
		return '';
	}
}

async function loadMade() {
	made.value = marked(await readOptional(MODE_FILE));
}

async function save() {
	if (saving.value || !props.configure) return;
	saving.value = true;
	try {
		if (props.busy) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy'));
		const texts = await Promise.all(['0:/sys/config.g', MODE_FILE, '0:/sys/modelaser.g', '0:/sys/modecnc.g'].map(p => readOptional(p)));
		const taken = marked(texts[1]).map(m => m.index);
		// the first fan number the board does not have and no fan of this page is waiting for a reload with
		const index = nextFanIndex(Array.from({ length: 16 }, (_, i) => props.omFans[i] || taken.includes(i)), 16);
		if (index < 0) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.newfan_err_full'));
		const def = normalize(Object.assign({}, form.value, { index }));
		if (def.error) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.newfan_err_' + def.error));
		if (pinInUse(texts, def.pin)) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.feed_err_pin_use', { pin: def.pin }));
		const r = applyFan(texts[1], props.tool.number, def);
		if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.newfan_err_' + r.error));
		const ok = await confirmRisk({
			title: i18n.t('plugins.WorkshopPrinting.pellet.newfan_confirm_title'),
			text: i18n.t('plugins.WorkshopPrinting.pellet.newfan_confirm_text', { name: def.name, pin: def.pin, index })
		});
		if (!ok) return;
		const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
		await writeText(MODE_FILE + '.bak-' + stamp, texts[1]);
		await writeText(MODE_FILE, r.text);
		note(sendCode, 'config', i18n.t('plugins.WorkshopPrinting.pellet.newfan_log', { name: def.name, index }));
		say('success', i18n.t('plugins.WorkshopPrinting.pellet.newfan_saved', { name: def.name, stamp }));
		form.value.name = '';
		form.value.pin = '';
		await loadMade();
		emit('saved');
	} catch (e) {
		say('error', e.message || String(e));
	} finally {
		saving.value = false;
	}
}

// only a fan this page created can be removed from here (the ones with the mark)
async function remove(index) {
	if (!props.configure) return;
	removing.value = index;
	try {
		if (props.busy) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.reorder_busy'));
		const text = await readText(MODE_FILE);
		const r = removeFan(text, props.tool.number, index);
		if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.pellet.newfan_err_missing'));
		const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
		await writeText(MODE_FILE + '.bak-' + stamp, text);
		await writeText(MODE_FILE, r.text);
		say('success', i18n.t('plugins.WorkshopPrinting.pellet.newfan_removed', { stamp }));
		await loadMade();
		emit('saved');
	} catch (e) {
		say('error', e.message || String(e));
	} finally {
		removing.value = null;
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
.field.wide {
	width: 130px;
}
</style>
