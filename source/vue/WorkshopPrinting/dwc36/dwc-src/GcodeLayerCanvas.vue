<template>
	<div class="gl-canvas" :class="{ 'is-mini': mini }">
		<div v-if="!mini" class="gl-tools">
			<gcode-legend :types="types" :hidden="hidden" :travel="travel" :with-travel="!is2d" @toggle="toggleType" @travel="travel = $event; redraw()" />
			<span class="gl-view3d">
				<v-select :value="preset" :items="presetItems" dense outlined hide-details class="gl-view-select" :label="tx('view3d.view')" :aria-label="tx('view3d.view')" @change="setPreset" />
				<v-btn-toggle v-if="!is2d" :value="ortho ? 'ortho' : 'persp'" mandatory dense class="gl-proj" :aria-label="tx('view3d.projection')" @change="setProjectionMode">
					<v-btn value="ortho" class="gl-btn-text" :title="tx('view3d.proj_ortho_hint')">{{ tx('view3d.proj_ortho') }}</v-btn>
					<v-btn value="persp" class="gl-btn-text" :title="tx('view3d.proj_persp_hint')">{{ tx('view3d.proj_persp') }}</v-btn>
				</v-btn-toggle>
				<v-btn icon class="gl-btn" :aria-label="tx('zoom_in')" :title="tx('zoom_in')" @click="zoomBy(1.4)"><v-icon>mdi-magnify-plus-outline</v-icon></v-btn>
				<v-btn icon class="gl-btn" :aria-label="tx('zoom_out')" :title="tx('zoom_out')" @click="zoomBy(1 / 1.4)"><v-icon>mdi-magnify-minus-outline</v-icon></v-btn>
				<v-btn icon class="gl-btn" :aria-label="tx('view3d.fit')" :title="tx('view3d.fit')" @click="fit()"><v-icon>mdi-fit-to-screen-outline</v-icon></v-btn>
				<help-tip v-bind="help3d()" />
			</span>
		</div>
		<div class="gl-body">
			<div ref="wrap" class="gl-stage" :tabindex="mini ? -1 : 0" :aria-label="mini ? null : tx(is2d ? 'kinds.canvas_label_2d' : 'view3d.canvas_label')" v-on="handlers">
				<canvas ref="cv" class="gl-cv" />
				<div v-if="status === 'loading'" class="gl-state" role="status"><v-progress-circular indeterminate size="22" width="3" class="mr-2" />{{ loadingText }}</div>
				<div v-else-if="status === 'pending'" class="gl-state" role="status">{{ tx('info_pending') }}</div>
				<div v-else-if="status === 'error'" class="gl-state is-error" role="alert">{{ error }}<v-btn small text class="gl-btn-text" @click="load()">{{ tx('retry') }}</v-btn></div>
				<div v-else-if="emptyText" class="gl-state gl-empty-note" role="status">{{ emptyText }}</div>
			</div>
			<div v-if="!mini && is2d" class="gl-side is-names">
				<gcode-layer-names :total="total" :table="table" :lo="lo" :hi="hi" @change="onSlider" />
			</div>
			<div v-else-if="!mini" class="gl-side">
				<gcode-layer-slider :total="total" :lo="lo" :hi="hi" @change="onSlider" />
				<help-tip v-bind="help('slider')" />
			</div>
		</div>
		<div v-if="!mini" class="gl-foot" role="status">
			<span>{{ label }}</span>
			<span v-if="capped" class="gl-capped">{{ tx('capped', { n: cap }) }}</span>
			<span v-if="decimation" class="gl-capped">{{ tx('view3d.decimated', { pct: decimation }) }}</span>
		</div>
	</div>
</template>

<script>
'use strict'

// The layer preview (center of the library page): a 3D orbit view of the selected layers on a canvas (software projection, no 3D library), coloured by feature
// type (legend with toggles and travel), the "View" control (presets, orthographic / perspective, saved in the browser), drag to rotate, wheel / pinch to zoom,
// two fingers or shift-drag to pan, and the two-handle vertical slider. It asks the service for WINDOWS of layers (gcodelib.layers, aligned chunks, the visible ones
// first and a neighbour after), keeps them in the LRU of the shared store, debounces the slider and draws only the top DRAW_CAP layers of the range.
// Drawing happens only on change (requestAnimationFrame), is thinned while the camera moves and is spread over frames by a time budget (gcode-lib-draw3d.js).
// `mini` = the small read-only preview of the info card (the top layers of the file, the isometric camera, no controls and no handlers).
import HelpTip from './HelpTip.vue' // vue/_shared36
import GcodeLegend from './GcodeLegend.vue'
import GcodeLayerSlider from './GcodeLayerSlider.vue'
import GcodeLayerNames from './GcodeLayerNames.vue'
import { lib } from './gcode-lib-shared.js'
import { libText } from './gcode-lib-text.js'
import { drawScene3d, countSegments } from './gcode-lib-draw3d.js'
import { DRAW_CAP, effectiveRange, detailFor, collectLayers, layerLabel } from './gcode-lib-layers.js'
import { planFetch, progressOf, runJobs, decimationPct, CONCURRENCY } from './gcode-lib-stream.js'
import { PRESET_IDS, cameraFor, loadView, saveView, cameraFromView, applyPreset, setProjection, orbit, rotateBy, zoomAt, panBy, fitCamera, lerpCamera, bbox3, layerZ, frameFor } from './gcode-lib-view3d.js'

const MINI_LAYERS = 6
const TRANSITION_MS = 220
const TAP_MS = 320
const MOVE_PX = 4
const SETTLE_MS = 180

export default {
	mixins: [libText],
	components: { HelpTip, GcodeLegend, GcodeLayerSlider, GcodeLayerNames },
	props: {
		file: { type: String, default: '' },
		summary: { type: Object, default: null },
		table: { type: Array, default: () => [] },
		fileTypes: { type: Array, default: () => [] }, // the feature types of the file (gcodelib.info `types`), for the legend before any layer arrives
		bed: { type: Object, default: null }, // the machine area { min: [x, y], max: [x, y] } when known; else the bbox of the file is the reference
		kind: { type: String, default: 'fff' }, // kind of the file (fff, laser, cnc, travel, unknown): the sentence of an empty preview
		plane: { type: String, default: '3d' }, // '2d' (laser, CNC, travel): flat top view, no orbit, layers by name
		mini: { type: Boolean, default: false }
	},
	data() {
		return { lo: 0, hi: 0, hidden: {}, travel: false, types: [], status: 'idle', error: '', size: { w: 300, h: 300 }, preset: 'iso', ortho: true, noGeometry: false, progress: { done: 0, total: 0 }, decimation: 0 }
	},
	computed: {
		total() {
			return (this.summary && this.summary.layers) || this.table.length || 0
		},
		is2d() {
			return this.plane === '2d'
		},
		range() {
			return effectiveRange(this.lo, this.hi, this.total, this.mini ? MINI_LAYERS : this.cap)
		},
		loadingText() {
			return this.progress.total > 1 ? this.tx('view3d.loading_progress', { done: this.progress.done, total: this.progress.total }) : this.tx('loading_layers')
		},
		emptyText() {
			return !this.mini && this.status === 'ready' && this.noGeometry ? this.tx('kinds.empty_' + this.kind) : ''
		},
		capped() {
			return this.range.capped
		},
		cap() {
			return DRAW_CAP
		},
		box() {
			return bbox3(this.summary && this.summary.bbox, this.table)
		},
		presetItems() {
			if (this.is2d) return ['top'].map((id) => ({ text: this.tx('view3d.preset_' + id), value: id }))
			return PRESET_IDS.concat(this.preset === 'free' ? ['free'] : []).map((id) => ({ text: this.tx('view3d.preset_' + id), value: id, disabled: id === 'free' }))
		},
		// the listeners of the stage: none at all in the mini preview
		handlers() {
			if (this.mini) return {}
			return { keydown: this.onKey, wheel: this.onWheel, pointerdown: this.onDown, pointermove: this.onMove, pointerup: this.onUp, pointercancel: this.onUp, contextmenu: (e) => e.preventDefault() }
		},
		label() {
			const a = layerLabel(this.lo, this.table, this.total)
			const b = layerLabel(this.hi, this.table, this.total)
			const z = b.z === null ? '' : '  Z ' + b.z.toFixed(2)
			return this.tx('layers_range', { from: a.n, to: b.n, total: b.total }) + z
		}
	},
	watch: {
		file() { this.reset() },
		plane() { this.camera = this.startCamera(); this.preset = this.camera.preset; this.ortho = this.camera.ortho; this.reset() },
		total() { this.reset() }
	},
	created() {
		// the camera lives outside the reactive data (it changes every frame while dragging); preset / ortho are the reactive copies the controls show
		this.camera = this.startCamera()
		this.preset = this.camera.preset
		this.ortho = this.camera.ortho
		this.pointers = new Map()
		this.projCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null
	},
	mounted() {
		this.measure()
		if (typeof ResizeObserver !== 'undefined') {
			this.observer = new ResizeObserver(() => { this.measure(); this.redraw() })
			this.observer.observe(this.$refs.wrap)
		}
		this.reset()
	},
	beforeDestroy() {
		this.generation = -1
		clearTimeout(this.timer)
		clearTimeout(this.idleTimer)
		if (this.observer) this.observer.disconnect()
		if (this.frame) cancelAnimationFrame(this.frame)
		if (this.animFrame) cancelAnimationFrame(this.animFrame)
	},
	methods: {
		// the camera to start from: the saved view for a 3D file, always the top view (orthographic) for a flat one
		startCamera() {
			return this.is2d ? cameraFor('top', true) : cameraFromView(loadView(), this.mini)
		},
		help3d() {
			return { title: this.tx('view3d.help_title'), what: this.tx('view3d.help_what'), why: this.tx('view3d.help_why'), ifMissing: this.tx('view3d.help_miss'), how: this.tx('view3d.help_how') }
		},
		reset() {
			this.generation = (this.generation || 0) + 1
			this.waits = 0
			this.camera = fitCamera(this.camera)
			this.hidden = this.is2d && this.kind !== 'travel' ? { travel: true } : {} // a flat file starts with its travel moves off (except a test made of them)
			this.noGeometry = false
			this.types = (this.fileTypes.length ? this.fileTypes : (this.summary && Array.isArray(this.summary.features) ? this.summary.features : [])).slice()
			this.hi = Math.max(0, this.total - 1)
			this.lo = this.mini ? Math.max(0, this.total - MINI_LAYERS) : 0
			this.status = 'idle'
			this.redraw()
			if (this.file && this.total > 0) this.load()
		},
		measure() {
			const el = this.$refs.wrap
			if (!el) return
			this.size = { w: Math.max(60, el.clientWidth), h: Math.max(60, el.clientHeight) }
		},
		span() {
			return this.range.to - this.range.from + 1
		},
		// The whole range is fetched progressively: the TOP windows first, the rest after them, two requests at a time, what has arrived is drawn at once.
		// A new file, range or zoom detail starts a new load (the old one stops starting windows); a stale answer is ignored.
		async load() {
			const gen = this.generation
			const token = this.loadToken = (this.loadToken || 0) + 1
			const r = this.range
			if (!this.file || r.to < r.from) return
			const detail = detailFor(this.span(), this.camera.zoom)
			const have = (w, d) => !!lib.cachedWindow(this.file, w, d)
			const jobs = planFetch(r.from, r.to, this.total, detail, have)
			const progress = () => progressOf(r.from, r.to, this.total, detail, have)
			this.progress = progress()
			if (!jobs.length) { this.finish(gen); return }
			this.status = 'loading'
			this.error = ''
			const stale = () => gen !== this.generation || token !== this.loadToken
			try {
				await runJobs(jobs, (j) => lib.layerWindow(this.file, j.win, j.detail, this.table), {
					concurrency: CONCURRENCY,
					cancelled: stale,
					onEach: (j, a) => { this.addTypes(a); this.progress = progress(); this.redraw() }
				})
				if (stale()) return
				this.finish(gen)
			} catch (e) {
				if (stale()) return
				// the service has not read the geometry yet (or dropped it from its cache): ask again in a few seconds, a limited number of times
				if (e && e.code === 'pending' && this.waits++ < 10) {
					this.status = 'pending'
					clearTimeout(this.timer)
					this.timer = setTimeout(() => this.load(), 3000)
					return
				}
				this.status = 'error'
				this.error = (e && e.message) || this.tx('layers_failed')
			}
		},
		finish(gen) {
			if (gen !== this.generation) return
			this.status = 'ready'
			this.noGeometry = !this.layers().some((l) => countSegments(l.layer, {}, true) > 0)
			this.redraw()
		},
		addTypes(ans) {
			const t = ans && Array.isArray(ans.types) ? ans.types : []
			const add = t.filter((x) => this.types.indexOf(x) < 0)
			if (add.length) this.types = this.types.concat(add)
		},
		onSlider(r) {
			this.lo = r.lo
			this.hi = r.hi
			this.redraw(true)
			clearTimeout(this.timer)
			this.timer = setTimeout(() => this.load(), 150)
		},
		toggleType(t) {
			this.hidden = Object.assign({}, this.hidden, { [t]: !this.hidden[t] })
			this.redraw()
		},
		layers() {
			const r = this.range
			const detail = detailFor(this.span(), this.camera.zoom)
			const other = detail === 'low' ? 'normal' : 'low'
			const got = collectLayers(r.from, r.to, this.total, (w) => lib.cachedWindow(this.file, w, detail) || lib.cachedWindow(this.file, w, other))
			return got.map((l) => ({ index: l.index, layer: l.layer, z: this.is2d ? 0 : layerZ(l.index, l.layer, this.table, this.box, this.total) }))
		},
		// ---- drawing: only on change, one frame at a time; a frame that did not finish continues on the next animation frame ----
		redraw(moving) {
			this.moving = !!moving
			this.drawState = null
			clearTimeout(this.idleTimer)
			if (moving) this.idleTimer = setTimeout(() => this.redraw(false), SETTLE_MS) // full detail again once the camera rests
			this.schedule()
		},
		schedule() {
			if (this.frame) return
			this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint() })
		},
		frameNow() {
			const key = [this.size.w, this.size.h, this.camera.yaw, this.camera.pitch, this.camera.ortho, this.box.min.join(), this.box.max.join()].join('|')
			if (!this.frameMemo || this.frameMemo.key !== key) this.frameMemo = { key, frame: frameFor(this.box, this.size.w, this.size.h, this.camera, this.mini ? 4 : 14) }
			return this.frameMemo.frame
		},
		bedRect() {
			if (this.mini) return null
			if (this.bed && Array.isArray(this.bed.min) && Array.isArray(this.bed.max)) return this.bed
			return { min: [this.box.min[0], this.box.min[1]], max: [this.box.max[0], this.box.max[1]] }
		},
		paint() {
			const cv = this.$refs.cv
			if (!cv || !cv.getContext) return
			const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
			const { w, h } = this.size
			if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); this.drawState = null }
			const ctx = cv.getContext('2d')
			if (!ctx) return
			if (!this.drawState) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			const scene = { w, h, frame: this.frameNow(), cam: this.camera, layers: this.layers(), hidden: this.hidden, travel: this.travel, top: this.range.to, moving: this.moving, bed: this.bedRect(), cache: this.projCache }
			this.drawState = drawScene3d(ctx, scene, this.drawState)
			if (!this.moving) { const pct = decimationPct(this.drawState.ratio); if (pct !== this.decimation) this.decimation = pct } // say so when the file is thinned to stay fast
			if (!this.drawState.done) this.schedule()
		},
		// ---- camera changes ----
		setCamera(cam, moving) {
			this.camera = cam
			this.preset = cam.preset
			this.ortho = cam.ortho
			this.redraw(moving)
		},
		remember() {
			if (!this.mini && !this.is2d) saveView(undefined, this.camera)
		},
		// a short eased transition to the target camera (instant without animation frames, in the mini preview or with reduced motion)
		animateTo(target) {
			if (this.animFrame) cancelAnimationFrame(this.animFrame)
			this.animFrame = 0
			const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
			if (this.mini || reduce || typeof requestAnimationFrame === 'undefined') { this.setCamera(target); this.remember(); return }
			const from = this.camera
			const t0 = Date.now()
			const step = () => {
				const t = (Date.now() - t0) / TRANSITION_MS
				this.animFrame = 0
				if (t >= 1) { this.setCamera(target); this.remember(); this.afterMove(); return }
				this.setCamera(lerpCamera(from, target, t), true)
				this.animFrame = requestAnimationFrame(step)
			}
			this.animFrame = requestAnimationFrame(step)
		},
		afterMove() {
			clearTimeout(this.timer)
			this.timer = setTimeout(() => this.load(), 250)
		},
		setPreset(id) {
			if (this.mini || id === 'free') return
			if (this.is2d) { this.fit(); return }
			this.animateTo(applyPreset(this.camera, id))
		},
		setProjectionMode(mode) {
			if (this.mini || this.is2d) return
			this.setCamera(setProjection(this.camera, mode === 'ortho'))
			this.remember()
		},
		zoomBy(f, mx, my) {
			this.setCamera(zoomAt(this.frameNow(), this.camera, f, mx == null ? this.size.w / 2 : mx, my == null ? this.size.h / 2 : my), true)
			this.remember()
			this.afterMove()
		},
		fit() {
			this.animateTo(fitCamera(this.camera))
		},
		onWheel(e) {
			e.preventDefault()
			const r = this.$refs.wrap.getBoundingClientRect()
			this.zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top)
		},
		onKey(e) {
			if (e.key === '+' || e.key === '=') this.zoomBy(1.4)
			else if (e.key === '-') this.zoomBy(1 / 1.4)
			else if (e.key === '0') this.fit()
			else if (e.key === 'ArrowLeft') this.setCamera(this.is2d ? panBy(this.camera, 24, 0) : rotateBy(this.camera, -0.12, 0), true)
			else if (e.key === 'ArrowRight') this.setCamera(this.is2d ? panBy(this.camera, -24, 0) : rotateBy(this.camera, 0.12, 0), true)
			else if (e.key === 'ArrowUp') this.setCamera(this.is2d ? panBy(this.camera, 0, 24) : rotateBy(this.camera, 0, 0.1), true)
			else if (e.key === 'ArrowDown') this.setCamera(this.is2d ? panBy(this.camera, 0, -24) : rotateBy(this.camera, 0, -0.1), true)
			else return
			if (e.key.indexOf('Arrow') === 0) this.remember()
			e.preventDefault()
		},
		onDown(e) {
			if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = 0 }
			this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false, pan: this.is2d || e.button === 2 || !!e.shiftKey }) // a flat file never orbits: drag pans
			if (this.$refs.wrap.setPointerCapture) { try { this.$refs.wrap.setPointerCapture(e.pointerId) } catch (x) { /* synthetic event */ } }
		},
		onMove(e) {
			const p = this.pointers.get(e.pointerId)
			if (!p) return
			if (this.pointers.size === 2) return this.pinch(e, p)
			const dx = e.clientX - p.x
			const dy = e.clientY - p.y
			if (!p.moved && Math.hypot(dx, dy) < MOVE_PX) return
			p.moved = true
			p.x = e.clientX
			p.y = e.clientY
			this.setCamera(p.pan ? panBy(this.camera, dx, dy) : orbit(this.camera, dx, dy), true)
		},
		// two fingers: the zoom follows the change of their distance and the pan the movement of their middle
		pinch(e, p) {
			const other = Array.from(this.pointers.entries()).find((kv) => kv[0] !== e.pointerId)[1]
			const before = Math.hypot(p.x - other.x, p.y - other.y)
			const after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
			const midBefore = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 }
			const midAfter = { x: (e.clientX + other.x) / 2, y: (e.clientY + other.y) / 2 }
			p.x = e.clientX
			p.y = e.clientY
			p.moved = true
			if (before < 1) return
			const r = this.$refs.wrap.getBoundingClientRect()
			let cam = zoomAt(this.frameNow(), this.camera, after / before, midAfter.x - r.left, midAfter.y - r.top)
			cam = panBy(cam, midAfter.x - midBefore.x, midAfter.y - midBefore.y)
			this.setCamera(cam, true)
		},
		onUp(e) {
			const p = this.pointers.get(e.pointerId)
			this.pointers.delete(e.pointerId)
			if (this.pointers.size > 0) return
			const now = Date.now()
			if (p && !p.moved && e.type === 'pointerup') {
				// a double click / double tap fits the view
				if (this.lastTap && now - this.lastTap < TAP_MS) { this.lastTap = 0; this.fit(); return }
				this.lastTap = now
			}
			this.redraw(false)
			this.remember()
			this.afterMove()
		}
	}
}
</script>

<style scoped>
.gl-canvas { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.gl-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; padding: 4px 6px; }
.gl-view3d { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.gl-view-select { max-width: 170px; min-width: 130px; }
.gl-view-select >>> .v-input__slot { min-height: 44px; }
.gl-proj .v-btn.gl-btn-text { min-height: 44px; }
.gl-btn.v-btn { width: 44px; height: 44px; }
.gl-body { display: flex; flex: 1 1 auto; min-height: 0; }
.gl-stage { position: relative; flex: 1 1 auto; min-width: 0; min-height: 200px; border-radius: 8px; overflow: hidden; background: #1b1b1f; touch-action: none; outline: none; cursor: grab; }
.gl-stage:focus-visible { box-shadow: 0 0 0 3px rgba(30, 136, 229, 0.5); }
.gl-cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.gl-state { pointer-events: none; position: absolute; left: 8px; bottom: 8px; padding: 4px 10px; border-radius: 14px; background: rgba(0, 0, 0, 0.65); color: #fff; font-size: 12px; display: flex; align-items: center; }
.gl-state.is-error { color: #ffab91; pointer-events: auto; }
.gl-side { display: flex; flex-direction: column; align-items: center; flex: none; }
.gl-side.is-names { align-items: stretch; width: 190px; overflow-y: auto; }
.gl-foot { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 4px 8px; font-size: 13px; font-variant-numeric: tabular-nums; }
.gl-capped { opacity: 0.7; }
.is-mini { overflow: hidden; min-width: 0; }
.is-mini .gl-body { min-height: 0; min-width: 0; }
.is-mini .gl-stage { min-height: 0; height: 100%; border-radius: 6px; cursor: default; }
</style>
