<template>
	<div v-if="show" class="gl-card" role="group" :aria-label="tx('card_label', { name: name })">
		<gcode-thumb :file="path" :size="64" :width="128" />
		<div class="gl-card-main">
			<div class="gl-card-name" :title="path">{{ name }}</div>
			<div v-if="pending" class="gl-card-sub" role="status"><v-icon x-small>mdi-clock-outline</v-icon> {{ tx('state_pending') }}</div>
			<template v-else>
				<gcode-kind-badge :kind="kind" :tags="tags" :max="3" />
				<div class="gl-card-nums">
					<span v-for="r in numbers" :key="r.key"><span class="gl-k">{{ tx(r.labelKey || ('f_' + r.key)) }}</span> {{ r.value }}</span>
				</div>
				<div v-if="notPrint" class="gl-card-note" role="note">{{ tx('kinds.not_a_print_short') }}</div>
			</template>
		</div>
		<!-- the preview of the card: the small PNG the service rendered (one request per file, no geometry, no canvas) when the summary says it has one; an old
		     service falls back to the canvas of the top layers. The "Preview" button opens the full viewer under the card. -->
		<div v-if="miniPreview && summary" class="gl-card-prev">
			<div class="gl-card-mini" :class="{ 'is-img': thumbMode }">
				<gcode-thumb v-if="thumbMode" fill :file="path" :size="96" :width="320" />
				<gcode-layer-canvas v-else :file="path" :summary="summary" :table="table" :kind="kind" :plane="plane" mini />
			</div>
			<v-btn x-small text class="gl-card-open" :aria-expanded="viewer ? 'true' : 'false'" @click="viewer = !viewer"><v-icon x-small left>{{ viewer ? 'mdi-chevron-up' : 'mdi-cube-scan' }}</v-icon>{{ viewer ? tx('view3d.preview_close') : tx('view3d.preview_open') }}</v-btn>
		</div>
		<div v-if="viewer && summary" class="gl-card-full">
			<gcode-layer-canvas :key="path" :file="path" :summary="summary" :table="table" :file-types="fileTypes" :kind="kind" :plane="plane" />
		</div>
	</div>
</template>

<script>
'use strict'

// A compact card of a G-code file: thumbnail, name and the key numbers (time, filament, layers, bbox), optionally with a mini preview of the top layers.
// Takes the PATH of the file and loads gcodelib.info lazily from the shared cache (each file is asked once for the whole page). A file the library does not
// know (not found, or an old service without the library) shows NOTHING, so it can be mounted anywhere a file is chosen or shown. Emits `info` with the summary.
import GcodeThumb from './GcodeThumb.vue'
import GcodeLayerCanvas from './GcodeLayerCanvas.vue'
import GcodeKindBadge from './GcodeKindBadge.vue'
import { lib } from './gcode-lib-shared.js'
import { libText } from './gcode-lib-text.js'
import { baseName, fullPath } from './gcode-lib-format.js'
import { kindOf, kindInfoRows, cardKeys, isNotPrint, planeOf } from './gcode-lib-kinds.js'
import { useThumbnail } from './gcode-lib-stream.js'

const RETRIES = 8

export default {
	mixins: [libText],
	components: { GcodeThumb, GcodeLayerCanvas, GcodeKindBadge },
	props: {
		file: { type: String, default: '' },
		miniPreview: { type: Boolean, default: false }
	},
	data() {
		return { loaded: null, pending: false, known: false, viewer: false }
	},
	computed: {
		show() {
			return !!this.file && this.known
		},
		path() {
			return fullPath(this.file)
		},
		name() {
			return baseName(this.file)
		},
		summary() {
			return (this.loaded && this.loaded.summary) || null
		},
		table() {
			return (this.loaded && this.loaded.layers_table) || []
		},
		thumbMode() {
			return useThumbnail(this.summary)
		},
		fileTypes() {
			return (this.loaded && this.loaded.types) || []
		},
		kind() {
			return kindOf(this.summary)
		},
		tags() {
			return (this.summary && this.summary.tags) || []
		},
		notPrint() {
			return isNotPrint(this.kind)
		},
		plane() {
			return planeOf(this.loaded, this.summary)
		},
		numbers() {
			const rows = kindInfoRows(this.summary, null, this.table)
			return cardKeys(this.kind).map((k) => rows.find((r) => r.key === k)).filter(Boolean).slice(0, 4)
		}
	},
	watch: {
		file() { this.start() }
	},
	mounted() {
		this.start()
	},
	beforeDestroy() {
		this.token = -1
		clearTimeout(this.timer)
	},
	methods: {
		start() {
			this.token = (this.token || 0) + 1
			clearTimeout(this.timer)
			this.loaded = null
			this.viewer = false
			this.pending = false
			this.known = false
			if (this.file) this.ask(this.token, 0)
		},
		async ask(token, tries) {
			let out = null
			try {
				out = await lib.info(fullPath(this.file))
			} catch (e) {
				if (token === this.token) this.known = false // unknown file or old service: nothing is shown
				return
			}
			if (token !== this.token) return
			if (out && out.summary) {
				this.loaded = out
				this.pending = false
				this.known = true
				this.$emit('info', out.summary)
			} else if (out && out.state === 'pending' && tries < RETRIES) {
				this.pending = true
				this.known = true
				this.timer = setTimeout(() => this.ask(token, tries + 1), 3000)
			}
		}
	}
}
</script>

<style scoped>
.gl-card { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid rgba(128, 128, 128, 0.35); border-radius: 8px; flex-wrap: wrap; }
.gl-card-main { min-width: 0; flex: 1 1 160px; }
.gl-card-name { font-weight: 600; overflow-wrap: anywhere; }
.gl-card-nums { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 13px; font-variant-numeric: tabular-nums; }
.gl-card-sub { font-size: 12px; opacity: 0.75; }
.gl-k { opacity: 0.65; }
.gl-card-note { font-size: 12px; opacity: 0.85; margin-top: 2px; }
.gl-card-prev { flex: 1 1 100%; min-width: 0; max-width: 320px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.gl-card-mini { position: relative; width: 100%; aspect-ratio: 4 / 3; max-height: 240px; min-height: 0; overflow: hidden; box-sizing: border-box; border-radius: 6px; }
@supports not (aspect-ratio: 1) { .gl-card-mini { height: 180px; } }
.gl-card-open.v-btn { min-height: 44px; opacity: 0.8; }
.gl-card-full { flex: 1 1 100%; min-width: 0; height: clamp(260px, 50vh, 480px); overflow: hidden; }
</style>
