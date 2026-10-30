<template>
	<!-- "3D job" tab (2026-10-21): the FFF parts that lived in the Workbench (temperatures and print state of the
	     "Current job" card, the 3D view of the Simulate card) now live here. READ ONLY: nothing is sent to the machine. -->
	<pc-section icon="mdi-cube-outline" :title="$t('plugins.WorkshopPrinting.fff.tab')">
		<v-alert v-if="!isFff" density="compact" variant="tonal" type="info" class="mb-3">{{ t('fff.only_fff') }}</v-alert>
		<fff-job-status :is-fff="isFff" class="mb-3" />
		<v-card variant="outlined" class="pa-3">
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<v-select
					v-model="file" :items="fileItems" :label="t('fff.file')" :no-data-text="loadingList ? t('fff.loading') : t('fff.no_files')"
					density="compact" variant="outlined" hide-details class="fff-file"
				/>
				<v-btn size="small" variant="outlined" :loading="loadingList" @click="loadList()"><v-icon size="small" start>mdi-refresh</v-icon>{{ t('fff.refresh') }}</v-btn>
				<v-btn size="small" color="primary" :disabled="!file" :loading="reading" @click="read()"><v-icon size="small" start>mdi-cube-outline</v-icon>{{ t('fff.load') }}</v-btn>
			</div>
			<v-alert v-if="msg" density="compact" variant="tonal" :type="msgKind" class="mt-2 mb-0">{{ msg }}</v-alert>
			<!-- look at it layer by layer (same controls the Workbench's Simulate card had) -->
			<div v-if="prev && layers > 0" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<span class="text-body-medium text-medium-emphasis">{{ t('fff.layer') }}</span>
				<v-slider :model-value="shown.sel" :min="0" :max="layers" step="1" density="compact" hide-details class="fff-slider" @update:model-value="pick" />
				<span class="text-body-medium text-medium-emphasis">{{ shown.sel ? shown.sel + ' / ' + layers : t('fff.all_layers') }}</span>
				<v-btn size="x-small" :color="shown.mode === 'until' ? 'primary' : undefined" :variant="(shown.mode !== 'until') ? 'outlined' : 'elevated'" @click="setMode('until')">{{ t('fff.layer_upto') }}</v-btn>
				<v-btn size="x-small" :color="shown.mode === 'single' ? 'primary' : undefined" :variant="(shown.mode !== 'single') ? 'outlined' : 'elevated'" @click="setMode('single')">{{ t('fff.layer_only') }}</v-btn>
				<v-chip v-if="shown.follows" size="x-small" variant="outlined" color="success">{{ t('fff.follows_print') }}</v-chip>
				<v-btn v-else-if="followable" size="x-small" variant="text" @click="follow()">{{ t('fff.follow_print') }}</v-btn>
			</div>
			<fff-3d-view ref="view" class="mt-3" :prev="prev" :path="prevPath" :layer-sel="shown.sel" :layer-mode="shown.mode" />
		</v-card>
	</pc-section>
</template>

<script setup>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { api } from './workshop-api.js'
import FffJobStatus from './FffJobStatus.vue'
import Fff3dView from './Fff3dView.vue'
import { fffListGcodes, fffJobFile, fffLayerShown, fffPrinting } from './fff-job.js'
import { machineModel, i18n } from './dwc-host.js'

const props = defineProps({
	isFff: { type: Boolean, default: false }
})

const view = ref(null)

const files = ref([])
const loadingList = ref(false)
const file = ref('')
const reading = ref(false)
const msg = ref('')
const msgKind = ref('error')
const prev = ref(null)
const prevPath = ref('')
const layerSel = ref(null)
const layerMode = ref('until')

const model = computed(() => {
	return machineModel();
})

const jobFile = computed(() => {
	return fffJobFile(model.value);
})

const fileItems = computed(() => {
	const items = files.value.map(f => f.path);
	if (jobFile.value && !items.includes(jobFile.value)) items.unshift(jobFile.value);
	return items;
})

const layers = computed(() => {
	return (prev.value && prev.value.stats && prev.value.stats.layers) || 0;
})

// layer shown: the one picked, or the one being printed when this file is the job (follows it)
const shown = computed(() => {
	return fffLayerShown(model.value, prevPath.value, layerSel.value, layerMode.value);
})

const followable = computed(() => {
	return !!prevPath.value && fffPrinting(model.value) && jobFile.value === prevPath.value;
})

// a print started: offer its file
watch(jobFile, (v) => {
	if (v && !prev.value && !reading.value) file.value = v;
})

onMounted(() => {
	if (jobFile.value) file.value = jobFile.value;
	loadList();
})

function t(key, params) {
	return i18n.t('plugins.WorkshopPrinting.' + key, params);
}

function loadList() {
	if (loadingList.value) return;
	loadingList.value = true;
	fffListGcodes(url => fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])))
		.then(list => {
			files.value = list;
			if (!file.value && list.length) file.value = list[0].path;
		})
		.finally(() => { loadingList.value = false; });
}

// the service reads the file WITHOUT running it (API jobs.preview), as an FFF job whatever the machine mode
async function read() {
	if (!file.value || reading.value) return;
	reading.value = true;
	msg.value = '';
	msgKind.value = 'error';
	const path = file.value;
	try {
		const r = await api('jobs.preview', { file: path, mode: 'FFF' });
		if (!r || !r.ok) throw new Error((r && r.error) || '?');
		prev.value = r;
		prevPath.value = path;
		layerSel.value = null;
		// the view starts closed (it costs drawing time): pressing "view in 3D" has to show it
		nextTick(() => { const v = view.value; if (v && !v.open) v.toggle(); });
		// a laser or CNC file has no extrusion: there are no layers to show
		if (!((r.stats && r.stats.layers) > 0)) {
			msgKind.value = 'warning';
			msg.value = t('fff.no_layers', { file: path });
		}
	} catch (e) {
		prev.value = null;
		prevPath.value = '';
		msg.value = t('fff.could_not_read', { e: (e && e.message) || e });
	} finally {
		reading.value = false;
	}
}

function pick(v) {
	layerSel.value = parseInt(v, 10) || 0;
}

function setMode(m) {
	if (layerSel.value === null) layerSel.value = shown.value.sel;
	layerMode.value = m;
}

function follow() {
	layerSel.value = null;
	layerMode.value = 'until';
}
</script>

<style scoped>
.fff-file {
	flex: 1 1 240px;
	min-width: 200px;
}
.fff-slider {
	flex: 1 1 160px;
	min-width: 120px;
}
</style>
