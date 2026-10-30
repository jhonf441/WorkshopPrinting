<template>
	<!-- "3D job" tab (2026-10-21): the FFF parts that lived in the Workbench (temperatures and print state of the
	     "Current job" card, the 3D view of the Simulate card) now live here. READ ONLY: nothing is sent to the machine. -->
	<pc-section icon="mdi-cube-outline" :title="$t('plugins.WorkshopPrinting.fff.tab')">
		<v-alert v-if="!isFff" dense text type="info" class="mb-3">{{ t('fff.only_fff') }}</v-alert>
		<fff-job-status :is-fff="isFff" class="mb-3" />
		<v-card outlined class="pa-3">
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<v-select
					v-model="file" :items="fileItems" :label="t('fff.file')" :no-data-text="loadingList ? t('fff.loading') : t('fff.no_files')"
					dense outlined hide-details class="fff-file"
				/>
				<v-btn small outlined :loading="loadingList" @click="loadList()"><v-icon small left>mdi-refresh</v-icon>{{ t('fff.refresh') }}</v-btn>
				<v-btn small color="primary" :disabled="!file" :loading="reading" @click="read()"><v-icon small left>mdi-cube-outline</v-icon>{{ t('fff.load') }}</v-btn>
			</div>
			<v-alert v-if="msg" dense text :type="msgKind" class="mt-2 mb-0">{{ msg }}</v-alert>
			<!-- look at it layer by layer (same controls the Workbench's Simulate card had) -->
			<div v-if="prev && layers > 0" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<span class="text-body-2 grey--text">{{ t('fff.layer') }}</span>
				<v-slider :value="shown.sel" :min="0" :max="layers" step="1" dense hide-details class="fff-slider" @input="pick" />
				<span class="text-body-2 grey--text">{{ shown.sel ? shown.sel + ' / ' + layers : t('fff.all_layers') }}</span>
				<v-btn x-small :color="shown.mode === 'until' ? 'primary' : undefined" :outlined="shown.mode !== 'until'" @click="setMode('until')">{{ t('fff.layer_upto') }}</v-btn>
				<v-btn x-small :color="shown.mode === 'single' ? 'primary' : undefined" :outlined="shown.mode !== 'single'" @click="setMode('single')">{{ t('fff.layer_only') }}</v-btn>
				<v-chip v-if="shown.follows" x-small outlined color="success">{{ t('fff.follows_print') }}</v-chip>
				<v-btn v-else-if="followable" x-small text @click="follow()">{{ t('fff.follow_print') }}</v-btn>
			</div>
			<fff-3d-view ref="view" class="mt-3" :prev="prev" :path="prevPath" :layer-sel="shown.sel" :layer-mode="shown.mode" />
		</v-card>
	</pc-section>
</template>

<script>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
'use strict'

import { api } from './workshop-api.js'
import FffJobStatus from './FffJobStatus.vue'
import Fff3dView from './Fff3dView.vue'
import { fffListGcodes, fffJobFile, fffLayerShown, fffPrinting } from './fff-job.js'

export default {
	components: { FffJobStatus, Fff3dView, PcSection },
	props: {
		isFff: { type: Boolean, default: false }
	},
	data() {
		return {
			files: [], loadingList: false, file: '', reading: false, msg: '', msgKind: 'error',
			prev: null, prevPath: '', layerSel: null, layerMode: 'until'
		};
	},
	computed: {
		model() {
			return this.$store.state.machine.model;
		},
		jobFile() {
			return fffJobFile(this.model);
		},
		fileItems() {
			const items = this.files.map(f => f.path);
			if (this.jobFile && !items.includes(this.jobFile)) items.unshift(this.jobFile);
			return items;
		},
		layers() {
			return (this.prev && this.prev.stats && this.prev.stats.layers) || 0;
		},
		// layer shown: the one picked, or the one being printed when this file is the job (follows it)
		shown() {
			return fffLayerShown(this.model, this.prevPath, this.layerSel, this.layerMode);
		},
		followable() {
			return !!this.prevPath && fffPrinting(this.model) && this.jobFile === this.prevPath;
		}
	},
	watch: {
		// a print started: offer its file
		jobFile(v) {
			if (v && !this.prev && !this.reading) this.file = v;
		}
	},
	mounted() {
		if (this.jobFile) this.file = this.jobFile;
		this.loadList();
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.' + key, params);
		},
		loadList() {
			if (this.loadingList) return;
			this.loadingList = true;
			fffListGcodes(url => fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])))
				.then(list => {
					this.files = list;
					if (!this.file && list.length) this.file = list[0].path;
				})
				.finally(() => { this.loadingList = false; });
		},
		// the service reads the file WITHOUT running it (API jobs.preview), as an FFF job whatever the machine mode
		async read() {
			if (!this.file || this.reading) return;
			this.reading = true;
			this.msg = '';
			this.msgKind = 'error';
			const path = this.file;
			try {
				const r = await api('jobs.preview', { file: path, mode: 'FFF' });
				if (!r || !r.ok) throw new Error((r && r.error) || '?');
				this.prev = r;
				this.prevPath = path;
				this.layerSel = null;
				// the view starts closed (it costs drawing time): pressing "view in 3D" has to show it
				this.$nextTick(() => { const v = this.$refs.view; if (v && !v.open) v.toggle(); });
				// a laser or CNC file has no extrusion: there are no layers to show
				if (!((r.stats && r.stats.layers) > 0)) {
					this.msgKind = 'warning';
					this.msg = this.t('fff.no_layers', { file: path });
				}
			} catch (e) {
				this.prev = null;
				this.prevPath = '';
				this.msg = this.t('fff.could_not_read', { e: (e && e.message) || e });
			} finally {
				this.reading = false;
			}
		},
		pick(v) {
			this.layerSel = parseInt(v, 10) || 0;
		},
		setMode(m) {
			if (this.layerSel === null) this.layerSel = this.shown.sel;
			this.layerMode = m;
		},
		follow() {
			this.layerSel = null;
			this.layerMode = 'until';
		}
	}
};
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
