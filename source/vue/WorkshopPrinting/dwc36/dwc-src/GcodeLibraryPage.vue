<template>
	<div ref="root" class="gl-page" :class="{ 'is-narrow': narrow }">
		<div class="d-flex align-center flex-wrap" style="gap:6px">
			<span class="text-body-2">{{ tx('lead') }}</span>
			<help-tip v-bind="help('page')" />
		</div>
		<!-- narrow screens (the 800x480 kiosk): one pane at a time -->
		<v-btn-toggle v-if="narrow && !unsupported" v-model="pane" mandatory dense class="gl-panes mt-2" :aria-label="tx('panes')">
			<v-btn v-for="p in panes" :key="p" :value="p" class="gl-pane-btn">{{ tx('pane_' + p) }}</v-btn>
		</v-btn-toggle>

		<div class="gl-grid mt-2">
			<section v-show="!narrow || pane === 'files' || unsupported" class="gl-col gl-files" :aria-label="tx('pane_files')">
				<gcode-lib-list :value="row ? row.path : ''" @select="select" @status="status = $event" />
			</section>

			<template v-if="!unsupported">
				<section v-show="!narrow || pane === 'preview'" class="gl-col gl-view" :aria-label="tx('pane_preview')">
					<div v-if="!row" class="gl-hint">{{ tx('pick_one') }}</div>
					<div v-else-if="row.state === 'error'" class="gl-hint">
						<v-alert dense text type="error" class="mb-2">{{ row.error || tx('state_error') }}</v-alert>
						<v-btn small color="primary" class="gl-act" @click="retry()"><v-icon small left>mdi-reload</v-icon>{{ tx('retry') }}</v-btn>
					</div>
					<div v-else-if="infoState === 'pending'" class="gl-hint" role="status">{{ tx('info_pending') }}<v-progress-linear indeterminate height="3" class="mt-2" /></div>
					<error-notice v-else-if="infoError" :error="infoError" :action="tx('reading')" retry class="ma-2" @retry="loadInfo()" />
					<div v-else-if="info && emptyId" class="gl-hint" role="status"><v-icon small class="mr-1">mdi-information-outline</v-icon>{{ tx('kinds.empty_' + emptyId) }}</div>
					<gcode-layer-canvas v-else-if="info" :key="row.path" :file="row.path" :summary="info.summary" :table="info.layers_table || []" :file-types="info.types || []" :kind="kind" :plane="plane" />
				</section>
				<section v-show="!narrow || pane === 'info'" class="gl-col gl-details" :aria-label="tx('pane_info')">
					<div v-if="!row" class="gl-hint">{{ tx('pick_one') }}</div>
					<gcode-info-panel v-else :row="row" :info="info" />
				</section>
			</template>
		</div>
		<div v-if="status && status.total > 0 && !unsupported" class="text-caption grey--text mt-1">{{ tx('footer', { n: status.total }) }}</div>
	</div>
</template>

<script>
'use strict'

// "G-code library" (3D Printing > G-code library), laid out like PrusaSlicer's preview: LEFT the searchable, sortable, windowed list of the files the service has
// indexed (thumbnail, time, filament, layers, state), CENTER the layer preview on a canvas (colour by feature, legend, two-handle slider, zoom and pan) and RIGHT the
// info of the selected file. Everything it shows comes from the parsed cache of the service (gcodelib.* operations): the page never parses a file and never asks for
// all the layers at once. READ ONLY except the "retry" of a file that failed to index (gcodelib.refresh).
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import GcodeLibList from './GcodeLibList.vue'
import GcodeLayerCanvas from './GcodeLayerCanvas.vue'
import GcodeInfoPanel from './GcodeInfoPanel.vue'
import { lib } from './gcode-lib-shared.js'
import { libText } from './gcode-lib-text.js'
import { kindOf, planeOf, emptyState } from './gcode-lib-kinds.js'

const NARROW_PX = 900
const PENDING_TRIES = 20

export default {
	mixins: [libText],
	components: { ErrorNotice, HelpTip, GcodeLibList, GcodeLayerCanvas, GcodeInfoPanel },
	data() {
		return { row: null, info: null, infoState: '', infoError: null, status: null, narrow: false, pane: 'files', panes: ['files', 'preview', 'info'] }
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
		unsupported() {
			return !!(this.status && this.status.unsupported)
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
		retry() {
			const path = this.row.path
			lib.refresh(path).then(() => { this.row = Object.assign({}, this.row, { state: 'pending', error: '' }); this.loadInfo() }, (e) => { this.infoError = e })
		}
	}
}
</script>

<style scoped>
.gl-page { min-width: 0; }
.gl-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr) 280px; gap: 10px; height: clamp(360px, 72vh, 760px); }
.is-narrow .gl-grid { grid-template-columns: minmax(0, 1fr); height: clamp(300px, calc(100vh - 230px), 700px); }
.gl-col { min-width: 0; min-height: 0; border: 1px solid rgba(128, 128, 128, 0.3); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
.gl-view { padding: 4px; }
.gl-hint { padding: 20px 14px; opacity: 0.8; }
.gl-panes { width: 100%; }
.gl-pane-btn.v-btn { flex: 1 1 0; min-height: 44px; }
.gl-act.v-btn { min-height: 44px; }
</style>
