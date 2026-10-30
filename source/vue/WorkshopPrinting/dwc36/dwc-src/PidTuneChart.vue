<template>
	<!-- What happened during the PID tuning (M303), measured while it ran: temperature, target and power over time. -->
	<div v-if="m" class="ptc">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<span class="text-title-small">{{ $t('plugins.WorkshopPrinting.pid.tune_chart_title', { name: trace.name }) }}</span>
			<span class="text-body-small text-medium-emphasis">{{ trace.endedAt ? $t('plugins.WorkshopPrinting.pid.tune_chart_done', { time: clock(m.seconds) }) : $t('plugins.WorkshopPrinting.pid.tune_chart_running', { time: clock(m.seconds) }) }}</span>
		</div>
		<svg :viewBox="'0 0 ' + G.w + ' ' + G.h" class="ptc-svg" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="$t('plugins.WorkshopPrinting.pid.tune_chart_title', { name: trace.name })">
			<g v-for="v in m.ticksY" :key="'y' + v">
				<line :x1="G.l" :x2="G.w - G.r" :y1="m.y(v)" :y2="m.y(v)" class="ptc-grid" />
				<text :x="G.l - 5" :y="m.y(v) + 4" text-anchor="end" class="ptc-axis">{{ v }}</text>
			</g>
			<g v-for="t in m.ticksX" :key="'x' + t">
				<line :x1="m.x(t)" :x2="m.x(t)" :y1="G.t" :y2="G.h - G.b" class="ptc-grid" />
				<text :x="m.x(t)" :y="G.h - 8" text-anchor="middle" class="ptc-axis">{{ clock(t) }}</text>
			</g>
			<path v-if="m.power" :d="m.power" fill="none" class="ptc-power" stroke-width="1.5" />
			<line v-if="m.targetY !== null" :x1="G.l" :x2="G.w - G.r" :y1="m.targetY" :y2="m.targetY" class="text-success" stroke="currentColor" stroke-width="1.5" stroke-dasharray="7 5" />
			<path :d="m.temp" fill="none" class="text-primary" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
		</svg>
		<div class="text-body-small ptc-legend">
			<span><i class="ptc-key text-primary" />{{ $t('plugins.WorkshopPrinting.pid.tune_chart_temp') }}</span>
			<span v-if="m.targetY !== null"><i class="ptc-key ptc-key-dash text-success" />{{ $t('plugins.WorkshopPrinting.pid.tune_chart_target', { c: trace.target }) }}</span>
			<span v-if="m.power"><i class="ptc-key ptc-power-key" />{{ $t('plugins.WorkshopPrinting.pid.tune_chart_power') }}</span>
		</div>
		<div class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopPrinting.pid.tune_chart_help', { min: Math.round(m.min), max: Math.round(m.max) }) }}</div>
	</div>
</template>

<script>
import { chartModel, clock } from './pid-trace.js';

const G = { w: 600, h: 220, l: 42, r: 12, t: 10, b: 26 };

export default {
	props: {
		trace: { type: Object, default: null }
	},
	data() {
		return { G };
	},
	computed: {
		m() {
			return chartModel(this.trace, G);
		}
	},
	methods: { clock }
};
</script>

<style scoped>
.ptc {
	margin-top: 12px;
}
.ptc-svg {
	display: block;
	width: 100%;
	max-width: 720px;
	height: auto;
}
.ptc-grid {
	stroke: rgba(128, 128, 128, 0.2);
	stroke-width: 1;
}
.ptc-axis {
	fill: var(--tp-faint, #9e9e9e);
	font-size: 11px;
}
.ptc-power {
	stroke: #ef6c00;
	opacity: 0.75;
}
.ptc-legend {
	display: flex;
	flex-wrap: wrap;
	gap: 14px;
	margin-top: 4px;
}
.ptc-key {
	display: inline-block;
	width: 18px;
	height: 0;
	border-top: 3px solid currentColor;
	margin-right: 6px;
	vertical-align: middle;
}
.ptc-key-dash {
	border-top-style: dashed;
}
.ptc-power-key {
	border-top: 2px solid #ef6c00;
}
</style>
