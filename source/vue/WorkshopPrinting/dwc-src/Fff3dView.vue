<template>
	<!-- 3D view of an FFF job on a 2D canvas (moved from the Workbench's Simulate card, 2026-10-21). READ ONLY.
	     The logic is in fff-3d-view.js; this component only owns the DOM. -->
	<v-card variant="outlined" class="pa-2 fff-3d">
		<div class="d-flex align-center flex-wrap" style="gap:6px">
			<span class="text-title-small mr-auto">{{ t('fff.view3d_title') }}</span>
			<v-btn size="small" :color="open ? undefined : 'primary'" :variant="(open) ? 'outlined' : 'elevated'" @click="toggle()">{{ open ? t('fff.view3d_close') : t('fff.view3d_open') }}</v-btn>
		</div>
		<div v-show="open">
			<canvas
				ref="canvas" class="fff-canvas"
				@pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"
			/>
			<div class="d-flex align-center flex-wrap mt-1" style="gap:6px">
				<v-btn size="x-small" variant="outlined" @click="view('iso')">{{ t('fff.view_iso') }}</v-btn>
				<v-btn size="x-small" variant="outlined" @click="view('up')">{{ t('fff.view_top') }}</v-btn>
				<v-btn size="x-small" variant="outlined" @click="view('front')">{{ t('fff.view_front') }}</v-btn>
				<v-btn size="x-small" variant="outlined" @click="bed()">{{ withBed ? t('fff.bed_hide') : t('fff.bed_show') }}</v-btn>
			</div>
			<div class="text-body-small text-medium-emphasis mt-1">{{ info }}</div>
			<div class="text-body-small text-medium-emphasis">{{ t('fff.view3d_help') }}</div>
		</div>
	</v-card>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fff3dInit, fff3dSetOpen, fff3dSetView, fff3dToggleBed, fff3dDestroy, fff3dUpdate, fff3dRequest, fff3dPointerDown, fff3dPointerMove, fff3dRelease, fff3dWheel } from './fff-3d-view.js'
import { i18n, machineModel } from './dwc-host.js'

const props = defineProps({
	prev: { type: Object, default: null }, // answer of jobs.preview
	path: { type: String, default: '' }, // file under 0:/gcodes
	layerSel: { type: Number, default: 0 }, // 0 = all layers
	layerMode: { type: String, default: 'until' } // "until" | "single"
})

let h = null
let onWheel = null
let resizer = null

const canvas = ref(null)

const open = ref(false)
const withBed = ref(false)
const info = ref('')

// not reactive on purpose: typed arrays of up to 20000 segments, redrawn many times per second while turning
h = fff3dInit({
	prev: () => props.prev,
	path: () => props.path,
	layer: () => ({ sel: props.layerSel, mode: props.layerMode }),
	time: () => ({ t: 0, simulating: false }),
	om: () => machineModel(),
	t: t,
	setInfo: (s) => { info.value = s; }
});
open.value = h.open;

watch(() => props.prev, () => { nextTick(() => fff3dUpdate(h)); })

watch(() => props.path, () => { nextTick(() => fff3dUpdate(h)); })

watch(() => props.layerSel, () => { fff3dRequest(h); })

watch(() => props.layerMode, () => { fff3dRequest(h); })

onMounted(() => {
	h.canvas = canvas.value;
	h.el = canvas.value.closest('.fff-3d') || canvas.value.parentElement; // the component's root element
	// passive: false so the wheel zooms the view instead of scrolling the page
	onWheel = (ev) => fff3dWheel(h, ev);
	h.canvas.addEventListener('wheel', onWheel, { passive: false });
	// a canvas inside a hidden tab measures 0: draw again when it gets a size (tab shown, window resized)
	if (typeof ResizeObserver === 'function') {
		resizer = new ResizeObserver(() => fff3dRequest(h));
		resizer.observe(h.canvas);
	}
	fff3dUpdate(h);
})

onBeforeUnmount(() => {
	if (resizer) resizer.disconnect();
	if (h.canvas) h.canvas.removeEventListener('wheel', onWheel);
	fff3dDestroy(h);
})

defineExpose({ open, toggle }) // FffJob opens the view after reading a file

function t(key, params) {
	return i18n.t('plugins.WorkshopPrinting.' + key, params);
}

function toggle() {
	open.value = !open.value;
	// the canvas must be visible (it measures its width) before the first draw
	nextTick(() => fff3dSetOpen(h, open.value));
}

function view(name) {
	fff3dSetView(h, name);
}

function bed() {
	fff3dToggleBed(h);
	withBed.value = h.withBed;
}

function down(ev) {
	fff3dPointerDown(h, ev);
}

function move(ev) {
	fff3dPointerMove(h, ev);
}

function up(ev) {
	fff3dRelease(h, ev);
}
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
