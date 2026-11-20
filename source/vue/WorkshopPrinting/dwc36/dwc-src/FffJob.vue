<template>
	<!-- "3D job" tab (2026-10-21): the FFF parts that lived in the Workbench (temperatures and print state of the
	     "Current job" card, the 3D view of the Simulate card) now live here. The status and the 3D view are READ ONLY; the only
	     thing that sends codes is the job control card (JobControl.vue, 2026-10-30: pause / resume / cancel, Z steps, factors). -->
	<pc-section icon="mdi-cube-outline" :title="$t('plugins.WorkshopPrinting.fff.tab')">
		<div v-if="!isFff" class="wf-note mb-3" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ t('fff.only_fff') }}</span></div>
		<!-- nothing running: one empty state that says what to do (prepare a job, or open DWC Jobs) and, when the model knows it, how the last job ended: never red, never a cause -->
		<pc-empty v-if="isFff && noJob" class="mb-3" icon="mdi-cube-off-outline" :title="t('fff.none_title')" :text="t('fff.none_text')" :note="lastNote ? t('fff.' + lastNote.key, { file: lastNote.file }) : ''">
			<v-btn small color="primary" class="fj-btn" @click="$emit('goto', { section: 'prepare' })"><v-icon small left>mdi-clipboard-check-outline</v-icon>{{ t('fff.go_prepare') }}</v-btn>
			<v-btn small text class="fj-btn" @click="openJobs()"><v-icon small left>mdi-folder-play-outline</v-icon>{{ $t('plugins.WorkshopPrinting.prepare.open_jobs') }}</v-btn>
			<v-btn v-if="lastNote && lastNote.key === 'last_aborted'" small text class="fj-btn" @click="$emit('goto', { section: 'state' })"><v-icon small left>mdi-thermometer</v-icon>{{ t('fff.go_state') }}</v-btn>
		</pc-empty>
		<fff-job-status v-if="!noJob" :is-fff="isFff" class="mb-3" @goto="$emit('goto', $event)" />
		<job-control :is-fff="isFff" class="mb-3" />
		<v-card outlined class="pa-3">
			<h4 class="pc-card-title mb-2">{{ t('fff.layers_title') }}</h4>
			<div class="pc-actions">
				<!-- the same select as Files and Prepare job: ONE list of files for the whole page -->
				<wf-field id="fff-file" :label="t('fff.file')" class="fff-file">
					<gcode-picker id="fff-file" :value="file" :job-file="jobFullName" :default-kinds="['fff']" :show-help="false" :show-line="false" :aria-label="t('fff.file')" @input="onPick" />
				</wf-field>
				<v-btn small color="primary" :disabled="!shownPath || !atLeast('operator')" :loading="reading" @click="read()"><v-icon small left>mdi-cube-outline</v-icon>{{ t('fff.load') }}</v-btn>
			</div>
			<gcode-info-card v-if="file && shownPath !== jobFile" :file="file" class="mt-3" />
			<lock-reason v-if="!refusal" min="operator" class="mt-2" :subject="$t('plugins.WorkshopPrinting.subjects.print_job')" />
			<session-notice v-if="refusal" :kind="refusal" needed="operator" class="mt-2" :subject="$t('plugins.WorkshopPrinting.subjects.print_job')" />
			<pc-result :text="msg || ''" :kind="msgKind" class="mt-2" />
			<!-- look at it layer by layer (same controls the Workbench's Simulate card had) -->
			<div v-if="prev && layers > 0" class="pc-actions mt-3">
				<span class="text-body-2 pc-muted">{{ t('fff.layer') }}</span>
				<v-slider :value="shown.sel" :min="0" :max="layers" step="1" dense hide-details class="fff-slider" @input="pick" />
				<span class="text-body-2 pc-muted">{{ shown.sel ? shown.sel + ' / ' + layers : t('fff.all_layers') }}</span>
				<v-btn x-small :color="shown.mode === 'until' ? 'primary' : undefined" :outlined="shown.mode !== 'until'" @click="setMode('until')">{{ t('fff.layer_upto') }}</v-btn>
				<v-btn x-small :color="shown.mode === 'single' ? 'primary' : undefined" :outlined="shown.mode !== 'single'" @click="setMode('single')">{{ t('fff.layer_only') }}</v-btn>
				<v-chip v-if="shown.follows" x-small outlined color="success">{{ t('fff.follows_print') }}</v-chip>
				<v-btn v-else-if="followable" x-small text @click="follow()">{{ t('fff.follow_print') }}</v-btn>
			</div>
			<fff-3d-view ref="view" class="mt-3" @pick="emptyPick" :prev="prev" :path="prevPath" :layer-sel="shown.sel" :layer-mode="shown.mode" />
		</v-card>
	</pc-section>
</template>

<script>
import PcSection from './PcSection.vue' // the card with the header of the section (printing-design.css)
import PcEmpty from './PcEmpty.vue' // the empty state: icon, title, a sentence and the way on
'use strict'

import { api } from './workshop-api.js'
import FffJobStatus from './FffJobStatus.vue'
import JobControl from './JobControl.vue' // pause / resume / cancel, Z baby-stepping, speed and flow factors
import Fff3dView from './Fff3dView.vue'
import GcodeInfoCard from './GcodeInfoCard.vue' // the library's card of the chosen file (nothing when it is not in the library)
import { fffJobFile, fffLayerShown, fffPrinting, fffNoJob, fffLastJob } from './fff-job.js'
import GcodePicker from './GcodePicker.vue' // the G-code library picker (chooses the file to look at)
import WfField from './WfField.vue' // vue/_shared36
import { previewPath } from './pellet-layers.js' // the path under 0:/gcodes that jobs.preview wants ('' = not under gcodes)
import { lib } from './gcode-lib-shared.js' // the library of the page: it says the kind of the last file
import { kindOf as fileKindOf } from './gcode-lib-kinds.js'
import { fullPath } from './gcode-lib-format.js'
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)
import { refusalKind } from './session-refusal.js' // the cause of a refusal: session | role
import { signedOut } from './workshop-auth.js'
import SessionNotice from './SessionNotice.vue' // vue/_shared36
import PcResult from './PcResult.vue' // the result of an action, one line
import LockReason from './LockReason.vue' // vue/_shared36

export default {
	mixins: [roleMixin],
	sessionData: ['prev', 'prevPath', 'layerSel', 'msg', 'msgKind', 'refusal'], // the 3D preview came from the service with the old session (ESTANDAR 3)
	sessionErrors: ['msg', 'msgKind', 'refusal'], // what a refusal or a failure said: cleared when the person signs in, out or changes role (role-mixin.js)
	components: { PcResult, LockReason, SessionNotice, FffJobStatus, JobControl, Fff3dView, GcodeInfoCard, PcSection, PcEmpty, GcodePicker, WfField },
	props: {
		isFff: { type: Boolean, default: false }
	},
	data() {
		return {
			file: '', reading: false, msg: '', msgKind: 'error', refusal: '',
			prev: null, prevPath: '', layerSel: null, layerMode: 'until', lastKind: ''
		};
	},
	computed: {
		model() {
			return this.$store.state.machine.model;
		},
		jobFile() {
			return fffJobFile(this.model);
		},
		// the file of the job the machine has, whole (what the picker marks as current)
		jobFullName() {
			const f = this.model && this.model.job && this.model.job.file && this.model.job.file.fileName;
			return f || '';
		},
		// what jobs.preview wants for the chosen file: its path under 0:/gcodes (the picker gives the whole path, so a name with # or ? travels as it is)
		shownPath() {
			const f = fullPath(this.file);
			return /^0:\//.test(f) ? previewPath(f) : '';
		},
		layers() {
			return (this.prev && this.prev.stats && this.prev.stats.layers) || 0;
		},
		// layer shown: the one picked, or the one being printed when this file is the job (follows it)
		shown() {
			return fffLayerShown(this.model, this.prevPath, this.layerSel, this.layerMode);
		},
		noJob() {
			return fffNoJob(this.model);
		},
		// the name of the last file the model keeps (it is lost when the board restarts)
		lastName() {
			const j = this.model && this.model.job;
			return (j && j.lastFileName) || '';
		},
		// how the last job ended, only for a 3D print file (the library says the kind); nothing when it is not known
		lastNote() {
			return fffLastJob(this.model, this.lastKind);
		},
		followable() {
			return !!this.prevPath && fffPrinting(this.model) && this.jobFile === this.prevPath;
		}
	},
	watch: {
		lastName: { immediate: true, handler(v) { this.loadLastKind(v); } },
		// a print started: offer its file
		jobFile(v) {
			if (v && !this.prev && !this.reading) this.file = fullPath(v);
		}
	},
	mounted() {
		if (this.jobFile) this.file = fullPath(this.jobFile);
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.' + key, params);
		},
		// the kind of the last file from the library (one cached question); without an answer there is no sentence
		async loadLastKind(name) {
			this.lastKind = '';
			if (!name) return;
			try {
				const out = await lib.info(fullPath(name));
				if (name === this.lastName) this.lastKind = (out && out.summary && fileKindOf(out.summary)) || '';
			} catch (e) { /* the library does not know it: no sentence */ }
		},
		// the job is started in DWC Jobs: this only navigates there (no code is sent)
		openJobs() {
			if (this.$router) this.$router.push('/Files/Jobs').catch(() => {});
		},
		// the file field is the select of the G-code library: it gives the whole path of the chosen file ('' when cleared)
		onPick(path) {
			this.file = path || '';
		},
		// the person signed in / out or the role changed: a file that was refused is read again
		onSessionChange() {
			if (this.file && this.msg && !this.prev) this.read();
		},
		// the service reads the file WITHOUT running it (API jobs.preview), as an FFF job whatever the machine mode
		async read() {
			if (!this.shownPath || this.reading) return;
			this.reading = true;
			this.msg = '';
			this.refusal = '';
			this.msgKind = 'error';
			const path = this.shownPath;
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
				// a refusal says its cause (sign in / role), not the raw message of the service
				this.refusal = refusalKind(e, signedOut());
				this.msg = this.refusal ? '' : this.t('fff.could_not_read', { e: (e && e.message) || e });
			} finally {
				this.reading = false;
			}
		},
		// the button of the empty 3D view: load the chosen file, or look for files if none is chosen yet
		emptyPick() {
			if (this.file) this.read();
			else this.$emit('goto', { section: 'library' });
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
.fj-btn.v-btn {
	height: 44px;
	min-height: 44px;
}
.fff-file {
	flex: 1 1 240px;
	min-width: 200px;
}
.fff-slider {
	flex: 1 1 160px;
	min-width: 120px;
}
</style>
