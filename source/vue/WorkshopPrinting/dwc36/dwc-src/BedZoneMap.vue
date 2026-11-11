<template>
	<div class="bz-map">
		<svg
			ref="svg" :viewBox="viewBox" class="bz-svg" :class="{ 'is-editable': editable }" role="group" :aria-label="$t('plugins.WorkshopPrinting.bedZones.map_label')" preserveAspectRatio="xMidYMid meet"
			@pointermove="onMove" @pointerup="onUp" @pointercancel="onUp"
		>
			<!-- the physical bed, to scale, when the geometry is on -->
			<template v-if="geometry">
				<rect :x="0" :y="0" :width="width" :height="height" rx="4" class="bz-bed" @click="onBackground" />
					<template v-if="!editable">
					<text :x="width / 2" y="-6" text-anchor="middle" class="bz-dim">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_mm', { n: geometry.bed.width }) }}</text>
					<text :x="-6" :y="height / 2" text-anchor="middle" class="bz-dim" :transform="'rotate(-90 -6 ' + height / 2 + ')'">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_mm', { n: geometry.bed.length }) }}</text>
					</template>
					<!-- the ruler (editing): millimetres of the bed along the top and the left side, the extent of the zone chosen marked on it -->
					<g v-if="editable" class="bz-ruler" aria-hidden="true">
						<line v-for="t in ticks.x" :key="'tx' + t.mm" :x1="t.at" :x2="t.at" y1="0" :y2="t.major ? -9 : -5" class="bz-tick" />
						<line v-for="t in ticks.y" :key="'ty' + t.mm" x1="0" :x2="t.major ? -9 : -5" :y1="t.at" :y2="t.at" class="bz-tick" />
						<template v-for="t in ticks.x"><text v-if="t.major" :key="'lx' + t.mm" :x="t.at" y="-12" text-anchor="middle" class="bz-tick-n">{{ t.mm }}</text></template>
						<template v-for="t in ticks.y"><text v-if="t.major" :key="'ly' + t.mm" x="-12" :y="t.at + 3" text-anchor="end" class="bz-tick-n">{{ t.mm }}</text></template>
						<template v-if="markRect">
							<rect :x="markRect.x * scale" y="-4" :width="markRect.w * scale" height="4" class="bz-mark" />
							<rect x="-4" :y="markRect.y * scale" width="4" :height="markRect.h * scale" class="bz-mark" />
						</template>
						<text :x="width + 4" y="-12" class="bz-tick-n">mm</text>
					</g>
			</template>
			<g
				v-for="(r, i) in rows" :key="r.bed" :transform="'translate(' + left(i) + ',' + top(i) + ')'"
				class="bz-zone" :class="{ 'is-selected': isSelected(i, r), 'is-ref': editable && reference === i, 'is-off': !r.active, 'is-alert': r.alert && !editable, 'is-conflict': bad.indexOf(i) >= 0, 'is-ok': editable && bad.indexOf(i) < 0 }"
				tabindex="0" role="button" :aria-pressed="isSelected(i, r) ? 'true' : 'false'" :aria-label="label(r)"
				@click="onClick(r)" @keydown.enter.prevent="choose($event, i)" @keydown.space.prevent="choose($event, i)" @keydown="onKey($event, i)"
				@pointerdown="onDown($event, i, 'move')"
			>
				<rect :width="cellW(i)" :height="cellH(i)" rx="6" class="bz-rect" :fill="editable ? idleFill : fill(r)" />
				<text x="8" y="17" class="bz-n" :fill="editable ? idleInk : ink(r)">{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: r.n }) }}</text>
				<text v-if="r.alert && !editable" :x="cellW(i) - 8" y="17" text-anchor="end" class="bz-bang" :fill="ink(r)">!</text>
				<template v-if="!editable && cellH(i) >= 70">
					<text :x="cellW(i) / 2" :y="cellH(i) / 2 + 6" text-anchor="middle" class="bz-temp" :fill="ink(r)">{{ fmt(r.current) }}</text>
					<text :x="cellW(i) / 2" :y="cellH(i) - 12" text-anchor="middle" class="bz-target" :fill="ink(r)">{{ targetText(r) }}</text>
				</template>
				<text v-if="editable && rectOf(i) && cellH(i) >= 44" :x="cellW(i) / 2" :y="cellH(i) / 2 + 5" text-anchor="middle" class="bz-size" :fill="idleInk">{{ rectOf(i).w }} x {{ rectOf(i).h }}</text>
				<!-- resize handle: 44 px of touch area (transparent circle) around a small visible dot -->
				<g v-if="editable" class="bz-handle" :transform="'translate(' + cellW(i) + ',' + cellH(i) + ')'" @pointerdown.stop="onDown($event, i, 'resize')">
					<circle :r="hit" class="bz-hit" />
					<circle r="7" class="bz-dot" />
				</g>
			</g>
				<!-- the guides of a drag: a line where an edge or the centre of the zone meets another zone or the bed -->
				<g v-if="editable && guideLines.length" class="bz-guides" aria-hidden="true">
					<line v-for="g in guideLines" :key="'g' + g.axis + g.at" :x1="g.axis === 'x' ? g.at * scale : 0" :x2="g.axis === 'x' ? g.at * scale : width" :y1="g.axis === 'y' ? g.at * scale : 0" :y2="g.axis === 'y' ? g.at * scale : height" class="bz-guide" />
				</g>
			<!-- the preview of the tidy-up: a dashed outline where each zone would go and an arrow from where it is; decoration only (the list in the panel says the same in words) -->
			<defs v-if="editable && ghostList.length">
				<marker id="bz-arrowhead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="bz-arrow-head" /></marker>
			</defs>
			<g v-if="editable && ghostList.length" class="bz-ghosts" aria-hidden="true">
				<g v-for="g in ghostList" :key="'ghost' + g.i">
					<rect :x="g.x" :y="g.y" :width="g.w" :height="g.h" rx="6" class="bz-ghost" />
					<line :x1="g.fx" :y1="g.fy" :x2="g.tx" :y2="g.ty" class="bz-arrow" marker-end="url(#bz-arrowhead)" />
					<text :x="g.x + 8" :y="g.y + 17" class="bz-n bz-ghost-n">{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: rows[g.i].n }) }}</text>
				</g>
			</g>
		</svg>
		<div v-if="!editable" class="bz-legend" :title="$t('plugins.WorkshopPrinting.bedZones.map_scale', { min: legendMin, max: legendMax })">
			<span>{{ legendMin }} °C</span>
			<span class="bz-bar" :style="{ background: gradient }" role="img" :aria-label="$t('plugins.WorkshopPrinting.bedZones.map_scale', { min: legendMin, max: legendMax })" />
			<span>{{ legendMax }} °C</span>
		</div>
	</div>
</template>

<script>
'use strict'

// The map of the bed. Without a geometry: one square per zone, laid out as the settings say (rows x columns), colored by its temperature from cold blue to
// red (heatColor of bed-zones.js: the state colors of the page). With a geometry (bed-zones-layout.js): the bed drawn to scale and every zone at its
// position and size. Every square also PRINTS its number, so the color is never the only signal; an alert adds a "!" and a red outline. A square is a button:
// it selects the zone. `editable` (settings): the zones are dragged (pointer events: mouse, pen and finger) and resized by the corner handle, snapped to
// `step` mm (hold Alt for a free move), the arrow keys move the focused zone; a click chooses a zone (Shift / Ctrl adds it to the selection, the empty bed clears it); the numbers come from bed-zones-drag.js and the component only reports
// `begin` (once per gesture, for undo), `rect` ({index, rect}), `pick` ({index, multi}) and `clear`.
import { cells, layoutSize, heatColor, inkFor, fmtTemp, AMBIENT } from './bed-zones.js'
import { moveRect, resizeRect, conflicts, guideSnap, TOUCH_PX } from './bed-zones-drag.js'

const CELL = 112
const GAP = 8
const PAD = 18 // room for the dimension labels around the bed
const PAD_EDIT = 32 // and for the ruler while editing
const SPAN = 400 // the longer side of the bed, in drawing units

export default {
	props: {
		rows: { type: Array, required: true }, // zoneRows() of bed-zones.js (rect included)
		layout: { type: Object, default: () => ({ rows: 2, columns: 2 }) },
		maxTemp: { type: Number, default: 110 },
		selected: { type: Number, default: null }, // the bed of the zone chosen (view)
		selection: { type: Array, default: () => [] }, // the INDEXES of the zones chosen (editing: several at once)
		reference: { type: Number, default: null }, // the index of the reference zone of the aids (editing)
		geometry: { type: Object, default: null }, // {bed: {width, length}, ...} or null
		editable: { type: Boolean, default: false },
		step: { type: Number, default: 5 },
			guides: { type: Boolean, default: true }, // editing: the zone jumps to the edges and centres of the others (hold Alt for a free move)
		ghosts: { type: Array, default: () => [] } // the rect each zone would take after the tidy-up (null = no preview for it), by index
	},
	data() {
		return { CELL, pxPerUnit: 1, drag: null, guideLines: [] }
	},
	computed: {
		size() {
			return layoutSize(this.rows, this.layout)
		},
		place() {
			return cells(this.rows, this.layout)
		},
		// drawing units per millimetre (geometry on)
		scale() {
			return this.geometry ? SPAN / Math.max(this.geometry.bed.width, this.geometry.bed.length) : 1
		},
		width() {
			return this.geometry ? this.geometry.bed.width * this.scale : this.size.columns * CELL + (this.size.columns - 1) * GAP
		},
		height() {
			return this.geometry ? this.geometry.bed.length * this.scale : this.size.rows * CELL + (this.size.rows - 1) * GAP
		},
		pad() {
			return this.editable ? PAD_EDIT : PAD
		},
		viewBox() {
			return this.geometry ? (-this.pad) + ' ' + (-this.pad) + ' ' + (this.width + 2 * this.pad) + ' ' + (this.height + 2 * this.pad) : '0 0 ' + this.width + ' ' + this.height
		},
		// the ruler: a mark every `minor` mm, a number every `major` mm (the smallest step that keeps the numbers apart on this map)
		ticks() {
			if (!this.geometry) return { x: [], y: [] }
			const b = this.geometry.bed
			const major = [10, 20, 50, 100, 200, 500, 1000].find(m => m * this.scale >= 34) || 1000
			const minor = major >= 100 ? major / 5 : major / 2
			const make = len => {
				const out = []
				for (let mm = 0; mm <= len + 1e-6; mm += minor) out.push({ mm: Math.round(mm), at: mm * this.scale, major: Math.abs(mm / major - Math.round(mm / major)) < 1e-6 })
				return out
			}
			return { x: make(b.width), y: make(b.length) }
		},
		// the extent of the zone the aids work from, marked on the ruler
		markRect() {
			const i = this.reference !== null ? this.reference : this.selection[0]
			return i === undefined || i === null ? null : this.rectOf(i)
		},
		// half of the touch area of a handle, in drawing units (44 px on screen, never smaller than the dot)
		hit() {
			return Math.max(9, TOUCH_PX / 2 / (this.pxPerUnit || 1))
		},
		// the zones the preview moves: their target in drawing units and the arrow between the centres
		ghostList() {
			const out = []
			this.ghosts.forEach((g, i) => {
				const now = this.rectOf(i)
				if (!g || !now || (g.x === now.x && g.y === now.y && g.w === now.w && g.h === now.h)) return
				const k = this.scale
				out.push({ i, x: g.x * k, y: g.y * k, w: g.w * k, h: g.h * k, fx: (now.x + now.w / 2) * k, fy: (now.y + now.h / 2) * k, tx: (g.x + g.w / 2) * k, ty: (g.y + g.h / 2) * k })
			})
			return out
		},
		bad() {
			return this.geometry ? conflicts(this.rows.map(r => r.rect).filter(Boolean), this.geometry.bed) : []
		},
		idleFill() {
			return 'var(--wf-surface, #f5f5f5)'
		},
		idleInk() {
			return 'var(--wf-text, #212121)'
		},
		legendMin() {
			return AMBIENT
		},
		legendMax() {
			return Math.round(this.maxTemp)
		},
		gradient() {
			const stops = [0, 1 / 3, 2 / 3, 1].map(f => heatColor(AMBIENT + f * (this.maxTemp - AMBIENT), this.maxTemp))
			return 'linear-gradient(90deg,' + stops.join(',') + ')'
		}
	},
		watch: {
			editable() { this.$nextTick(this.measure) } // the ruler changes the margin, so the pixels per unit
		},
	mounted() {
		this.measure()
		if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', this.measure)
	},
	beforeDestroy() {
		if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('resize', this.measure)
	},
	methods: {
		rectOf(i) {
			return this.geometry && this.rows[i].rect ? this.rows[i].rect : null
		},
		left(i) {
			const r = this.rectOf(i)
			return r ? r.x * this.scale : this.place[i].col * (CELL + GAP)
		},
		top(i) {
			const r = this.rectOf(i)
			return r ? r.y * this.scale : this.place[i].row * (CELL + GAP)
		},
		cellW(i) {
			const r = this.rectOf(i)
			return r ? r.w * this.scale : CELL
		},
		cellH(i) {
			const r = this.rectOf(i)
			return r ? r.h * this.scale : CELL
		},
		// screen pixels per drawing unit, so a pointer distance becomes millimetres
		measure() {
			const el = this.$refs.svg
			if (!el || !el.getBoundingClientRect) return
			const box = el.getBoundingClientRect()
			const vb = this.viewBox.split(' ').map(Number)
			const k = Math.min(box.width / vb[2], box.height / vb[3])
			if (k > 0 && isFinite(k)) this.pxPerUnit = k
		},
		isSelected(i, r) {
			return this.editable ? this.selection.indexOf(i) >= 0 : this.selected === r.bed
		},
		onClick(r) {
			if (!this.editable) this.$emit('select', r.bed)
		},
		// editing: a choice carries whether Shift / Ctrl / Cmd was held (add to the selection instead of replacing it)
		choose(e, i) {
			if (this.editable) this.$emit('pick', { index: i, multi: !!(e && (e.shiftKey || e.ctrlKey || e.metaKey)) })
			else this.$emit('select', this.rows[i].bed)
		},
		// the empty bed: nothing chosen
		onBackground() {
			if (this.editable) this.$emit('clear')
		},
		onDown(e, i, mode) {
			if (!this.editable || !this.rectOf(i) || (e.button !== undefined && e.button > 0)) return
			this.measure()
			this.choose(e, i)
			this.drag = { i, mode, x: e.clientX, y: e.clientY, start: Object.assign({}, this.rectOf(i)), began: false }
			if (e.currentTarget && e.currentTarget.setPointerCapture && e.pointerId !== undefined) {
				try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* a pointer that is already gone */ }
			}
			if (e.preventDefault) e.preventDefault()
		},
		onMove(e) {
			const d = this.drag
			if (!d) return
			const k = this.scale * (this.pxPerUnit || 1) // pixels per millimetre
			const dx = (e.clientX - d.x) / k
			const dy = (e.clientY - d.y) / k
			const step = e.altKey ? 0 : this.step
			let next = d.mode === 'move' ? moveRect(d.start, dx, dy, this.geometry.bed, step) : resizeRect(d.start, dx, dy, this.geometry.bed, step)
				if (this.guides && !e.altKey) {
					const others = this.rows.map((r, n) => (n === d.i ? null : r.rect))
					const g = guideSnap(next, others, this.geometry.bed, d.mode, 8 / k)
					next = g.rect
					this.guideLines = g.guides
				} else this.guideLines = []
			const now = this.rectOf(d.i)
			if (now && now.x === next.x && now.y === next.y && now.w === next.w && now.h === next.h) return
			if (!d.began) { d.began = true; this.$emit('begin') }
			this.$emit('rect', { index: d.i, rect: next })
		},
		onUp() {
				this.guideLines = []
			this.drag = null
		},
		// arrows move the selected zone one step, with Shift they resize it
		onKey(e, i) {
			const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
			const r = this.rectOf(i)
			if (!this.editable || !dir || !r) return
			e.preventDefault()
			const s = this.step > 0 ? this.step : 1
			const next = e.shiftKey ? resizeRect(r, dir[0] * s, dir[1] * s, this.geometry.bed, this.step) : moveRect(r, dir[0] * s, dir[1] * s, this.geometry.bed, this.step)
			this.$emit('begin')
			this.$emit('rect', { index: i, rect: next })
		},
		fill(r) {
			return heatColor(r.current, this.maxTemp)
		},
		ink(r) {
			return inkFor(this.fill(r))
		},
		fmt: fmtTemp,
		targetText(r) {
			return r.target > 0 ? this.$t('plugins.WorkshopPrinting.bedZones.target_to', { t: Math.round(r.target) }) : this.$t('plugins.WorkshopPrinting.common.off')
		},
		label(r) {
			return this.$t('plugins.WorkshopPrinting.bedZones.zone_aria', { n: r.n, now: fmtTemp(r.current), target: r.target > 0 ? Math.round(r.target) : this.$t('plugins.WorkshopPrinting.common.off') })
		}
	}
}
</script>

<style scoped>
.bz-map { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.bz-svg { width: 100%; max-width: 400px; margin: 0 auto; height: auto; display: block; }
.bz-bed { fill: transparent; stroke: var(--wf-line-strong, rgba(128, 128, 128, 0.5)); stroke-width: 2; }
.bz-dim { font-size: 11px; fill: currentColor; opacity: 0.7; }
.bz-zone { cursor: pointer; outline: none; }
.bz-svg.is-editable .bz-zone { cursor: move; touch-action: none; }
.bz-svg.is-editable { touch-action: pan-y; }
.bz-rect { stroke: var(--wf-line-strong, rgba(128, 128, 128, 0.5)); stroke-width: 1; }
.bz-zone.is-off .bz-rect { stroke-dasharray: 4 3; opacity: 0.45; }
.bz-zone.is-off text { opacity: 0.7; }
.bz-zone.is-alert .bz-rect { stroke: var(--wf-err, #e53935); stroke-width: 3; }
.bz-zone.is-conflict .bz-rect { stroke: var(--wf-err, #e53935); stroke-width: 3; stroke-dasharray: 6 3; }
/* editing: green = placed fine (inside the bed, touching no other zone), blue = chosen, red = a real problem (overlap or outside the bed) */
.bz-svg.is-editable .bz-zone.is-ok .bz-rect { fill: rgba(67, 160, 71, 0.16); stroke: var(--wf-ok, #43a047); stroke-width: 2; }
.bz-svg.is-editable .bz-zone.is-conflict .bz-rect { fill: rgba(229, 57, 53, 0.14); }
.bz-svg.is-editable .bz-zone.is-selected.is-ok .bz-rect { fill: rgba(25, 118, 210, 0.16); }
.bz-zone.is-selected .bz-rect, .bz-zone:focus-visible .bz-rect { stroke: var(--wf-accent, #1976d2); stroke-width: 3; }
.bz-tick { stroke: currentColor; stroke-width: 1; opacity: 0.55; }
.bz-tick-n { font-size: 9px; fill: currentColor; opacity: 0.7; font-family: var(--tp-font-mono, monospace); }
.bz-mark { fill: var(--wf-accent, #1976d2); opacity: 0.85; }
.bz-guide { stroke: var(--wf-accent, #1976d2); stroke-width: 1; stroke-dasharray: 4 3; pointer-events: none; }
.bz-zone.is-ref .bz-rect { stroke-width: 5; }
.bz-ghost { fill: none; stroke: var(--wf-accent, #1976d2); stroke-width: 2; stroke-dasharray: 6 4; pointer-events: none; }
.bz-ghost-n { fill: var(--wf-accent, #1976d2); pointer-events: none; }
.bz-arrow { stroke: var(--wf-accent, #1976d2); stroke-width: 2; pointer-events: none; }
.bz-arrow-head { fill: var(--wf-accent, #1976d2); }
.bz-handle { cursor: nwse-resize; touch-action: none; }
.bz-hit { fill: transparent; }
.bz-dot { fill: var(--wf-accent, #1976d2); stroke: #fff; stroke-width: 2; }
.bz-n { font-size: 11px; font-weight: 600; }
.bz-size { font-size: 11px; font-family: var(--tp-font-mono, monospace); }
.bz-bang { font-size: 16px; font-weight: 700; }
.bz-temp { font-size: 20px; font-weight: 600; font-family: var(--tp-font-mono, monospace); }
.bz-target { font-size: 12px; font-family: var(--tp-font-mono, monospace); }
.bz-legend { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 360px; font-size: 11px; opacity: 0.75; }
.bz-bar { flex: 1; height: 8px; border-radius: 4px; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.3)); }
</style>
