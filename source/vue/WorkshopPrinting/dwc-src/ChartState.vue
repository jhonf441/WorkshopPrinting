<template>
	<!-- State temperature chart (2026-10-11, request: "add/improve the
		     chart with more detail"). Own light SVG: DetailChart (vue/_shared)
		     draws a single series with a limit and here there are several zones, each with
		     its dotted target and its cap (M143). -->
	<div class="chart-state">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<span class="text-title-small">{{ $t('plugins.WorkshopPrinting.stateChart.temperatures') }}</span>
			<v-spacer />
			<v-btn-toggle v-model="minutes" mandatory density="compact">
				<v-btn size="small" :value="5">5 min</v-btn>
				<v-btn size="small" :value="10">10 min</v-btn>
			</v-btn-toggle>
			<v-btn size="small" :variant="(!viewStops) ? 'outlined' : 'elevated'" :color="viewStops ? 'primary' : undefined" @click="viewStops = !viewStops">
				<v-icon size="small" start>mdi-arrow-collapse-up</v-icon>{{ $t('plugins.WorkshopPrinting.stateChart.limits') }}
			</v-btn>
		</div>
		<div ref="box" class="eg-box mt-2" :style="{ height: height + 'px' }">
			<svg :width="width" :height="height" class="eg-svg" @pointerdown="pointer" @pointermove="pointer" @pointerleave="exit">
				<!-- grilla y eje Y -->
				<g v-for="v in ticksY" :key="'y' + v">
					<line :x1="M.l" :x2="width - M.r" :y1="y(v)" :y2="y(v)" class="eg-grid" />
					<text :x="M.l - 6" :y="y(v) + 4" text-anchor="end" class="eg-axis">{{ v }}</text>
				</g>
				<g v-for="m in ticksX" :key="'x' + m.t">
					<line :x1="x(m.t)" :x2="x(m.t)" :y1="M.t" :y2="height - M.b" class="eg-grid" />
					<text :x="x(m.t)" :y="height - 6" text-anchor="middle" class="eg-axis">{{ m.txt }}</text>
				</g>
				<!-- por serie: tope (puntos), objetivo (rayas), temperatura (continua) -->
				<g v-for="s in visible" :key="s.id">
					<line v-if="viewStops && s.max > 0" :x1="M.l" :x2="width - M.r" :y1="y(s.max)" :y2="y(s.max)" :stroke="s.color" stroke-width="1.5" stroke-dasharray="2 4" />
					<path :d="path(s.id, 1)" fill="none" :stroke="s.color" stroke-width="1.5" stroke-dasharray="7 5" opacity="0.85" />
					<path :d="path(s.id, 0)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" />
				</g>
				<line v-if="cursor" :x1="x(cursor.t)" :x2="x(cursor.t)" :y1="M.t" :y2="height - M.b" class="eg-cursor" />
			</svg>
			<div v-if="samples.length < 2" class="eg-empty">{{ $t('plugins.WorkshopPrinting.stateChart.collecting_data_the_chart_builds_up') }}</div>
			<div v-if="cursor" class="eg-tip" :style="tipStyle">
				<div class="eg-tip-t">{{ does(cursor.t) }}</div>
				<div v-for="s in visible" :key="s.id" class="d-flex align-center" style="gap:6px">
					<span class="eg-point" :style="{ background: s.color }" />
					<span>{{ s.name }}</span>
					<v-spacer />
					<b>{{ value(cursor, s.id, 0) }}</b>
					<span class="eg-faint">/ {{ value(cursor, s.id, 1) }}</span>
				</div>
			</div>
		</div>
		<!-- legend: tapping a zone hides or shows it -->
		<div class="d-flex flex-wrap mt-2" style="gap:6px">
			<button v-for="s in series" :key="s.id" type="button" class="eg-law" :class="{ 'eg-off': hidden[s.id] }" :title="hidden[s.id] ? $t('plugins.WorkshopPrinting.stateChart.show_on_the_chart') : $t('plugins.WorkshopPrinting.stateChart.hide_from_the_chart')" @click="toggle(s.id)">
				<span class="eg-raya" :style="{ background: s.color }" />
				<span>{{ s.name }}</span>
				<b class="ml-1">{{ fmt(s.current) }} °C</b>
				<span class="eg-faint ml-1">{{ $t('plugins.WorkshopPrinting.stateChart.target_and_limit', { target: s.target > 0 ? fmt(s.target) + ' °C' : $t('plugins.WorkshopPrinting.common.off'), max: fmt(s.max) }) }}</span>
			</button>
		</div>
		<div class="text-body-small eg-faint mt-1">
			{{ $t('plugins.WorkshopPrinting.stateChart.solid_line_temperature_dashes_target_dots') }}
		</div>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { i18n } from './dwc-host.js'

const MIN_KEY = 'workshopPrintingChartMin';

const props = defineProps({
	// [{id, nombre, color, actual, objetivo, max}]
	series: { type: Array, required: true },
	// [{t: epoch ms, v: {id: [current, target]}}], from the oldest to the newest
	samples: { type: Array, required: true }
})

let minutesInit = 5;
try {
	minutesInit = parseInt(localStorage.getItem(MIN_KEY), 10) === 10 ? 10 : 5;
} catch (e) {
	/* no critico */
}

let obs = null

const box = ref(null)

const minutes = ref(minutesInit)
const viewStops = ref(false)
const hidden = ref({})
const width = ref(600)
const height = ref(230)
const cursor = ref(null)
const cursorX = ref(0)
const M = ref({ l: 40, r: 10, t: 10, b: 24 })

const visible = computed(() => {
	return props.series.filter(s => !hidden.value[s.id]);
})

const end = computed(() => {
	const u = props.samples[props.samples.length - 1];
	return u ? u.t : Date.now();
})

const start = computed(() => {
	return end.value - minutes.value * 60000;
})

const inWindow = computed(() => {
	return props.samples.filter(m => m.t >= start.value - 3000);
})

// Y axis fitted to what is seen (more detail than 0..cap)
const spanY = computed(() => {
	let it = Infinity, hi = -Infinity;
	const view = v => { if (v != null && !isNaN(v) && v > -200) { it = Math.min(it, v); hi = Math.max(hi, v); } };
	inWindow.value.forEach(m => visible.value.forEach(s => {
		const p = m.v[s.id];
		if (!p) return;
		view(p[0]);
		if (p[1] > 0) view(p[1]);
	}));
	if (viewStops.value) visible.value.forEach(s => { if (s.max > 0) view(s.max); });
	if (it === Infinity) { it = 0; hi = 100; }
	const stepY = niceStep(hi - it);
	it = Math.max(0, Math.floor((it - 3) / stepY) * stepY);
	hi = Math.ceil((hi + 3) / stepY) * stepY;
	if (hi - it < 20) hi = it + 20;
	return [it, hi];
})

const ticksY = computed(() => {
	const [it, hi] = spanY.value;
	const p = niceStep(hi - it), out = [];
	for (let v = it; v <= hi + 0.001; v += p) out.push(Math.round(v));
	return out;
})

const ticksX = computed(() => {
	const out = [];
	const each = minutes.value <= 5 ? 1 : 2;
	for (let k = 0; k <= minutes.value; k += each) out.push({ t: end.value - k * 60000, txt: k === 0 ? i18n.t('plugins.WorkshopPrinting.stateChart.now') : '-' + k + ' min' });
	return out;
})

const tipStyle = computed(() => {
	const izq = cursorX.value > width.value / 2;
	return izq ? { right: (width.value - cursorX.value + 8) + 'px' } : { left: (cursorX.value + 8) + 'px' };
})

watch(minutes, (v) => {
	try {
		localStorage.setItem(MIN_KEY, String(v));
	} catch (e) {
		/* no critico */
	}
})

onMounted(() => {
	measure();
	window.addEventListener('resize', measure);
	if (typeof ResizeObserver !== 'undefined') {
		obs = new ResizeObserver(() => measure());
		obs.observe(box.value);
	}
})

onBeforeUnmount(() => {
	window.removeEventListener('resize', measure);
	if (obs) obs.disconnect();
})

function measure() {
	const c = box.value;
	if (c && c.clientWidth > 0) width.value = c.clientWidth;
	// pantalla angosta (celular / kiosco vertical): un poco mas baja
	height.value = width.value < 500 ? 200 : 240;
}

function niceStep(span) {
	const steps = [5, 10, 20, 25, 50, 100];
	return steps.find(p => span / p <= 6) || 100;
}

function x(t) {
	const w = width.value - M.value.l - M.value.r;
	return M.value.l + Math.max(0, Math.min(1, (t - start.value) / (end.value - start.value))) * w;
}

function y(v) {
	const [it, hi] = spanY.value;
	const h = height.value - M.value.t - M.value.b;
	return M.value.t + (1 - (v - it) / (hi - it)) * h;
}

// k = 0 temperature, 1 target. Cuts the line where there is no data
// (unread sensor, target off).
function path(id, k) {
	let d = '', abierto = false;
	inWindow.value.forEach(m => {
		const p = m.v[id];
		const v = p ? p[k] : null;
		const ok = v != null && !isNaN(v) && (k === 0 ? v > -200 : v > 0);
		if (!ok) { abierto = false; return; }
		d += (abierto ? 'L' : 'M') + x(m.t).toFixed(1) + ' ' + y(v).toFixed(1);
		abierto = true;
	});
	return d;
}

function pointer(ev) {
	if (props.samples.length < 2) return;
	const r = box.value.getBoundingClientRect();
	const px = ev.clientX - r.left;
	const w = width.value - M.value.l - M.value.r;
	const t = start.value + Math.max(0, Math.min(1, (px - M.value.l) / w)) * (end.value - start.value);
	let best = null;
	inWindow.value.forEach(m => { if (!best || Math.abs(m.t - t) < Math.abs(best.t - t)) best = m; });
	cursor.value = best;
	cursorX.value = best ? x(best.t) : px;
}

function exit(ev) {
	// with a finger the value stays in view until the next touch
	if (ev.pointerType === 'mouse') cursor.value = null;
}

function toggle(id) {
	hidden.value[id] = !hidden.value[id];
}

function value(m, id, k) {
	const p = m.v[id];
	const v = p ? p[k] : null;
	if (k === 1 && !(v > 0)) return i18n.t('plugins.WorkshopPrinting.stateChart.off');
	return v == null || isNaN(v) || v < -200 ? '--' : Number(v).toFixed(1) + ' °C';
}

function does(t) {
	const s = Math.round((end.value - t) / 1000);
	return s <= 1 ? i18n.t('plugins.WorkshopPrinting.stateChart.now') : i18n.t('plugins.WorkshopPrinting.stateChart.ago', { time: (s >= 60 ? Math.floor(s / 60) + ' min ' : '') + (s % 60) + ' s' });
}

function fmt(v) {
	return v == null || isNaN(v) || v < -200 ? '--' : Number(v).toFixed(0);
}
</script>

<style scoped>
.eg-box {
	position: relative;
	width: 100%;
	touch-action: pan-y;
	user-select: none;
}
.eg-svg {
	display: block;
}
.eg-grid {
	stroke: rgba(128, 128, 128, 0.2);
	stroke-width: 1;
}
.eg-axis {
	fill: var(--tp-faint, #9e9e9e);
	font-size: 11px;
}
.eg-cursor {
	stroke: var(--tp-faint, #9e9e9e);
	stroke-width: 1;
}
.eg-empty {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--tp-faint, #9e9e9e);
	font-size: 13px;
	pointer-events: none;
}
.eg-tip {
	position: absolute;
	top: 8px;
	min-width: 190px;
	max-width: 70%;
	padding: 6px 8px;
	font-size: 12px;
	background: var(--tp-card, #263238);
	border: 1px solid rgba(128, 128, 128, 0.35);
	border-radius: 6px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	pointer-events: none;
}
.eg-tip-t {
	color: var(--tp-faint, #9e9e9e);
	margin-bottom: 2px;
}
.eg-point {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	flex: none;
}
.eg-faint {
	color: var(--tp-faint, #9e9e9e);
}
.eg-law {
	display: inline-flex;
	align-items: center;
	flex-wrap: wrap;
	min-height: 32px;
	padding: 2px 10px;
	font-size: 12px;
	color: inherit;
	border: 1px solid rgba(128, 128, 128, 0.35);
	border-radius: 6px;
	background: transparent;
	cursor: pointer;
}
.eg-law.eg-off {
	opacity: 0.45;
}
.eg-raya {
	width: 16px;
	height: 3px;
	border-radius: 2px;
	margin-right: 6px;
	flex: none;
}
</style>
