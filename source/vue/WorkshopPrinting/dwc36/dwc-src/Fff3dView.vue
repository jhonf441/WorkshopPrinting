<template>
	<!-- 3D view of an FFF job on a 2D canvas (moved from the Workbench's Simulate card, 2026-10-21). READ ONLY.
	     The logic is in fff-3d-view.js; this component only owns the DOM. -->
	<v-card outlined class="pa-2 fff-3d">
		<div class="d-flex align-center flex-wrap" style="gap:6px">
			<span class="text-subtitle-2 mr-auto">{{ t('fff.view3d_title') }}</span>
			<v-btn small :color="open ? undefined : 'primary'" :outlined="open" @click="toggle()">{{ open ? t('fff.view3d_close') : t('fff.view3d_open') }}</v-btn>
		</div>
		<div v-show="open">
			<canvas
				ref="canvas" class="fff-canvas"
				@pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"
			/>
			<div class="d-flex align-center flex-wrap mt-1" style="gap:6px">
				<v-btn x-small outlined @click="view('iso')">{{ t('fff.view_iso') }}</v-btn>
				<v-btn x-small outlined @click="view('up')">{{ t('fff.view_top') }}</v-btn>
				<v-btn x-small outlined @click="view('front')">{{ t('fff.view_front') }}</v-btn>
				<v-btn x-small outlined @click="bed()">{{ withBed ? t('fff.bed_hide') : t('fff.bed_show') }}</v-btn>
			</div>
			<div class="text-caption grey--text mt-1">{{ info }}</div>
			<div class="text-caption grey--text">{{ t('fff.view3d_help') }}</div>
		</div>
	</v-card>
</template>

<script>
'use strict'

import { fff3dInit, fff3dSetOpen, fff3dSetView, fff3dToggleBed, fff3dDestroy, fff3dUpdate, fff3dRequest, fff3dPointerDown, fff3dPointerMove, fff3dRelease, fff3dWheel } from './fff-3d-view.js'

export default {
	props: {
		prev: { type: Object, default: null }, // answer of jobs.preview
		path: { type: String, default: '' }, // file under 0:/gcodes
		layerSel: { type: Number, default: 0 }, // 0 = all layers
		layerMode: { type: String, default: 'until' } // "until" | "single"
	},
	data() {
		return { open: false, withBed: false, info: '' };
	},
	created() {
		// not reactive on purpose: typed arrays of up to 20000 segments, redrawn many times per second while turning
		this.h = fff3dInit({
			prev: () => this.prev,
			path: () => this.path,
			layer: () => ({ sel: this.layerSel, mode: this.layerMode }),
			time: () => ({ t: 0, simulating: false }),
			om: () => this.$store.state.machine.model,
			t: this.t,
			setInfo: (s) => { this.info = s; }
		});
		this.open = this.h.open;
	},
	mounted() {
		this.h.canvas = this.$refs.canvas;
		this.h.el = this.$el;
		// passive: false so the wheel zooms the view instead of scrolling the page
		this.onWheel = (ev) => fff3dWheel(this.h, ev);
		this.h.canvas.addEventListener('wheel', this.onWheel, { passive: false });
		// a canvas inside a hidden tab measures 0: draw again when it gets a size (tab shown, window resized)
		if (typeof ResizeObserver === 'function') {
			this.resizer = new ResizeObserver(() => fff3dRequest(this.h));
			this.resizer.observe(this.h.canvas);
		}
		fff3dUpdate(this.h);
	},
	beforeDestroy() {
		if (this.resizer) this.resizer.disconnect();
		if (this.h.canvas) this.h.canvas.removeEventListener('wheel', this.onWheel);
		fff3dDestroy(this.h);
	},
	watch: {
		prev() { this.$nextTick(() => fff3dUpdate(this.h)); },
		path() { this.$nextTick(() => fff3dUpdate(this.h)); },
		layerSel() { fff3dRequest(this.h); },
		layerMode() { fff3dRequest(this.h); }
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopPrinting.' + key, params);
		},
		toggle() {
			this.open = !this.open;
			// the canvas must be visible (it measures its width) before the first draw
			this.$nextTick(() => fff3dSetOpen(this.h, this.open));
		},
		view(name) {
			fff3dSetView(this.h, name);
		},
		bed() {
			fff3dToggleBed(this.h);
			this.withBed = this.h.withBed;
		},
		down(ev) {
			fff3dPointerDown(this.h, ev);
		},
		move(ev) {
			fff3dPointerMove(this.h, ev);
		},
		up(ev) {
			fff3dRelease(this.h, ev);
		}
	}
};
</script>

<style scoped>
.fff-canvas {
	width: 100%;
	display: block;
	background: rgba(128, 128, 128, 0.08);
	border-radius: 4px;
	touch-action: none;
	cursor: grab;
	margin-top: 6px;
}
</style>
