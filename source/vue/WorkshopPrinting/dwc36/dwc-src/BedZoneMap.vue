<template>
	<div class="bz-map">
		<svg :viewBox="'0 0 ' + width + ' ' + height" class="bz-svg" role="group" :aria-label="$t('plugins.WorkshopPrinting.bedZones.map_label')" preserveAspectRatio="xMidYMid meet">
			<g
				v-for="(r, i) in rows" :key="r.bed" :transform="'translate(' + left(i) + ',' + top(i) + ')'"
				class="bz-zone" :class="{ 'is-selected': selected === r.bed, 'is-off': !r.active, 'is-alert': r.alert }"
				tabindex="0" role="button" :aria-pressed="selected === r.bed ? 'true' : 'false'" :aria-label="label(r)"
				@click="$emit('select', r.bed)" @keydown.enter.prevent="$emit('select', r.bed)" @keydown.space.prevent="$emit('select', r.bed)"
			>
				<rect :width="CELL" :height="CELL" rx="8" class="bz-rect" :fill="fill(r)" />
				<text x="10" y="20" class="bz-n" :fill="ink(r)">{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: r.n }) }}</text>
				<text v-if="r.alert" :x="CELL - 10" y="20" text-anchor="end" class="bz-bang" :fill="ink(r)">!</text>
				<text :x="CELL / 2" :y="CELL / 2 + 6" text-anchor="middle" class="bz-temp" :fill="ink(r)">{{ fmt(r.current) }}</text>
				<text :x="CELL / 2" :y="CELL - 14" text-anchor="middle" class="bz-target" :fill="ink(r)">{{ targetText(r) }}</text>
			</g>
		</svg>
		<div class="bz-legend" :title="$t('plugins.WorkshopPrinting.bedZones.map_scale', { min: legendMin, max: legendMax })">
			<span>{{ legendMin }} °C</span>
			<span class="bz-bar" :style="{ background: gradient }" role="img" :aria-label="$t('plugins.WorkshopPrinting.bedZones.map_scale', { min: legendMin, max: legendMax })" />
			<span>{{ legendMax }} °C</span>
		</div>
	</div>
</template>

<script>
'use strict'

// The map of the bed: one square per zone, laid out as the settings say (rows x columns), colored by its temperature from cold blue to red
// (heatColor of bed-zones.js: the state colors of the page). Every square also PRINTS its number, so the color is never the only signal; an alert
// adds a "!" and a red outline. Built with SVG and the tokens of the family (--wf-*), no library. A square is a button: it selects the zone.
import { cells, layoutSize, heatColor, inkFor, fmtTemp, AMBIENT } from './bed-zones.js'

const CELL = 112
const GAP = 8

export default {
	props: {
		rows: { type: Array, required: true }, // zoneRows() of bed-zones.js
		layout: { type: Object, default: () => ({ rows: 2, columns: 2 }) },
		maxTemp: { type: Number, default: 110 },
		selected: { type: Number, default: null }
	},
	data() {
		return { CELL }
	},
	computed: {
		size() {
			return layoutSize(this.rows, this.layout)
		},
		place() {
			return cells(this.rows, this.layout)
		},
		width() {
			return this.size.columns * CELL + (this.size.columns - 1) * GAP
		},
		height() {
			return this.size.rows * CELL + (this.size.rows - 1) * GAP
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
	methods: {
		left(i) {
			return this.place[i].col * (CELL + GAP)
		},
		top(i) {
			return this.place[i].row * (CELL + GAP)
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
.bz-zone { cursor: pointer; outline: none; }
.bz-rect { stroke: var(--wf-line-strong, rgba(128, 128, 128, 0.5)); stroke-width: 1; }
.bz-zone.is-off .bz-rect { stroke-dasharray: 4 3; opacity: 0.45; }
.bz-zone.is-off text { opacity: 0.7; }
.bz-zone.is-alert .bz-rect { stroke: var(--wf-err, #e53935); stroke-width: 3; }
.bz-zone.is-selected .bz-rect, .bz-zone:focus-visible .bz-rect { stroke: var(--wf-accent, #1976d2); stroke-width: 3; }
.bz-n { font-size: 11px; font-weight: 600; }
.bz-bang { font-size: 16px; font-weight: 700; }
.bz-temp { font-size: 20px; font-weight: 600; font-family: var(--tp-font-mono, monospace); }
.bz-target { font-size: 12px; font-family: var(--tp-font-mono, monospace); }
.bz-legend { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 360px; font-size: 11px; opacity: 0.75; }
.bz-bar { flex: 1; height: 8px; border-radius: 4px; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.3)); }
</style>
