<template>
	<div ref="root" class="gl-page" :class="{ 'is-narrow': narrow }">
		<div class="d-flex align-center flex-wrap" style="gap:6px">
			<span class="text-body-2">{{ tx('lead') }}</span>
			<help-tip v-bind="help('page')" />
		</div>
		<!-- a machine with users and nobody signed in: the service refuses every read, so the session cover of the family stands in for the panes (the chip of the header is the one Sign in button) -->
		<session-notice v-if="noSession" variant="cover" kind="session" class="mt-2" />
		<!-- the selection line: outside the panes, so the action is at hand at every width (on a narrow screen the panes change when a file is chosen).
		     "Prepare this file" only leaves the file chosen in Prepare job and opens that section: one tap, nothing is sent to the machine -->
		<div v-if="row && !unsupported && !noSession" class="pc-actions mt-2">
			<span class="text-body-2 gl-sel-name">{{ tx('selected', { name: selName }) }}</span>
			<gcode-kind-badge v-if="selKind" :kind="selKind" />
			<v-spacer v-if="!narrow" />
			<v-btn small color="primary" class="gl-act" :block="narrow" :disabled="!!block" :aria-describedby="block ? uid + '-why' : undefined" @click="prepare()"><v-icon small left>mdi-clipboard-arrow-right-outline</v-icon>{{ tx('prepare_this') }}</v-btn>
			<div v-if="block" :id="uid + '-why'" class="wf-field-msg is-hint gl-sel-why">{{ blockText }}</div>
		</div>
		<!-- the state of the library as the mockup draws it: three states in a plain list (not tabs: they do not switch anything), the one that applies lit by what the service says; nothing is simulated -->
		<ul v-if="!noSession" class="gl-tabs mt-2" :aria-label="tx('tabs_label')">
			<li v-for="t in tabs" :key="t" class="gl-tab" :class="{ on: libTab === t }" :aria-current="libTab === t ? 'true' : undefined">{{ tx('tab_' + t) }}</li>
		</ul>
		<!-- narrow screens (the 800x480 kiosk): one pane at a time -->
		<v-btn-toggle v-if="narrow && !unsupported && !noSession" v-model="pane" mandatory dense class="gl-panes mt-2" :aria-label="tx('panes')">
			<v-btn v-for="p in panes" :key="p" :value="p" class="gl-pane-btn">{{ tx('pane_' + p) }}</v-btn>
		</v-btn-toggle>

		<div v-if="!noSession" class="gl-grid mt-2" :class="{ 'is-bare': bare }">
			<section v-show="!narrow || pane === 'files' || unsupported" class="gl-col gl-files" :aria-label="tx('pane_files')">
				<gcode-lib-list :value="row ? row.path : ''" @select="select" @status="status = $event" />
			</section>

			<template v-if="!unsupported && !bare">
				<section v-show="!narrow || pane === 'preview'" class="gl-col gl-view" :class="{ 'is-alone': !row }" :aria-label="tx('pane_preview')">
					<div v-if="!row" class="gl-hint">{{ tx('pick_one') }}</div>
					<!-- a file the service could not read: what happened, and Retry reading for who may ask the service again; the others see the role in words -->
					<div v-else-if="row.state === 'error'" class="gl-hint" role="status">
						<error-notice :error="row.error || tx('state_error')" :action="tx('reading')" :retry="canRetry" @retry="retry()" />
						<lock-reason v-if="!canRetry" op="gcodelib.refresh" need="operator" :subject="$t('plugins.WorkshopPrinting.subjects.library_retry')" class="mt-2" />
					</div>
					<div v-else-if="infoState === 'pending'" class="gl-hint" role="status"><span class="wf-state info">{{ tx('state_working') }}</span><div class="mt-1">{{ tx('info_pending') }}</div></div>
					<error-notice v-else-if="infoError" :error="infoError" :action="tx('reading')" retry class="ma-2" @retry="loadInfo()" />
					<div v-else-if="info && emptyId" class="gl-hint" role="status"><v-icon small class="mr-1">mdi-information-outline</v-icon>{{ tx('kinds.empty_' + emptyId) }}</div>
					<gcode-layer-canvas v-else-if="info" :key="row.path" :file="row.path" :summary="info.summary" :table="info.layers_table || []" :file-types="info.types || []" :kind="kind" :plane="plane" />
				</section>
				<section v-if="row || narrow" v-show="!narrow || pane === 'info'" class="gl-col gl-details" :aria-label="tx('pane_info')">
					<div v-if="!row" class="gl-hint">{{ tx('pick_one') }}</div>
					<gcode-info-panel v-else :row="row" :info="info" />
				</section>
			</template>
		</div>
		<div v-if="status && status.total > 0 && !unsupported && !noSession" class="text-caption pc-muted mt-1">{{ tx('footer', { n: status.total }) }}</div>
		<!-- the plugin reads files, it does not upload, delete or rename them: those are DWC's, and the way there is one tap -->
		<div v-if="!noSession" class="pc-actions mt-2">
			<span class="wf-field-msg is-hint">{{ tx('dwc_files_note') }}</span>
			<v-btn small text class="gl-act" @click="openJobs()"><v-icon small left>mdi-folder-open-outline</v-icon>{{ $t('plugins.WorkshopPrinting.prepare.open_jobs') }}</v-btn>
		</div>
	</div>
</template>

<script>
'use strict'

// "G-code library" (3D Printing > G-code library), laid out like PrusaSlicer's preview: LEFT the searchable, sortable, windowed list of the files the service has
// indexed (thumbnail, time, filament, layers, state), CENTER the layer preview on a canvas (colour by feature, legend, two-handle slider, zoom and pan) and RIGHT the
// info of the selected file. Everything it shows comes from the parsed cache of the service (gcodelib.* operations): the page never parses a file and never asks for
// all the layers at once. READ ONLY except the "retry" of a file that failed to index (gcodelib.refresh). "Prepare this file" writes the file into the job draft of the
// page (job-draft.js, memory only) and asks the shell to open Prepare job.
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import SessionNotice from './SessionNotice.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36
import { NEED } from './print-sections.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import { signedOut } from './workshop-auth.js' // vue/_shared36
import GcodeLibList from './GcodeLibList.vue'
import GcodeLayerCanvas from './GcodeLayerCanvas.vue'
import GcodeInfoPanel from './GcodeInfoPanel.vue'
import GcodeKindBadge from './GcodeKindBadge.vue'
import { lib } from './gcode-lib-shared.js'
import { libText } from './gcode-lib-text.js'
import { kindOf, rowKind, planeOf, emptyState, prepareBlock } from './gcode-lib-kinds.js'
import { baseName, fullPath } from './gcode-lib-format.js'
import { jobDraft, stampOf } from './job-draft.js'

const NARROW_PX = 900
const PENDING_TRIES = 20
let seq = 0

export default {
	mixins: [libText, roleMixin],
	// what the person who left had selected and read stays nowhere (the list is asked again when the panes come back)
	sessionData: ['row', 'info', 'infoState', 'status'],
	sessionErrors: ['infoError'],
	components: { ErrorNotice, HelpTip, SessionNotice, LockReason, GcodeLibList, GcodeLayerCanvas, GcodeInfoPanel, GcodeKindBadge },
	props: {
		isFff: { type: Boolean, default: true } // Prepare job is an FFF section: outside that mode the button says so
	},
	data() {
		return { tabs: ['ok', 'empty', 'down'], uid: 'gl' + (++seq), row: null, info: null, infoState: '', infoError: null, status: null, narrow: false, pane: 'files', panes: ['files', 'preview', 'info'] }
	},
	computed: {
		kind() {
			return (this.info && kindOf(this.info.summary)) || 'fff'
		},
		plane() {
			return this.info ? planeOf(this.info, this.info.summary) : '3d'
		},
		// a file with nothing to draw says why (one sentence per kind) instead of an empty box
		emptyId() {
			return this.info && this.info.summary ? emptyState(this.row, this.info.summary) : null
		},
		// no file at all (not a search without matches): the list is the one empty state, over the whole width
		// which of the three states applies: no answer from the service, an empty library, or files
		libTab() {
			const st = this.status;
			if (st && (st.unsupported || st.failed)) return 'down';
			return this.bare ? 'empty' : 'ok';
		},
		bare() {
			return !!(this.status && this.status.total === 0 && !this.status.filtered && !this.status.unsupported)
		},
		unsupported() {
			return !!(this.status && this.status.unsupported)
		},
		noSession() {
			void this.identityTick
			return signedOut()
		},
		// asking the service to read the file again is an operator's action (gcodelib.refresh)
		canRetry() {
			return this.atLeast(NEED.operate)
		},
		selName() {
			return this.row ? baseName(this.row.path) : ''
		},
		// the kind of the selected file as far as it is known: from its info once read, else from the list row (null: not known yet)
		selKind() {
			return (this.info && kindOf(this.info.summary)) || rowKind(this.row)
		},
		// why "Prepare this file" is off ('' = it is on): never a mute button
		block() {
			return prepareBlock(this.row, this.selKind, this.isFff)
		},
		blockText() {
			if (this.block === 'mode') return this.$t('plugins.WorkshopPrinting.printing.needs_fff_mode_hint')
			if (this.block === 'unreadable') return this.tx(this.canRetry ? 'prepare_unreadable' : 'prepare_unreadable_role')
			return this.block === 'not_fff' ? this.tx('prepare_not_fff', { kind: this.$t('plugins.WorkshopPrinting.prepare.kind_' + this.selKind) }) : ''
		}
	},
	mounted() {
		this.measure()
		if (typeof ResizeObserver !== 'undefined') {
			this.observer = new ResizeObserver(() => this.measure())
			this.observer.observe(this.$refs.root)
		}
	},
	beforeDestroy() {
		this.token = -1
		clearTimeout(this.timer)
		if (this.observer) this.observer.disconnect()
	},
	methods: {
		measure() {
			if (this.$refs.root && this.$refs.root.clientWidth) this.narrow = this.$refs.root.clientWidth < NARROW_PX
		},
		select(row) {
			this.row = row
			if (this.narrow) this.pane = 'preview'
			this.loadInfo()
		},
		loadInfo() {
			this.token = (this.token || 0) + 1
			clearTimeout(this.timer)
			this.info = null
			this.infoError = null
			this.infoState = ''
			if (this.row && this.row.state !== 'error') this.ask(this.token, 0)
		},
		// the summary of a file the service has not parsed yet comes back as {state: 'pending'}: ask again in a few seconds, a limited number of times
		async ask(token, tries) {
			try {
				const out = await lib.info(this.row.path)
				if (token !== this.token) return
				if (out && out.summary) { this.info = out; this.infoState = 'ready'; return }
				this.infoState = 'pending'
				if (tries < PENDING_TRIES) this.timer = setTimeout(() => this.ask(token, tries + 1), 3000)
			} catch (e) {
				if (token === this.token) { this.infoError = e; this.infoState = '' }
			}
		},
		// leave the file chosen in the job draft (with its stamp and its kind) and open Prepare job: nothing is sent to the machine
		prepare() {
			if (!this.row || this.block) return
			jobDraft.setFile(fullPath(this.row.path), stampOf(this.row), this.selKind)
			this.$emit('goto', { section: 'prepare', focus: true })
		},
		// DWC's own page for the files of jobs: navigation only, nothing is sent
		openJobs() {
			if (this.$router) this.$router.push('/Files/Jobs').catch(() => {})
		},
		retry() {
			if (!this.canRetry) return
			const path = this.row.path
			lib.refresh(path).then(() => { this.row = Object.assign({}, this.row, { state: 'pending', error: '' }); this.loadInfo() }, (e) => { this.infoError = e })
		}
	}
}
</script>

<style scoped>
.gl-page { min-width: 0; }
.gl-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr) 280px; gap: 10px; height: clamp(360px, 72vh, 760px); }
.gl-grid.is-bare { grid-template-columns: minmax(0, 1fr); height: auto; }
.is-narrow .gl-grid { grid-template-columns: minmax(0, 1fr); height: clamp(300px, calc(100vh - 230px), 700px); }
.gl-col { min-width: 0; min-height: 0; border: 1px solid rgba(128, 128, 128, 0.3); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
.gl-view { padding: 4px; }
.gl-view.is-alone { grid-column: span 2; }
.is-narrow .gl-view.is-alone { grid-column: auto; }
.gl-hint { padding: 20px 14px; opacity: 0.8; }
.gl-panes { width: 100%; }
.gl-pane-btn.v-btn { flex: 1 1 0; min-height: 44px; }
.gl-act.v-btn { min-height: 44px; }
.gl-sel-name { min-width: 0; overflow-wrap: anywhere; }
.gl-sel-why { flex-basis: 100%; }
</style>
