<template>
	<div class="gl-slider" :class="{ 'is-off': total < 2 }">
		<div ref="track" class="gl-track" @pointerdown="onTrack">
			<div class="gl-fill" :style="{ top: percentOf(hi) + '%', bottom: (100 - percentOf(lo)) + '%' }" />
			<div v-for="h in handles" :key="h.which" class="gl-handle" role="slider" tabindex="0" :aria-label="h.label" aria-orientation="vertical" :aria-valuemin="1" :aria-valuemax="Math.max(1, total)" :aria-valuenow="h.value + 1" :aria-valuetext="h.text" :style="{ top: percentOf(h.value) + '%' }" @pointerdown.stop.prevent="start($event, h.which)" @pointermove="move($event)" @pointerup="end($event)" @pointercancel="end($event)" @keydown="key($event, h.which)">
				<span class="gl-knob" />
			</div>
		</div>
	</div>
</template>

<script>
'use strict'

// The vertical layer slider with TWO handles (lower and upper layer), like PrusaSlicer's: the top of the track is the last layer. Pointer events with capture (mouse,
// touch and pen), a 44 px touch target per handle, keyboard: arrows +-1, Page keys +-10, Home / End. It only reports values (`change` {lo, hi}); the maths are in
// gcode-lib-slider.js. The slider is debounced by whoever listens.
import { libText } from './gcode-lib-text.js'
import { valueAt, percentOf, nearestHandle, moveHandle, keyMove } from './gcode-lib-slider.js'

export default {
	mixins: [libText],
	props: {
		total: { type: Number, default: 0 },
		lo: { type: Number, default: 0 },
		hi: { type: Number, default: 0 }
	},
	data() {
		return { dragging: '' }
	},
	computed: {
		handles() {
			return [
				{ which: 'hi', value: this.hi, label: this.tx('slider_upper'), text: this.tx('layer_of', { n: this.hi + 1, total: this.total }) },
				{ which: 'lo', value: this.lo, label: this.tx('slider_lower'), text: this.tx('layer_of', { n: this.lo + 1, total: this.total }) }
			]
		}
	},
	methods: {
		percentOf(v) {
			return percentOf(v, this.total)
		},
		emit(r) {
			if (r.lo !== this.lo || r.hi !== this.hi) this.$emit('change', r)
		},
		at(e) {
			return valueAt(e.clientY, this.$refs.track.getBoundingClientRect(), this.total)
		},
		// a tap on the track moves the nearest handle there and lets it be dragged on
		onTrack(e) {
			const v = this.at(e)
			const which = nearestHandle(this.lo, this.hi, v)
			this.emit(moveHandle(which, v, this.lo, this.hi, this.total))
			this.start(e, which, e.currentTarget)
		},
		start(e, which, el) {
			this.dragging = which
			const target = el || e.currentTarget
			if (target && target.setPointerCapture && e.pointerId !== undefined) { try { target.setPointerCapture(e.pointerId) } catch (x) { /* synthetic event */ } }
		},
		move(e) {
			if (!this.dragging) return
			this.emit(moveHandle(this.dragging, this.at(e), this.lo, this.hi, this.total))
		},
		end() {
			this.dragging = ''
		},
		key(e, which) {
			const r = keyMove(e.key, which, this.lo, this.hi, this.total)
			if (!r) return
			e.preventDefault()
			this.emit(r)
		}
	}
}
</script>

<style scoped>
.gl-slider { width: 44px; flex: 1 1 auto; align-self: stretch; min-height: 180px; padding: 22px 0; box-sizing: border-box; display: flex; justify-content: center; touch-action: none; user-select: none; }
.gl-slider.is-off { opacity: 0.4; pointer-events: none; }
.gl-track { position: relative; width: 6px; align-self: stretch; border-radius: 3px; background: rgba(128, 128, 128, 0.35); cursor: pointer; }
.gl-track::before { content: ''; position: absolute; left: -19px; right: -19px; top: 0; bottom: 0; }
.gl-fill { position: absolute; left: 0; right: 0; border-radius: 3px; background: var(--wf-sec, #1e88e5); }
.gl-handle { position: absolute; left: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; display: flex; align-items: center; justify-content: center; cursor: grab; outline: none; }
.gl-knob { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid var(--wf-sec, #1e88e5); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5); }
.gl-handle:focus .gl-knob { box-shadow: 0 0 0 4px rgba(30, 136, 229, 0.45); }
</style>
