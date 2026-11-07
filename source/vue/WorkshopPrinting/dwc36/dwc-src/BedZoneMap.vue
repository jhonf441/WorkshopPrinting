<template>
	<div class="bz-map">
		<svg
			ref="svg" :viewBox="viewBox" class="bz-svg" :class="{ 'is-editable': editable }" role="group" :aria-label="$t('plugins.WorkshopPrinting.bedZones.map_label')" preserveAspectRatio="xMidYMid meet"
			@pointermove="onMove" @pointerup="onUp" @pointercancel="onUp"
		>
			<!-- the physical bed, to scale, when the geometry is on -->
			<template v-if="geometry">
				<rect :x="0" :y="0" :width="width" :height="height" rx="4" class="bz-bed" @click="onBackground" />
				<text :x="width / 2" y="-6" text-anchor="middle" class="bz-dim">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_mm', { n: geometry.bed.width }) }}</text>
				<text :x="-6" :y="height / 2" text-anchor="middle" class="bz-dim" :transform="'rotate(-90 -6 ' + height / 2 + ')'">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_mm', { n: geometry.bed.length }) }}</text>
			</template>
			<g
				v-for="(r, i) in rows" :key="r.bed" :transform="'translate(' + left(i) + ',' + top(i) + ')'"
				class="bz-zone" :class="{ 'is-selected': isSelected(i, r), 'is-ref': editable && reference === i, 'is-off': !r.active, 'is-alert': r.alert, 'is-conflict': bad.indexOf(i) >= 0 }"
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
import { moveRect, resizeRect, conflicts, TOUCH_PX } from './bed-zones-drag.js'

const CELL = 112
const GAP = 8
const PAD = 18 // room for the dimension labels around the bed
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
		step: { type: Number, default: 5 }
	},
	data() {
		return { CELL, pxPerUnit: 1, drag: null }
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
		viewBox() {
			return this.geometry ? (-PAD) + ' ' + (-PAD) + ' ' + (this.width + 2 * PAD) + ' ' + (this.height + 2 * PAD) : '0 0 ' + this.width + ' ' + this.height
		},
		// half of the touch area of a handle, in drawing units (44 px on screen, never smaller than the dot)
		hit() {
			return Math.max(9, TOUCH_PX / 2 / (this.pxPerUnit || 1))
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
			const next = d.mode === 'move' ? moveRect(d.start, dx, dy, this.geometry.bed, step) : resizeRect(d.start, dx, dy, this.geometry.bed, step)
			const now = this.rectOf(d.i)
			if (now && now.x === next.x && now.y === next.y && now.w === next.w && now.h === next.h) return
			if (!d.began) { d.began = true; this.$emit('begin') }
			this.$emit('rect', { index: d.i, rect: next })
		},
		onUp() {
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
.bz-zone.is-selected .bz-rect, .bz-zone:focus-visible .bz-rect { stroke: var(--wf-accent, #1976d2); stroke-width: 3; }
.bz-zone.is-ref .bz-rect { stroke-width: 5; }
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
